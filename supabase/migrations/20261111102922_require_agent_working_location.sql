create table public.agent_work_settings (
    agent_id uuid primary key references public.agent_profiles(id) on delete cascade,
    latitude double precision not null check (latitude between -90 and 90),
    longitude double precision not null check (longitude between -180 and 180),
    accuracy_metres double precision not null check (accuracy_metres > 0 and accuracy_metres <= 50),
    captured_at timestamptz not null,
    confirmed_at timestamptz not null default now(),
    on_duty boolean not null default false
);

alter table public.agent_work_settings enable row level security;
revoke all on public.agent_work_settings from public, anon, authenticated;
grant select on public.agent_work_settings to authenticated;
create policy "Agents read their own working location"
on public.agent_work_settings for select to authenticated
using (agent_id = (select auth.uid()));

create function public.save_agent_working_location(
    p_latitude double precision, p_longitude double precision,
    p_accuracy_metres double precision, p_captured_at timestamptz
)
returns void
language plpgsql security definer set search_path = ''
as $function$
declare
    actor uuid := auth.uid();
begin
    if actor is null or not exists (
        select 1 from public.agent_profiles ap
        join public.user_roles ur on ur.user_id = ap.id and ur.role = 'agent'
        where ap.id = actor and ap.status = 'approved'
    ) then
        raise exception 'Approved agent access required' using errcode = '42501';
    end if;
    if p_latitude is null or p_latitude not between -90 and 90
        or p_longitude is null or p_longitude not between -180 and 180
        or p_accuracy_metres is null or p_accuracy_metres not between 0.01 and 50
        or p_captured_at is null or p_captured_at not between now() - interval '2 minutes' and now() + interval '15 seconds'
    then
        raise exception 'Capture a fresh location accurate to within 50 metres';
    end if;

    insert into public.agent_work_settings (agent_id, latitude, longitude, accuracy_metres, captured_at)
    values (actor, p_latitude, p_longitude, p_accuracy_metres, p_captured_at)
    on conflict (agent_id) do update
        set latitude = excluded.latitude, longitude = excluded.longitude,
            accuracy_metres = excluded.accuracy_metres, captured_at = excluded.captured_at, confirmed_at = now()
        where agent_work_settings.captured_at <= excluded.captured_at;
end;
$function$;

create function public.set_agent_on_duty(p_on_duty boolean)
returns void
language plpgsql security definer set search_path = ''
as $function$
begin
    update public.agent_work_settings aws
    set on_duty = p_on_duty
    from public.agent_profiles ap
    where aws.agent_id = auth.uid() and ap.id = aws.agent_id and ap.status = 'approved'
        and exists (select 1 from public.user_roles ur where ur.user_id = ap.id and ur.role = 'agent');
    if not found then
        raise exception 'Confirm a working location before changing duty status';
    end if;
end;
$function$;

create function public.list_agents_ready_for_assignment()
returns table (agent_id uuid, name text)
language sql stable security definer set search_path = ''
as $function$
    select aws.agent_id, coalesce(nullif(btrim(p.full_name), ''), 'Agent')
    from public.agent_work_settings aws
    join public.agent_profiles ap on ap.id = aws.agent_id and ap.status = 'approved'
    join public.user_roles ur on ur.user_id = ap.id and ur.role = 'agent'
    join public.profiles p on p.id = aws.agent_id
    where aws.on_duty and public.jwt_has_any_role(array['admin', 'sub_admin', 'supa_admin'])
    order by 2, 1;
$function$;

revoke all on function public.save_agent_working_location(double precision, double precision, double precision, timestamptz) from public, anon;
revoke all on function public.set_agent_on_duty(boolean) from public, anon;
revoke all on function public.list_agents_ready_for_assignment() from public, anon;
grant execute on function public.save_agent_working_location(double precision, double precision, double precision, timestamptz) to authenticated;
grant execute on function public.set_agent_on_duty(boolean) to authenticated;
grant execute on function public.list_agents_ready_for_assignment() to authenticated;

CREATE OR REPLACE FUNCTION public.assign_best_agent(p_order_id uuid, p_assigned_by uuid DEFAULT NULL::uuid, p_method assignment_method DEFAULT 'auto'::assignment_method, p_reason text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
    v_agent_id uuid;
begin
    select assigned_agent_id into v_agent_id
    from public.orders
    where id = p_order_id and payment_status = 'paid' and status = 'awaiting_agent_acceptance'
    for update;
    if not found or v_agent_id is not null then return v_agent_id; end if;

    select ap.id
    into v_agent_id
    from public.agent_profiles ap
    join public.user_roles ur on ur.user_id = ap.id and ur.role = 'agent'
    join public.agent_work_settings aws on aws.agent_id = ap.id and aws.on_duty
    left join lateral (
        select count(*)::integer as active_orders
        from public.orders o
        where o.assigned_agent_id = ap.id
          and o.status in ('awaiting_agent_acceptance', 'awaiting_merchant_confirmation', 'processing', 'ready_for_pickup', 'out_for_delivery')
    ) load on true
    where ap.status = 'approved'
    order by coalesce(load.active_orders, 0) asc, ap.created_at asc
    limit 1 for share of aws;

    if v_agent_id is not null then
        update public.orders
        set assigned_agent_id = v_agent_id,
            assignment_method = p_method,
            agent_assigned_at = now()
        where id = p_order_id;

        update public.order_assignments
        set is_active = false,
            updated_at = now()
        where order_id = p_order_id
          and assignment_role = 'agent'
          and is_active = true;

        insert into public.order_assignments (order_id, assignment_role, assignee_id, assigned_by, method, reason, is_active)
        values (p_order_id, 'agent', v_agent_id, p_assigned_by, p_method, p_reason, true);
    else
        perform public.create_notification(
            staff.user_id,
            'Order needs an agent',
            'No approved on-duty agent has a confirmed working location. Open Agent assignments to review the order.',
            'agent_assignment_required',
            '/admin/agent-assignments',
            jsonb_build_object('order_id', p_order_id, 'reason', 'no_eligible_agent')
        )
        from (
            select distinct user_id from public.user_roles
            where role in ('admin', 'sub_admin', 'supa_admin')
        ) staff
        where not exists (
            select 1 from public.notifications n
            where n.user_id = staff.user_id and n.type = 'agent_assignment_required'
              and n.metadata->>'order_id' = p_order_id::text
        );
    end if;

    return v_agent_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.override_order_assignment(p_order_id uuid, p_assignment_role text, p_new_assignee_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
    v_actor uuid := auth.uid();
    v_order record;
    v_pickup_code text;
    v_delivery_code text;
begin
    if not public.jwt_has_any_role(array['admin', 'sub_admin', 'supa_admin']) then
        return jsonb_build_object('success', false, 'error', 'Admin access required');
    end if;

    if p_new_assignee_id is null then
        return jsonb_build_object('success', false, 'error', 'A replacement assignee is required');
    end if;

    select *
    into v_order
    from public.orders
    where id = p_order_id
    for update;

    if not found then
        return jsonb_build_object('success', false, 'error', 'Order not found');
    end if;

    if p_assignment_role = 'agent' then
        if not exists (
            select 1
            from public.agent_profiles ap
            join public.user_roles ur on ur.user_id = ap.id and ur.role = 'agent'
            where ap.id = p_new_assignee_id
              and ap.status = 'approved'
        ) then
            return jsonb_build_object('success', false, 'error', 'Replacement agent must be approved');
        end if;

        perform 1 from public.agent_work_settings
        where agent_id = p_new_assignee_id and on_duty
        for share;
        if not found then
            return jsonb_build_object('success', false, 'error', 'The agent must confirm a working location and be on duty');
        end if;

        update public.orders
        set assigned_agent_id = p_new_assignee_id,
            assignment_method = 'override',
            agent_assigned_at = now(),
            agent_accepted_at = null,
            status = 'awaiting_agent_acceptance'
        where id = p_order_id;
    elsif p_assignment_role = 'rider' then
        if not exists (
            select 1
            from public.rider_profiles rp
            join public.user_roles ur on ur.user_id = rp.id and ur.role = 'rider'
            where rp.id = p_new_assignee_id
              and rp.status = 'approved'
        ) then
            return jsonb_build_object('success', false, 'error', 'Replacement rider must be approved');
        end if;

        if exists (
            select 1
            from public.orders o
            where o.rider_id = p_new_assignee_id
              and o.id <> p_order_id
              and o.status in ('ready_for_pickup', 'out_for_delivery')
        ) then
            return jsonb_build_object('success', false, 'error', 'Replacement rider already has an active delivery');
        end if;

        v_pickup_code := coalesce(v_order.pickup_code, lpad((floor(random() * 10000))::text, 4, '0'));
        v_delivery_code := coalesce(v_order.delivery_code, lpad((floor(random() * 10000))::text, 4, '0'));

        update public.orders
        set rider_id = p_new_assignee_id,
            rider_assigned_at = now(),
            assignment_method = 'override',
            pickup_code = v_pickup_code,
            delivery_code = v_delivery_code
        where id = p_order_id;
    elsif p_assignment_role = 'merchant' then
        if not exists (
            select 1
            from public.user_roles ur
            where ur.user_id = p_new_assignee_id
              and ur.role = 'merchant'
        ) then
            return jsonb_build_object('success', false, 'error', 'Replacement merchant must have merchant access');
        end if;

        update public.orders
        set merchant_id = p_new_assignee_id,
            assignment_method = 'override'
        where id = p_order_id;
    else
        return jsonb_build_object('success', false, 'error', 'Unsupported assignment role');
    end if;

    update public.order_assignments
    set is_active = false,
        updated_at = now()
    where order_id = p_order_id
      and assignment_role = p_assignment_role
      and is_active = true;

    insert into public.order_assignments (
        order_id,
        assignment_role,
        assignee_id,
        assigned_by,
        method,
        reason,
        is_active
    )
    values (
        p_order_id,
        p_assignment_role,
        p_new_assignee_id,
        v_actor,
        'override',
        p_reason,
        true
    );

    perform public.write_audit_log(
        v_actor,
        'override_order_assignment',
        'order',
        p_order_id,
        jsonb_build_object('assignment_role', p_assignment_role, 'new_assignee_id', p_new_assignee_id, 'reason', p_reason)
    );

    return jsonb_build_object('success', true, 'order_id', p_order_id);
end;
$function$;

CREATE OR REPLACE FUNCTION public.accept_agent_assignment(p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
    v_order record;
    v_actor uuid := auth.uid();
begin
    select * into v_order from public.orders where id = p_order_id for update;
    if not found then return jsonb_build_object('success', false, 'error', 'Order not found'); end if;
    if v_actor is null or v_order.assigned_agent_id is distinct from v_actor then return jsonb_build_object('success', false, 'error', 'You are not assigned to this order'); end if;
    if v_order.status <> 'awaiting_agent_acceptance' then return jsonb_build_object('success', false, 'error', 'Order is not awaiting agent acceptance'); end if;

    if not exists (
        select 1 from public.agent_work_settings aws
        join public.agent_profiles ap on ap.id = aws.agent_id and ap.status = 'approved'
        join public.user_roles ur on ur.user_id = ap.id and ur.role = 'agent'
        where aws.agent_id = v_actor
    ) then
        return jsonb_build_object('success', false, 'error', 'Confirm your working location before accepting orders');
    end if;

    update public.orders set status = 'awaiting_merchant_confirmation', agent_accepted_at = now() where id = p_order_id;
    update public.order_assignments set accepted_at = now(), updated_at = now() where order_id = p_order_id and assignment_role = 'agent' and assignee_id = v_actor and is_active = true;
    perform public.write_audit_log(v_actor, 'accept_agent_assignment', 'order', p_order_id, '{}'::jsonb);
    return jsonb_build_object('success', true, 'order_id', p_order_id);
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_paid_order_unchecked(p_user_id uuid, p_items jsonb, p_delivery_location jsonb, p_delivery_fee_kobo bigint DEFAULT 0, p_contact_numbers jsonb DEFAULT '[]'::jsonb, p_payment_reference text DEFAULT NULL::text, p_points_to_redeem integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    v_actor uuid := auth.uid();
    v_wallet_id uuid;
    v_wallet_balance bigint;
    v_order_id uuid := gen_random_uuid();
    v_item record;
    v_product record;
    v_validation jsonb;
    v_merchant_id uuid;
    v_subtotal_kobo bigint := 0;
    v_total_kobo bigint := 0;
    v_payment_reference text := coalesce(p_payment_reference, 'WAL-' || encode(gen_random_bytes(8), 'hex'));
    v_redemption jsonb := jsonb_build_object('success', true, 'points_used', 0, 'discount_kobo', 0);
    v_points_discount_kobo bigint := 0;
    v_points_used integer := 0;
begin
    if v_actor is null then
        return jsonb_build_object('success', false, 'error', 'Authentication required');
    end if;

    if p_user_id is distinct from v_actor then
        return jsonb_build_object('success', false, 'error', 'You can only place orders for your own account');
    end if;

    if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
        return jsonb_build_object('success', false, 'error', 'Cart is empty');
    end if;

    perform public.process_reward_point_expiries(p_user_id);

    v_wallet_id := public.ensure_actor_wallet(p_user_id, 'customer');

    select balance
    into v_wallet_balance
    from public.wallets
    where id = v_wallet_id
    for update;

    for v_item in
        select *
        from jsonb_to_recordset(p_items) as item(product_id uuid, quantity integer)
    loop
        v_validation := public.validate_orderable_product(v_item.product_id, v_item.quantity, true);

        if not coalesce((v_validation ->> 'success')::boolean, false) then
            return jsonb_build_object('success', false, 'error', coalesce(v_validation ->> 'error', 'Product validation failed'));
        end if;

        if v_merchant_id is null then
            v_merchant_id := (v_validation ->> 'merchant_id')::uuid;
        elsif v_merchant_id <> (v_validation ->> 'merchant_id')::uuid then
            return jsonb_build_object('success', false, 'error', 'Mixed merchant carts are not allowed');
        end if;

        v_subtotal_kobo := v_subtotal_kobo + (((v_validation ->> 'price_kobo')::bigint) * v_item.quantity);
    end loop;

    if coalesce(p_points_to_redeem, 0) > 0 then
        v_redemption := public.apply_reward_points_redemption(
            p_user_id,
            v_order_id,
            p_points_to_redeem,
            v_subtotal_kobo,
            false
        );

        if not coalesce((v_redemption ->> 'success')::boolean, false) then
            return v_redemption;
        end if;

        v_points_discount_kobo := coalesce((v_redemption ->> 'discount_kobo')::bigint, 0);
        v_points_used := coalesce((v_redemption ->> 'points_used')::integer, 0);
    end if;

    v_total_kobo := greatest(v_subtotal_kobo - v_points_discount_kobo, 0) + greatest(coalesce(p_delivery_fee_kobo, 0), 0);

    if coalesce(v_wallet_balance, 0) < v_total_kobo then
        if v_points_used > 0 then
            perform public.restore_order_reward_point_redemption(v_order_id);
        end if;

        return jsonb_build_object('success', false, 'error', 'Insufficient wallet balance');
    end if;

    insert into public.orders (
        id,
        customer_id,
        merchant_id,
        total_amount,
        subtotal_amount_kobo,
        points_discount_kobo,
        points_redeemed,
        status,
        payment_status,
        delivery_location,
        payment_ref,
        delivery_fee_kobo,
        delivery_fee,
        contact_numbers
    )
    values (
        v_order_id,
        p_user_id,
        v_merchant_id,
        v_total_kobo,
        v_subtotal_kobo,
        v_points_discount_kobo,
        v_points_used,
        'awaiting_agent_acceptance',
        'paid',
        case
            when p_delivery_location is null then null
            else ST_SetSRID(ST_GeomFromGeoJSON(p_delivery_location), 4326)::geography
        end,
        v_payment_reference,
        greatest(coalesce(p_delivery_fee_kobo, 0), 0),
        greatest(coalesce(p_delivery_fee_kobo, 0), 0) / 100.0,
        coalesce(p_contact_numbers, '[]'::jsonb)
    );

    for v_item in
        select *
        from jsonb_to_recordset(p_items) as item(product_id uuid, quantity integer)
    loop
        select p.id, p.price
        into v_product
        from public.products p
        where p.id = v_item.product_id;

        insert into public.order_items (
            order_id,
            product_id,
            quantity,
            price_per_unit
        )
        values (
            v_order_id,
            v_item.product_id,
            v_item.quantity,
            v_product.price
        );

        perform public.consume_orderable_product_stock(v_item.product_id, v_item.quantity);
    end loop;

    update public.wallets
    set balance = balance - v_total_kobo
    where id = v_wallet_id;

    insert into public.wallet_transactions (
        wallet_id,
        amount,
        type,
        status,
        reference,
        description
    )
    values (
        v_wallet_id,
        v_total_kobo,
        'debit',
        'success',
        v_payment_reference,
        'Customer wallet payment for order ' || substr(v_order_id::text, 1, 8)
    );

    perform public.refresh_order_financials(v_order_id);

    perform public.assign_best_agent(
        v_order_id,
        p_user_id,
        'auto',
        'System auto assignment after paid order creation'
    );

    insert into public.order_assignments (
        order_id,
        assignment_role,
        assignee_id,
        assigned_by,
        method,
        reason,
        is_active
    )
    values (
        v_order_id,
        'merchant',
        v_merchant_id,
        p_user_id,
        'auto',
        'Merchant linked from ordered products',
        true
    );

    perform public.write_audit_log(
        p_user_id,
        'create_paid_order',
        'order',
        v_order_id,
        jsonb_build_object('payment_reference', v_payment_reference, 'merchant_id', v_merchant_id, 'points_used', v_points_used)
    );

    return jsonb_build_object('success', true, 'order_id', v_order_id, 'payment_reference', v_payment_reference);
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_paid_order_with_gift_card_unchecked(p_user_id uuid, p_items jsonb, p_delivery_location jsonb, p_delivery_fee_kobo bigint DEFAULT 0, p_contact_numbers jsonb DEFAULT '[]'::jsonb, p_payment_reference text DEFAULT NULL::text, p_points_to_redeem integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    v_actor uuid := auth.uid();
    v_order_id uuid := gen_random_uuid();
    v_item record;
    v_product record;
    v_validation jsonb;
    v_merchant_id uuid;
    v_subtotal_kobo bigint := 0;
    v_total_kobo bigint := 0;
    v_payment_reference text := coalesce(p_payment_reference, 'GFTPAY-' || encode(gen_random_bytes(8), 'hex'));
    v_available_kobo bigint := 0;
    v_remaining_to_apply bigint;
    v_debit_kobo bigint;
    v_gift_card record;
    v_redemption jsonb := jsonb_build_object('success', true, 'points_used', 0, 'discount_kobo', 0);
    v_points_discount_kobo bigint := 0;
    v_points_used integer := 0;
begin
    if v_actor is null then
        return jsonb_build_object('success', false, 'error', 'Authentication required');
    end if;

    if p_user_id is distinct from v_actor then
        return jsonb_build_object('success', false, 'error', 'You can only place orders for your own account');
    end if;

    if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
        return jsonb_build_object('success', false, 'error', 'Cart is empty');
    end if;

    perform public.process_reward_point_expiries(p_user_id);

    for v_item in
        select *
        from jsonb_to_recordset(p_items) as item(product_id uuid, quantity integer)
    loop
        v_validation := public.validate_orderable_product(v_item.product_id, v_item.quantity, true);

        if not coalesce((v_validation ->> 'success')::boolean, false) then
            return jsonb_build_object('success', false, 'error', coalesce(v_validation ->> 'error', 'Product validation failed'));
        end if;

        if v_merchant_id is null then
            v_merchant_id := (v_validation ->> 'merchant_id')::uuid;
        elsif v_merchant_id <> (v_validation ->> 'merchant_id')::uuid then
            return jsonb_build_object('success', false, 'error', 'Mixed merchant carts are not allowed');
        end if;

        v_subtotal_kobo := v_subtotal_kobo + (((v_validation ->> 'price_kobo')::bigint) * v_item.quantity);
    end loop;

    if coalesce(p_points_to_redeem, 0) > 0 then
        v_redemption := public.apply_reward_points_redemption(
            p_user_id,
            v_order_id,
            p_points_to_redeem,
            v_subtotal_kobo,
            false
        );

        if not coalesce((v_redemption ->> 'success')::boolean, false) then
            return v_redemption;
        end if;

        v_points_discount_kobo := coalesce((v_redemption ->> 'discount_kobo')::bigint, 0);
        v_points_used := coalesce((v_redemption ->> 'points_used')::integer, 0);
    end if;

    v_total_kobo := greatest(v_subtotal_kobo - v_points_discount_kobo, 0) + greatest(coalesce(p_delivery_fee_kobo, 0), 0);
    v_remaining_to_apply := v_total_kobo;

    for v_gift_card in
        select id, code, remaining_amount_kobo
        from public.gift_cards
        where recipient_id = p_user_id
          and status = 'active'
          and remaining_amount_kobo > 0
          and (expires_at is null or expires_at > now())
        order by expires_at asc nulls last, created_at asc
        for update
    loop
        v_available_kobo := v_available_kobo + v_gift_card.remaining_amount_kobo;
    end loop;

    if v_available_kobo < v_total_kobo then
        if v_points_used > 0 then
            perform public.restore_order_reward_point_redemption(v_order_id);
        end if;

        return jsonb_build_object('success', false, 'error', 'Insufficient gift card balance');
    end if;

    insert into public.orders (
        id,
        customer_id,
        merchant_id,
        total_amount,
        subtotal_amount_kobo,
        points_discount_kobo,
        points_redeemed,
        status,
        payment_status,
        delivery_location,
        payment_ref,
        delivery_fee_kobo,
        delivery_fee,
        contact_numbers
    )
    values (
        v_order_id,
        p_user_id,
        v_merchant_id,
        v_total_kobo,
        v_subtotal_kobo,
        v_points_discount_kobo,
        v_points_used,
        'awaiting_agent_acceptance',
        'paid',
        case
            when p_delivery_location is null then null
            else ST_SetSRID(ST_GeomFromGeoJSON(p_delivery_location), 4326)::geography
        end,
        v_payment_reference,
        greatest(coalesce(p_delivery_fee_kobo, 0), 0),
        greatest(coalesce(p_delivery_fee_kobo, 0), 0) / 100.0,
        coalesce(p_contact_numbers, '[]'::jsonb)
    );

    for v_item in
        select *
        from jsonb_to_recordset(p_items) as item(product_id uuid, quantity integer)
    loop
        select p.id, p.price
        into v_product
        from public.products p
        where p.id = v_item.product_id;

        insert into public.order_items (
            order_id,
            product_id,
            quantity,
            price_per_unit
        )
        values (
            v_order_id,
            v_item.product_id,
            v_item.quantity,
            v_product.price
        );

        perform public.consume_orderable_product_stock(v_item.product_id, v_item.quantity);
    end loop;

    for v_gift_card in
        select id, code, remaining_amount_kobo
        from public.gift_cards
        where recipient_id = p_user_id
          and status = 'active'
          and remaining_amount_kobo > 0
          and (expires_at is null or expires_at > now())
        order by expires_at asc nulls last, created_at asc
        for update
    loop
        exit when v_remaining_to_apply <= 0;

        v_debit_kobo := least(v_gift_card.remaining_amount_kobo, v_remaining_to_apply);

        update public.gift_cards
        set remaining_amount_kobo = remaining_amount_kobo - v_debit_kobo,
            status = case
                when remaining_amount_kobo - v_debit_kobo <= 0 then 'depleted'
                else 'active'
            end,
            last_used_at = now(),
            updated_at = now()
        where id = v_gift_card.id;

        insert into public.gift_card_transactions (
            gift_card_id,
            actor_id,
            transaction_type,
            amount_kobo,
            reference,
            description,
            metadata
        )
        values (
            v_gift_card.id,
            v_actor,
            'debit',
            v_debit_kobo,
            v_payment_reference,
            'Gift card applied to order ' || upper(substr(v_order_id::text, 1, 8)),
            jsonb_build_object('order_id', v_order_id, 'gift_card_code', v_gift_card.code)
        );

        v_remaining_to_apply := v_remaining_to_apply - v_debit_kobo;
    end loop;

    if v_remaining_to_apply > 0 then
        raise exception 'Gift card balance became unavailable during checkout';
    end if;

    perform public.refresh_order_financials(v_order_id);

    perform public.assign_best_agent(
        v_order_id,
        p_user_id,
        'auto',
        'System auto assignment after gift card payment'
    );

    insert into public.order_assignments (
        order_id,
        assignment_role,
        assignee_id,
        assigned_by,
        method,
        reason,
        is_active
    )
    values (
        v_order_id,
        'merchant',
        v_merchant_id,
        p_user_id,
        'auto',
        'Merchant linked from ordered products',
        true
    );

    perform public.create_notification(
        p_user_id,
        'Gift card applied',
        'Your gift card balance paid for order #' || upper(substr(v_order_id::text, 1, 8)) || '. Amount: ' || public.format_kobo_amount(v_total_kobo) || '.',
        'gift_card_debit',
        '/account/gift-card',
        jsonb_build_object('order_id', v_order_id, 'amount_kobo', v_total_kobo)
    );

    perform public.write_audit_log(
        p_user_id,
        'create_paid_order_with_gift_card',
        'order',
        v_order_id,
        jsonb_build_object('payment_reference', v_payment_reference, 'merchant_id', v_merchant_id, 'amount_kobo', v_total_kobo, 'points_used', v_points_used)
    );

    return jsonb_build_object('success', true, 'order_id', v_order_id, 'payment_reference', v_payment_reference);
end;
$function$;

CREATE OR REPLACE FUNCTION public.mark_pending_order_paid(p_order_id uuid, p_payment_reference text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    v_order public.orders;
    v_item record;
    v_validation jsonb;
    v_customer_wallet uuid;
    v_refund_id uuid;
begin
    select *
    into v_order
    from public.orders
    where id = p_order_id
    for update;

    if not found then
        return jsonb_build_object('success', false, 'error', 'Order not found');
    end if;

    if v_order.payment_status = 'paid' then
        update public.reward_point_redemptions
        set status = 'applied',
            updated_at = now()
        where order_id = p_order_id
          and status = 'reserved';

        return jsonb_build_object('success', true, 'order_id', p_order_id, 'message', 'Order already marked paid');
    end if;

    if v_order.payment_status = 'refunded' then
        return jsonb_build_object('success', true, 'order_id', p_order_id, 'message', 'Order already refunded');
    end if;

    if v_order.status <> 'pending' or v_order.payment_status <> 'pending' then
        return jsonb_build_object('success', false, 'error', 'Order is not awaiting payment');
    end if;

    for v_item in
        select oi.product_id, oi.quantity
        from public.order_items oi
        where oi.order_id = p_order_id
    loop
        v_validation := public.validate_orderable_product(v_item.product_id, v_item.quantity, true);

        if not coalesce((v_validation ->> 'success')::boolean, false) then
            v_customer_wallet := public.ensure_actor_wallet(v_order.customer_id, 'customer');

            insert into public.refunds (
                order_id,
                amount_kobo,
                reason,
                status,
                processed_at
            )
            values (
                p_order_id,
                v_order.total_amount,
                'Auto refund after direct payment could not be fulfilled',
                'processed',
                now()
            )
            returning id into v_refund_id;

            update public.wallets
            set balance = balance + v_order.total_amount
            where id = v_customer_wallet;

            insert into public.ledger_entries (wallet_id, amount, description, reference_id)
            values (v_customer_wallet, v_order.total_amount, 'Auto refund for unfulfillable direct payment order', p_order_id);

            update public.orders
            set payment_status = 'refunded',
                status = 'refunded',
                payment_ref = coalesce(p_payment_reference, v_order.payment_ref)
            where id = p_order_id;

            update public.order_financials
            set settlement_status = 'refunded',
                updated_at = now()
            where order_id = p_order_id;

            perform public.restore_order_reward_point_redemption(p_order_id);

            perform public.write_audit_log(
                null,
                'mark_direct_payment_success_auto_refund',
                'order',
                p_order_id,
                jsonb_build_object('payment_reference', coalesce(p_payment_reference, v_order.payment_ref), 'refund_id', v_refund_id)
            );

            return jsonb_build_object('success', true, 'order_id', p_order_id, 'auto_refunded', true);
        end if;
    end loop;

    for v_item in
        select oi.product_id, oi.quantity
        from public.order_items oi
        where oi.order_id = p_order_id
    loop
        perform public.consume_orderable_product_stock(v_item.product_id, v_item.quantity);
    end loop;

    update public.orders
    set payment_status = 'paid',
        status = 'awaiting_agent_acceptance',
        payment_ref = coalesce(p_payment_reference, v_order.payment_ref)
    where id = p_order_id;

    update public.reward_point_redemptions
    set status = 'applied',
        updated_at = now()
    where order_id = p_order_id
      and status = 'reserved';

    perform public.refresh_order_financials(p_order_id);

    perform public.assign_best_agent(
        p_order_id,
        null,
        'auto',
        'System auto assignment after direct payment confirmation'
    );

    perform public.write_audit_log(
        null,
        'mark_direct_payment_success',
        'order',
        p_order_id,
        jsonb_build_object('payment_reference', coalesce(p_payment_reference, v_order.payment_ref))
    );

    return jsonb_build_object('success', true, 'order_id', p_order_id);
end;
$function$;

create function public.assign_waiting_order_to_agent(p_order_id uuid, p_agent_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $function$
begin
    if auth.uid() is null or not public.jwt_has_any_role(array['admin', 'sub_admin', 'supa_admin']) then
        return jsonb_build_object('success', false, 'error', 'Admin access required');
    end if;
    perform 1 from public.orders
    where id = p_order_id and payment_status = 'paid' and status = 'awaiting_agent_acceptance' and assigned_agent_id is null
    for update;
    if not found then
        return jsonb_build_object('success', false, 'error', 'This order is no longer waiting for an agent');
    end if;
    return public.override_order_assignment(p_order_id, 'agent', p_agent_id, 'Assigned from the agent queue');
end;
$function$;
revoke all on function public.assign_waiting_order_to_agent(uuid, uuid) from public, anon;
grant execute on function public.assign_waiting_order_to_agent(uuid, uuid) to authenticated;
