-- A null rate identifies an order placed before checkout began locking commissions.
alter table public.orders add column agent_commission_bps integer
    check (agent_commission_bps between 0 and 10000);

-- Serialize checkout with admin rate changes. The lock lasts through payment/order creation.
create function public.lock_checkout_agent_commission()
returns integer
language sql
set search_path = ''
as $$
    select proposed_commission_bps from public.agent_assignment_settings where singleton for share;
$$;
revoke execute on function public.lock_checkout_agent_commission() from public, anon, authenticated;

-- Only replace the embedded agent fee. Delivery and the other price components are independent.
create function public.checkout_item_price(p_product_id uuid, p_commission_bps integer)
returns bigint
language sql stable
set search_path = ''
as $$
    select case when s.id is null then null else
        greatest(0, p.price::bigint
            + round(s.merchant_reference_kobo * p_commission_bps / 10000.0)::bigint
            - round(s.merchant_reference_kobo * s.agent_fee_bps / 10000.0)::bigint) end
    from public.products p
    left join public.product_pricing_snapshots s on s.id = p.active_pricing_id
    where p.id = p_product_id;
$$;
revoke execute on function public.checkout_item_price(uuid, integer) from public, anon, authenticated;

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
    v_unit_price bigint;
    v_commission_bps integer;
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

    v_commission_bps := public.lock_checkout_agent_commission();
    if v_commission_bps is null then
        raise exception 'Could not load checkout prices. Please try again.';
    end if;

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

        v_unit_price := public.checkout_item_price(v_item.product_id, v_commission_bps);
        if v_unit_price is null then
            raise exception 'A product in your cart is missing approved pricing.';
        end if;
        v_subtotal_kobo := v_subtotal_kobo + v_unit_price * v_item.quantity;
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
        agent_commission_bps,
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
        v_commission_bps,
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
            public.checkout_item_price(v_item.product_id, v_commission_bps)
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
    v_unit_price bigint;
    v_commission_bps integer;
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

    v_commission_bps := public.lock_checkout_agent_commission();
    if v_commission_bps is null then
        raise exception 'Could not load checkout prices. Please try again.';
    end if;

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

        v_unit_price := public.checkout_item_price(v_item.product_id, v_commission_bps);
        if v_unit_price is null then
            raise exception 'A product in your cart is missing approved pricing.';
        end if;
        v_subtotal_kobo := v_subtotal_kobo + v_unit_price * v_item.quantity;
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
        agent_commission_bps,
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
        v_commission_bps,
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
            public.checkout_item_price(v_item.product_id, v_commission_bps)
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

CREATE OR REPLACE FUNCTION public.create_pending_order_unchecked(p_user_id uuid, p_items jsonb, p_delivery_location jsonb, p_delivery_fee_kobo bigint DEFAULT 0, p_contact_numbers jsonb DEFAULT '[]'::jsonb, p_payment_reference text DEFAULT NULL::text, p_points_to_redeem integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    v_actor uuid := auth.uid();
    v_order_id uuid := gen_random_uuid();
    v_item record;
    v_unit_price bigint;
    v_commission_bps integer;
    v_validation jsonb;
    v_merchant_id uuid;
    v_subtotal_kobo bigint := 0;
    v_total_kobo bigint := 0;
    v_payment_reference text := coalesce(p_payment_reference, 'ORD-' || encode(gen_random_bytes(8), 'hex'));
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

    v_commission_bps := public.lock_checkout_agent_commission();
    if v_commission_bps is null then
        raise exception 'Could not load checkout prices. Please try again.';
    end if;

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

        v_unit_price := public.checkout_item_price(v_item.product_id, v_commission_bps);
        if v_unit_price is null then
            raise exception 'A product in your cart is missing approved pricing.';
        end if;
        v_subtotal_kobo := v_subtotal_kobo + v_unit_price * v_item.quantity;
    end loop;

    if coalesce(p_points_to_redeem, 0) > 0 then
        v_redemption := public.apply_reward_points_redemption(
            p_user_id,
            v_order_id,
            p_points_to_redeem,
            v_subtotal_kobo,
            true
        );

        if not coalesce((v_redemption ->> 'success')::boolean, false) then
            return v_redemption;
        end if;

        v_points_discount_kobo := coalesce((v_redemption ->> 'discount_kobo')::bigint, 0);
        v_points_used := coalesce((v_redemption ->> 'points_used')::integer, 0);
    end if;

    v_total_kobo := greatest(v_subtotal_kobo - v_points_discount_kobo, 0) + greatest(coalesce(p_delivery_fee_kobo, 0), 0);

    insert into public.orders (
        id,
        customer_id,
        merchant_id,
        total_amount,
        subtotal_amount_kobo,
        agent_commission_bps,
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
        v_commission_bps,
        v_points_discount_kobo,
        v_points_used,
        'pending',
        'pending',
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
            public.checkout_item_price(v_item.product_id, v_commission_bps)
        );
    end loop;

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

    perform public.refresh_order_financials(v_order_id);

    perform public.write_audit_log(
        p_user_id,
        'create_pending_order',
        'order',
        v_order_id,
        jsonb_build_object('payment_reference', v_payment_reference, 'merchant_id', v_merchant_id, 'points_used', v_points_used)
    );

    return jsonb_build_object(
        'success',
        true,
        'order_id',
        v_order_id,
        'payment_reference',
        v_payment_reference,
        'points_used',
        v_points_used,
        'points_discount_kobo',
        v_points_discount_kobo
    );
end;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_order_financials(p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
    v_order record;
    v_item record;
    v_delivery jsonb;
    v_platform jsonb;
    v_rider_share_bps integer;
    v_delivery_total_kobo bigint;
    v_rider_share_kobo bigint;
    v_corporate_delivery_share_kobo bigint;
    v_delivery_base_kobo bigint;
    v_delivery_distance_kobo bigint;
    v_merchant_total bigint := 0;
    v_agent_total bigint := 0;
    v_app_total bigint := 0;
    v_ops_total bigint := 0;
    v_insurance_total bigint := 0;
    v_vat_total bigint := 0;
    v_grand_total bigint := 0;
    v_snapshot record;
    v_base_unit bigint;
    v_agent_unit bigint;
    v_app_unit bigint;
    v_ops_unit bigint;
    v_insurance_unit bigint;
    v_vat_unit bigint;
    v_approved_unit bigint;
    v_delta bigint;
begin
    select * into v_order from public.orders where id = p_order_id for update;
    if not found then
        return jsonb_build_object('success', false, 'error', 'Order not found');
    end if;

    -- New orders are priced once, before any external payment or handoff.
    if v_order.agent_commission_bps is not null and exists (
        select 1 from public.order_financials where order_id = p_order_id
    ) then
        return jsonb_build_object('success', true, 'order_id', p_order_id);
    end if;

    v_platform := public.get_platform_financial_settings();
    v_delivery := public.get_delivery_settings();

    delete from public.order_item_financials where order_id = p_order_id;

    for v_item in
        select oi.id as order_item_id, oi.order_id, oi.product_id, oi.quantity, oi.price_per_unit, p.merchant_id, p.active_pricing_id
        from public.order_items oi
        join public.products p on p.id = oi.product_id
        where oi.order_id = p_order_id
    loop
        select * into v_snapshot from public.product_pricing_snapshots where id = coalesce(v_item.active_pricing_id, (select active_pricing_id from public.products where id = v_item.product_id));
        v_base_unit := coalesce(v_snapshot.merchant_reference_kobo, v_item.price_per_unit);
        v_approved_unit := case when v_order.agent_commission_bps is not null then v_item.price_per_unit
            else greatest(v_item.price_per_unit, coalesce(v_snapshot.approved_price_kobo, v_item.price_per_unit)) end;
        v_agent_unit := round((v_base_unit * coalesce(v_order.agent_commission_bps, v_snapshot.agent_fee_bps, (v_platform ->> 'agent_fee_bps')::integer))::numeric / 10000.0)::bigint;
        v_app_unit := round((v_base_unit * coalesce(v_snapshot.app_fee_bps, (v_platform ->> 'app_fee_bps')::integer))::numeric / 10000.0)::bigint;
        v_ops_unit := round((v_base_unit * coalesce(v_snapshot.ops_fee_bps, (v_platform ->> 'ops_fee_bps')::integer))::numeric / 10000.0)::bigint;
        v_insurance_unit := coalesce(v_snapshot.insurance_kobo, (v_platform ->> 'insurance_default_kobo')::bigint, 0);
        v_vat_unit := round((v_base_unit * coalesce(v_snapshot.vat_bps, (v_platform ->> 'vat_bps')::integer))::numeric / 10000.0)::bigint;
        v_delta := v_approved_unit - (v_base_unit + v_agent_unit + v_app_unit + v_ops_unit + v_insurance_unit + v_vat_unit);
        v_app_unit := greatest(0, v_app_unit + v_delta);

        insert into public.order_item_financials (order_item_id, order_id, product_id, merchant_id, merchant_base_unit_kobo, merchant_base_line_kobo, agent_fee_line_kobo, app_fee_line_kobo, ops_fee_line_kobo, insurance_line_kobo, vat_line_kobo, approved_price_unit_kobo, approved_price_line_kobo)
        values (v_item.order_item_id, p_order_id, v_item.product_id, v_item.merchant_id, v_base_unit, v_base_unit * v_item.quantity, v_agent_unit * v_item.quantity, v_app_unit * v_item.quantity, v_ops_unit * v_item.quantity, v_insurance_unit * v_item.quantity, v_vat_unit * v_item.quantity, v_approved_unit, v_approved_unit * v_item.quantity);

        v_merchant_total := v_merchant_total + (v_base_unit * v_item.quantity);
        v_agent_total := v_agent_total + (v_agent_unit * v_item.quantity);
        v_app_total := v_app_total + (v_app_unit * v_item.quantity);
        v_ops_total := v_ops_total + (v_ops_unit * v_item.quantity);
        v_insurance_total := v_insurance_total + (v_insurance_unit * v_item.quantity);
        v_vat_total := v_vat_total + (v_vat_unit * v_item.quantity);
        v_grand_total := v_grand_total + (v_approved_unit * v_item.quantity);
    end loop;

    v_delivery_total_kobo := coalesce(v_order.delivery_fee_kobo, 0);
    v_delivery_base_kobo := least(coalesce((v_delivery ->> 'base_fare_kobo')::bigint, 0), v_delivery_total_kobo);
    v_delivery_distance_kobo := greatest(v_delivery_total_kobo - v_delivery_base_kobo, 0);
    v_rider_share_bps := coalesce((v_delivery ->> 'rider_share_bps')::integer, 8000);
    v_rider_share_kobo := round((v_delivery_total_kobo * v_rider_share_bps)::numeric / 10000.0)::bigint;
    v_corporate_delivery_share_kobo := greatest(v_delivery_total_kobo - v_rider_share_kobo, 0);
    v_grand_total := v_grand_total + v_delivery_total_kobo;

    insert into public.order_financials (order_id, merchant_base_total_kobo, agent_fee_total_kobo, app_fee_total_kobo, ops_fee_total_kobo, insurance_total_kobo, vat_total_kobo, delivery_base_fare_kobo, delivery_distance_fee_kobo, delivery_total_kobo, rider_share_kobo, corporate_delivery_share_kobo, grand_total_kobo, settlement_status, updated_at)
    values (p_order_id, v_merchant_total, v_agent_total, v_app_total, v_ops_total, v_insurance_total, v_vat_total, v_delivery_base_kobo, v_delivery_distance_kobo, v_delivery_total_kobo, v_rider_share_kobo, v_corporate_delivery_share_kobo, v_grand_total, 'pending', now())
    on conflict (order_id) do update set merchant_base_total_kobo = excluded.merchant_base_total_kobo, agent_fee_total_kobo = excluded.agent_fee_total_kobo, app_fee_total_kobo = excluded.app_fee_total_kobo, ops_fee_total_kobo = excluded.ops_fee_total_kobo, insurance_total_kobo = excluded.insurance_total_kobo, vat_total_kobo = excluded.vat_total_kobo, delivery_base_fare_kobo = excluded.delivery_base_fare_kobo, delivery_distance_fee_kobo = excluded.delivery_distance_fee_kobo, delivery_total_kobo = excluded.delivery_total_kobo, rider_share_kobo = excluded.rider_share_kobo, corporate_delivery_share_kobo = excluded.corporate_delivery_share_kobo, grand_total_kobo = excluded.grand_total_kobo, updated_at = now();

    return jsonb_build_object('success', true, 'order_id', p_order_id);
end;
$function$;

CREATE OR REPLACE FUNCTION public.delivery_checkout_plan(p_address_id uuid, p_items jsonb)
 RETURNS TABLE(merchant_id uuid, store_name text, items jsonb, fee bigint, subtotal bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
    v_address public.delivery_addresses;
    v_point jsonb;
    v_commission_bps integer;
begin
    select * into v_address from public.delivery_addresses
    where id = p_address_id and customer_id = auth.uid();
    if not found then
        raise exception 'Choose a saved delivery address.';
    end if;
    if p_items is null or jsonb_typeof(p_items) is distinct from 'array' then
        raise exception 'Cart is empty.';
    end if;
    if jsonb_array_length(p_items) not between 1 and 100 then
        raise exception 'Your cart must have between 1 and 100 different items.';
    end if;
    if exists (
        select 1 from jsonb_to_recordset(p_items) as line(product_id uuid, quantity integer)
        left join public.products p on p.id = line.product_id
        where p.id is null or p.merchant_id is null or p.status is distinct from 'approved'
            or p.active_pricing_id is null or line.quantity is null or line.quantity <= 0
    ) or (select count(distinct line.product_id)
          from jsonb_to_recordset(p_items) as line(product_id uuid)) <> jsonb_array_length(p_items) then
        raise exception 'One or more cart items are unavailable. Check your cart and try again.';
    end if;

    select proposed_commission_bps into strict v_commission_bps
    from public.agent_assignment_settings where singleton;

    v_point := st_asgeojson(v_address.location::geometry, 15)::jsonb;
    return query
    with stores as (
        select p.merchant_id, max(m.store_name)::text as name,
            jsonb_agg(jsonb_build_object('product_id', p.id, 'quantity', line.quantity, 'price', price.unit_kobo,
                'agent_price_adjustment', price.unit_kobo - p.price) order by p.id) as lines,
            sum(price.unit_kobo * line.quantity)::bigint as amount
        from jsonb_to_recordset(p_items) as line(product_id uuid, quantity integer)
        join public.products p on p.id = line.product_id
        cross join lateral (select public.checkout_item_price(p.id, v_commission_bps) as unit_kobo) price
        left join public.merchants m on m.id = p.merchant_id
        group by p.merchant_id
    )
    select stores.merchant_id, coalesce(nullif(trim(stores.name), ''), 'Store'), stores.lines,
        public.calculate_order_delivery_fee_from_items(stores.lines, v_point), stores.amount
    from stores order by stores.merchant_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.checkout_delivery_address(p_address_id uuid, p_items jsonb, p_quoted_fee bigint, p_quoted_subtotal bigint, p_contacts jsonb, p_points integer, p_method text, p_attempt_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
    v_user uuid := auth.uid();
    v_address public.delivery_addresses;
    v_point jsonb;
    v_result jsonb;
    v_plan jsonb;
    v_group record;
    v_existing public.delivery_checkout_groups;
    v_fee bigint;
    v_subtotal bigint;
    v_total bigint;
    v_ids uuid[] := '{}';
    v_order_id uuid;
    v_reference text;
    v_previous_defer text;
begin
    if v_user is null or p_attempt_id is null or p_method is null or p_method not in ('wallet','gift','direct') then
        return jsonb_build_object('success', false, 'error', 'Sign in and choose a payment method.');
    end if;

    perform pg_advisory_xact_lock(hashtextextended('rss-checkout:' || v_user::text || ':' || p_attempt_id::text, 0));
    select * into v_existing from public.delivery_checkout_groups where id = p_attempt_id and customer_id = v_user;
    if found then
        if v_existing.method <> p_method then
            return jsonb_build_object('success', false, 'error', 'This checkout already used a different payment method.');
        end if;
        return jsonb_build_object('success', true, 'order_id', v_existing.order_ids[1],
            'group_id', v_existing.id, 'payment_reference', v_existing.payment_reference, 'total_kobo', v_existing.total_kobo);
    end if;

    select * into v_address from public.delivery_addresses where id = p_address_id and customer_id = v_user for share;
    if not found then
        return jsonb_build_object('success', false, 'error', 'Choose a saved delivery address and try again.');
    end if;

    if public.lock_checkout_agent_commission() is null then
        raise exception 'Could not load checkout prices. Please try again.';
    end if;

    -- Prevent price or stock changes between checking the quote and creating its orders.
    perform p.id from public.products p
    join jsonb_to_recordset(p_items) as line(product_id uuid) on p.id = line.product_id
    order by p.id for update of p;

    select jsonb_agg(to_jsonb(g) order by g.merchant_id), sum(g.fee), sum(g.subtotal)
    into v_plan, v_fee, v_subtotal
    from public.delivery_checkout_plan(p_address_id, p_items) g;
    if v_fee is distinct from p_quoted_fee or v_subtotal is distinct from p_quoted_subtotal then
        return jsonb_build_object('success', false, 'error', 'Your cart total changed. Review the updated prices before paying.');
    end if;
    if jsonb_array_length(v_plan) > 1 and coalesce(p_points, 0) > 0 then
        return jsonb_build_object('success', false, 'error', 'Reward points can be used on orders from one store.');
    end if;

    v_point := st_asgeojson(v_address.location::geometry, 15)::jsonb;
    perform set_config('rss.delivery_address_label', v_address.address, true);
    v_reference := case when p_method = 'direct' then 'ORD-' || p_attempt_id::text end;

    v_previous_defer := current_setting('rss.defer_checkout_agent', true);
    if jsonb_array_length(v_plan) > 1 then
        perform set_config('rss.defer_checkout_agent', 'true', true);
    end if;

    for v_group in select * from jsonb_to_recordset(v_plan) as g(merchant_id uuid, items jsonb, fee bigint)
    loop
        case p_method
            when 'wallet' then
                v_result := public.create_paid_order(v_user, v_group.items, v_point, v_group.fee, p_contacts, null, p_points);
            when 'gift' then
                v_result := public.create_paid_order_with_gift_card(v_user, v_group.items, v_point, v_group.fee, p_contacts, null, p_points);
            when 'direct' then
                v_result := public.create_pending_order(v_user, v_group.items, v_point, v_group.fee, p_contacts,
                    case when cardinality(v_ids) = 0 then v_reference
                        else v_reference || '-' || (cardinality(v_ids) + 1)::text end, p_points);
        end case;
        if not coalesce((v_result->>'success')::boolean, false) then
            -- An exception rolls back every merchant order and any wallet or stock changes.
            raise exception using errcode = 'P0001', message = coalesce(v_result->>'error', 'Checkout could not be completed.');
        end if;
        v_order_id := (v_result->>'order_id')::uuid;
        v_ids := array_append(v_ids, v_order_id);
    end loop;

    perform set_config('rss.delivery_address_label', '', true);
    perform set_config('rss.defer_checkout_agent', coalesce(v_previous_defer, ''), true);
    select sum(total_amount)::bigint into v_total from public.orders where id = any(v_ids);
    insert into public.delivery_checkout_groups (id, customer_id, method, payment_reference, order_ids, total_kobo, payment_processed)
    values (p_attempt_id, v_user, p_method, v_reference, v_ids, v_total, p_method <> 'direct');
    if cardinality(v_ids) > 1 then
        update public.orders set agent_checkout_group_id = p_attempt_id where id = any(v_ids);
        if p_method <> 'direct' then
            perform public.offer_checkout_to_agent(p_attempt_id);
        end if;
    end if;
    return jsonb_build_object('success', true, 'order_id', v_ids[1], 'group_id', p_attempt_id,
        'payment_reference', v_reference, 'total_kobo', v_total);
exception when raise_exception then
    return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$function$;
