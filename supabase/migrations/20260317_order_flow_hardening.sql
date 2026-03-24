alter table public.order_disputes
    add column if not exists previous_order_status public.order_status,
    add column if not exists previous_settlement_status public.settlement_status;

create or replace function public.create_paid_order(
    p_user_id uuid,
    p_items jsonb,
    p_delivery_location jsonb,
    p_delivery_fee_kobo bigint default 0,
    p_contact_numbers jsonb default '[]'::jsonb,
    p_payment_reference text default null
)
returns jsonb
language plpgsql
security definer
as $function$
declare
    v_actor uuid := auth.uid();
    v_wallet_id uuid;
    v_wallet_balance bigint;
    v_order_id uuid;
    v_item record;
    v_product record;
    v_merchant_id uuid;
    v_total_kobo bigint := 0;
    v_payment_reference text := coalesce(p_payment_reference, 'WAL-' || encode(gen_random_bytes(8), 'hex'));
    v_assigned_agent_id uuid;
begin
    if v_actor is null then
        return jsonb_build_object('success', false, 'error', 'Authentication required');
    end if;

    if p_user_id is distinct from v_actor then
        return jsonb_build_object('success', false, 'error', 'You can only place orders for your own account');
    end if;

    if not exists (
        select 1
        from public.agent_profiles ap
        where ap.status = 'approved'
    ) then
        return jsonb_build_object('success', false, 'error', 'No approved agents are currently available');
    end if;

    if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
        return jsonb_build_object('success', false, 'error', 'Cart is empty');
    end if;

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
        if coalesce(v_item.quantity, 0) <= 0 then
            return jsonb_build_object('success', false, 'error', 'Invalid quantity in cart');
        end if;

        select p.id, p.name, p.price, p.stock_level, p.merchant_id
        into v_product
        from public.products p
        where p.id = v_item.product_id
          and p.status = 'approved'
        for update;

        if v_product.id is null then
            return jsonb_build_object('success', false, 'error', 'Product not found or not approved');
        end if;

        if coalesce(v_product.stock_level, 0) < v_item.quantity then
            return jsonb_build_object('success', false, 'error', 'Insufficient stock for ' || v_product.name);
        end if;

        if v_merchant_id is null then
            v_merchant_id := v_product.merchant_id;
        elsif v_merchant_id <> v_product.merchant_id then
            return jsonb_build_object('success', false, 'error', 'Mixed merchant carts are not allowed');
        end if;

        v_total_kobo := v_total_kobo + (v_product.price * v_item.quantity);
    end loop;

    v_total_kobo := v_total_kobo + greatest(coalesce(p_delivery_fee_kobo, 0), 0);

    if coalesce(v_wallet_balance, 0) < v_total_kobo then
        return jsonb_build_object('success', false, 'error', 'Insufficient wallet balance');
    end if;

    insert into public.orders (
        customer_id,
        merchant_id,
        total_amount,
        status,
        payment_status,
        delivery_location,
        payment_ref,
        delivery_fee_kobo,
        delivery_fee,
        contact_numbers
    )
    values (
        p_user_id,
        v_merchant_id,
        v_total_kobo,
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
    )
    returning id into v_order_id;

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

        update public.products
        set stock_level = greatest(coalesce(stock_level, 0) - v_item.quantity, 0)
        where id = v_item.product_id;
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

    v_assigned_agent_id := public.assign_best_agent(
        v_order_id,
        p_user_id,
        'auto',
        'System auto assignment after paid order creation'
    );

    if v_assigned_agent_id is null then
        raise exception 'No approved agents are currently available';
    end if;

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
        jsonb_build_object('payment_reference', v_payment_reference, 'merchant_id', v_merchant_id)
    );

    return jsonb_build_object('success', true, 'order_id', v_order_id, 'payment_reference', v_payment_reference);
end;
$function$;

create or replace function public.create_pending_order(
    p_user_id uuid,
    p_items jsonb,
    p_delivery_location jsonb,
    p_delivery_fee_kobo bigint default 0,
    p_contact_numbers jsonb default '[]'::jsonb,
    p_payment_reference text default null
)
returns jsonb
language plpgsql
security definer
as $function$
declare
    v_actor uuid := auth.uid();
    v_order_id uuid;
    v_item record;
    v_product record;
    v_merchant_id uuid;
    v_total_kobo bigint := 0;
    v_payment_reference text := coalesce(p_payment_reference, 'ORD-' || encode(gen_random_bytes(8), 'hex'));
begin
    if v_actor is null then
        return jsonb_build_object('success', false, 'error', 'Authentication required');
    end if;

    if p_user_id is distinct from v_actor then
        return jsonb_build_object('success', false, 'error', 'You can only place orders for your own account');
    end if;

    if not exists (
        select 1
        from public.agent_profiles ap
        where ap.status = 'approved'
    ) then
        return jsonb_build_object('success', false, 'error', 'No approved agents are currently available');
    end if;

    if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
        return jsonb_build_object('success', false, 'error', 'Cart is empty');
    end if;

    for v_item in
        select *
        from jsonb_to_recordset(p_items) as item(product_id uuid, quantity integer)
    loop
        if coalesce(v_item.quantity, 0) <= 0 then
            return jsonb_build_object('success', false, 'error', 'Invalid quantity in cart');
        end if;

        select p.id, p.name, p.price, p.merchant_id, p.status, p.stock_level
        into v_product
        from public.products p
        where p.id = v_item.product_id
          and p.status = 'approved';

        if v_product.id is null then
            return jsonb_build_object('success', false, 'error', 'Product not found or not approved');
        end if;

        if coalesce(v_product.stock_level, 0) < v_item.quantity then
            return jsonb_build_object('success', false, 'error', 'Insufficient stock for ' || v_product.name);
        end if;

        if v_merchant_id is null then
            v_merchant_id := v_product.merchant_id;
        elsif v_merchant_id <> v_product.merchant_id then
            return jsonb_build_object('success', false, 'error', 'Mixed merchant carts are not allowed');
        end if;

        v_total_kobo := v_total_kobo + (v_product.price * v_item.quantity);
    end loop;

    v_total_kobo := v_total_kobo + greatest(coalesce(p_delivery_fee_kobo, 0), 0);

    insert into public.orders (
        customer_id,
        merchant_id,
        total_amount,
        status,
        payment_status,
        delivery_location,
        payment_ref,
        delivery_fee_kobo,
        delivery_fee,
        contact_numbers
    )
    values (
        p_user_id,
        v_merchant_id,
        v_total_kobo,
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
    )
    returning id into v_order_id;

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

    perform public.write_audit_log(
        p_user_id,
        'create_pending_order',
        'order',
        v_order_id,
        jsonb_build_object('payment_reference', v_payment_reference, 'merchant_id', v_merchant_id)
    );

    return jsonb_build_object(
        'success',
        true,
        'order_id',
        v_order_id,
        'payment_reference',
        v_payment_reference
    );
end;
$function$;

create or replace function public.mark_direct_payment_success(
    p_order_id uuid,
    p_payment_reference text
)
returns jsonb
language plpgsql
security definer
as $function$
declare
    v_order record;
    v_item record;
    v_product record;
    v_customer_wallet uuid;
    v_refund_id uuid;
    v_assigned_agent_id uuid;
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
        return jsonb_build_object('success', true, 'message', 'Order already marked paid');
    end if;

    if v_order.payment_status = 'refunded' then
        return jsonb_build_object('success', true, 'message', 'Order already refunded');
    end if;

    for v_item in
        select oi.product_id, oi.quantity
        from public.order_items oi
        where oi.order_id = p_order_id
    loop
        select p.id, p.name, p.stock_level
        into v_product
        from public.products p
        where p.id = v_item.product_id
        for update;

        if v_product.id is null or coalesce(v_product.stock_level, 0) < v_item.quantity then
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
        update public.products
        set stock_level = greatest(coalesce(stock_level, 0) - v_item.quantity, 0)
        where id = v_item.product_id;
    end loop;

    update public.orders
    set payment_status = 'paid',
        status = 'awaiting_agent_acceptance',
        payment_ref = coalesce(p_payment_reference, v_order.payment_ref)
    where id = p_order_id;

    perform public.refresh_order_financials(p_order_id);

    v_assigned_agent_id := public.assign_best_agent(
        p_order_id,
        null,
        'auto',
        'System auto assignment after direct payment confirmation'
    );

    if v_assigned_agent_id is null then
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
            'Auto refund after direct payment because no approved agent was available',
            'processed',
            now()
        )
        returning id into v_refund_id;

        update public.wallets
        set balance = balance + v_order.total_amount
        where id = v_customer_wallet;

        insert into public.ledger_entries (wallet_id, amount, description, reference_id)
        values (v_customer_wallet, v_order.total_amount, 'Auto refund for direct payment order without available agent', p_order_id);

        update public.orders
        set payment_status = 'refunded',
            status = 'refunded'
        where id = p_order_id;

        update public.order_financials
        set settlement_status = 'refunded',
            updated_at = now()
        where order_id = p_order_id;

        perform public.write_audit_log(
            null,
            'mark_direct_payment_success_auto_refund',
            'order',
            p_order_id,
            jsonb_build_object('payment_reference', coalesce(p_payment_reference, v_order.payment_ref), 'refund_id', v_refund_id, 'reason', 'no_agent_available')
        );

        return jsonb_build_object('success', true, 'order_id', p_order_id, 'auto_refunded', true);
    end if;

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

create or replace function public.open_order_dispute(
    p_order_id uuid,
    p_reason text
)
returns jsonb
language plpgsql
security definer
as $function$
declare
    v_actor uuid := auth.uid();
    v_order record;
    v_dispute_id uuid;
begin
    if v_actor is null then
        return jsonb_build_object('success', false, 'error', 'Authentication required');
    end if;

    select
        o.*,
        ofn.settlement_status as current_settlement_status
    into v_order
    from public.orders o
    left join public.order_financials ofn on ofn.order_id = o.id
    where o.id = p_order_id
    for update;

    if not found then
        return jsonb_build_object('success', false, 'error', 'Order not found');
    end if;

    if not (
        v_order.customer_id = v_actor
        or v_order.merchant_id = v_actor
        or v_order.assigned_agent_id = v_actor
        or v_order.rider_id = v_actor
        or public.jwt_has_any_role(array['admin', 'sub_admin', 'supa_admin'])
    ) then
        return jsonb_build_object('success', false, 'error', 'You cannot open a dispute for this order');
    end if;

    if v_order.status in ('refunded', 'cancelled') then
        return jsonb_build_object('success', false, 'error', 'This order can no longer be disputed');
    end if;

    if nullif(btrim(coalesce(p_reason, '')), '') is null then
        return jsonb_build_object('success', false, 'error', 'A dispute reason is required');
    end if;

    if exists (
        select 1
        from public.order_disputes od
        where od.order_id = p_order_id
          and od.status in ('open', 'investigating')
    ) then
        return jsonb_build_object('success', false, 'error', 'An active dispute already exists for this order');
    end if;

    insert into public.order_disputes (
        order_id,
        raised_by,
        reason,
        previous_order_status,
        previous_settlement_status
    )
    values (
        p_order_id,
        v_actor,
        btrim(p_reason),
        v_order.status,
        coalesce(v_order.current_settlement_status, 'pending')
    )
    returning id into v_dispute_id;

    if v_order.status not in ('completed', 'refunded') then
        update public.orders
        set status = 'disputed'
        where id = p_order_id;
    end if;

    update public.order_financials
    set settlement_status = 'disputed',
        updated_at = now()
    where order_id = p_order_id;

    perform public.write_audit_log(
        v_actor,
        'open_order_dispute',
        'order',
        p_order_id,
        jsonb_build_object('dispute_id', v_dispute_id, 'reason', btrim(p_reason))
    );

    return jsonb_build_object('success', true, 'dispute_id', v_dispute_id);
end;
$function$;

create or replace function public.create_refund(
    p_order_id uuid,
    p_amount_kobo bigint,
    p_reason text
)
returns jsonb
language plpgsql
security definer
as $function$
declare
    v_actor uuid := auth.uid();
    v_order record;
    v_existing_refund_total bigint;
    v_refund_id uuid;
begin
    if not public.jwt_has_any_role(array['admin', 'sub_admin', 'supa_admin']) then
        return jsonb_build_object('success', false, 'error', 'Admin access required');
    end if;

    select id, total_amount, payment_status, status
    into v_order
    from public.orders
    where id = p_order_id
    for update;

    if not found then
        return jsonb_build_object('success', false, 'error', 'Order not found');
    end if;

    if nullif(btrim(coalesce(p_reason, '')), '') is null then
        return jsonb_build_object('success', false, 'error', 'A refund reason is required');
    end if;

    if coalesce(p_amount_kobo, 0) <= 0 then
        return jsonb_build_object('success', false, 'error', 'Refund amount must be greater than zero');
    end if;

    if p_amount_kobo <> v_order.total_amount then
        return jsonb_build_object('success', false, 'error', 'Only full-order refunds are currently supported');
    end if;

    if v_order.payment_status = 'refunded' or v_order.status = 'refunded' then
        return jsonb_build_object('success', false, 'error', 'Order has already been refunded');
    end if;

    select coalesce(sum(r.amount_kobo), 0)
    into v_existing_refund_total
    from public.refunds r
    where r.order_id = p_order_id
      and r.status in ('pending', 'approved', 'processed');

    if v_existing_refund_total > 0 then
        return jsonb_build_object('success', false, 'error', 'A refund already exists for this order');
    end if;

    insert into public.refunds (order_id, amount_kobo, reason, status)
    values (p_order_id, p_amount_kobo, btrim(p_reason), 'approved')
    returning id into v_refund_id;

    perform public.write_audit_log(
        v_actor,
        'create_refund',
        'refund',
        v_refund_id,
        jsonb_build_object('order_id', p_order_id, 'amount_kobo', p_amount_kobo)
    );

    return jsonb_build_object('success', true, 'refund_id', v_refund_id);
end;
$function$;

create or replace function public.process_refund(p_refund_id uuid)
returns jsonb
language plpgsql
security definer
as $function$
declare
    v_actor uuid := auth.uid();
    v_refund record;
    v_order record;
    v_financials record;
    v_customer_wallet uuid;
    v_merchant_wallet uuid;
    v_agent_wallet uuid;
    v_rider_wallet uuid;
    v_corporate_wallet record;
    v_merchant_balance bigint := 0;
    v_agent_balance bigint := 0;
    v_rider_balance bigint := 0;
    v_corporate_revenue_kobo bigint := 0;
    v_vat_kobo bigint := 0;
    v_requires_payout_reversal boolean := false;
begin
    if not public.jwt_has_any_role(array['admin', 'sub_admin', 'supa_admin']) then
        return jsonb_build_object('success', false, 'error', 'Admin access required');
    end if;

    select *
    into v_refund
    from public.refunds
    where id = p_refund_id
    for update;

    if not found then
        return jsonb_build_object('success', false, 'error', 'Refund not found');
    end if;

    if v_refund.status = 'processed' then
        return jsonb_build_object('success', true, 'message', 'Refund already processed');
    end if;

    select *
    into v_order
    from public.orders
    where id = v_refund.order_id
    for update;

    if not found then
        return jsonb_build_object('success', false, 'error', 'Order not found');
    end if;

    if v_refund.amount_kobo <> v_order.total_amount then
        return jsonb_build_object('success', false, 'error', 'Only full-order refunds are currently supported');
    end if;

    select *
    into v_financials
    from public.order_financials
    where order_id = v_refund.order_id
    for update;

    v_requires_payout_reversal := coalesce(v_financials.settled_at is not null, false) or v_order.delivery_verified_at is not null;
    v_customer_wallet := public.ensure_actor_wallet(v_order.customer_id, 'customer');

    if v_requires_payout_reversal then
        v_corporate_revenue_kobo :=
            coalesce(v_financials.app_fee_total_kobo, 0)
            + coalesce(v_financials.ops_fee_total_kobo, 0)
            + coalesce(v_financials.insurance_total_kobo, 0)
            + coalesce(v_financials.corporate_delivery_share_kobo, 0);
        v_vat_kobo := coalesce(v_financials.vat_total_kobo, 0);

        if coalesce(v_financials.merchant_base_total_kobo, 0) > 0 then
            v_merchant_wallet := public.ensure_actor_wallet(v_order.merchant_id, 'merchant');
            select balance
            into v_merchant_balance
            from public.wallets
            where id = v_merchant_wallet
            for update;

            if coalesce(v_merchant_balance, 0) < v_financials.merchant_base_total_kobo then
                return jsonb_build_object('success', false, 'error', 'Merchant wallet does not have enough balance to reverse this refund');
            end if;
        end if;

        if v_order.assigned_agent_id is not null and coalesce(v_financials.agent_fee_total_kobo, 0) > 0 then
            v_agent_wallet := public.ensure_actor_wallet(v_order.assigned_agent_id, 'agent');
            select balance
            into v_agent_balance
            from public.wallets
            where id = v_agent_wallet
            for update;

            if coalesce(v_agent_balance, 0) < v_financials.agent_fee_total_kobo then
                return jsonb_build_object('success', false, 'error', 'Agent wallet does not have enough balance to reverse this refund');
            end if;
        end if;

        if v_order.rider_id is not null and coalesce(v_financials.rider_share_kobo, 0) > 0 then
            v_rider_wallet := public.ensure_actor_wallet(v_order.rider_id, 'rider');
            select balance
            into v_rider_balance
            from public.wallets
            where id = v_rider_wallet
            for update;

            if coalesce(v_rider_balance, 0) < v_financials.rider_share_kobo then
                return jsonb_build_object('success', false, 'error', 'Rider wallet does not have enough balance to reverse this refund');
            end if;
        end if;

        select *
        into v_corporate_wallet
        from public.corporate_wallets
        where wallet_key = 'rss_primary'
        for update;

        if not found then
            return jsonb_build_object('success', false, 'error', 'Corporate wallet not configured');
        end if;

        if coalesce(v_corporate_wallet.available_balance_kobo, 0) < v_corporate_revenue_kobo then
            return jsonb_build_object('success', false, 'error', 'Corporate available balance is too low to reverse this refund');
        end if;

        if coalesce(v_corporate_wallet.locked_balance_kobo, 0) < v_vat_kobo then
            return jsonb_build_object('success', false, 'error', 'Corporate VAT reserve is too low to reverse this refund');
        end if;

        if coalesce(v_financials.merchant_base_total_kobo, 0) > 0 then
            update public.wallets
            set balance = balance - v_financials.merchant_base_total_kobo
            where id = v_merchant_wallet;

            insert into public.ledger_entries (wallet_id, amount, description, reference_id)
            values (v_merchant_wallet, -v_financials.merchant_base_total_kobo, 'Merchant payout reversal for refund', v_refund.order_id);
        end if;

        if v_agent_wallet is not null and coalesce(v_financials.agent_fee_total_kobo, 0) > 0 then
            update public.wallets
            set balance = balance - v_financials.agent_fee_total_kobo
            where id = v_agent_wallet;

            insert into public.ledger_entries (wallet_id, amount, description, reference_id)
            values (v_agent_wallet, -v_financials.agent_fee_total_kobo, 'Agent payout reversal for refund', v_refund.order_id);
        end if;

        if v_rider_wallet is not null and coalesce(v_financials.rider_share_kobo, 0) > 0 then
            update public.wallets
            set balance = balance - v_financials.rider_share_kobo
            where id = v_rider_wallet;

            insert into public.ledger_entries (wallet_id, amount, description, reference_id)
            values (v_rider_wallet, -v_financials.rider_share_kobo, 'Rider payout reversal for refund', v_refund.order_id);
        end if;

        update public.corporate_wallets
        set available_balance_kobo = available_balance_kobo - v_corporate_revenue_kobo,
            locked_balance_kobo = locked_balance_kobo - v_vat_kobo,
            updated_at = now()
        where id = v_corporate_wallet.id;

        if v_corporate_revenue_kobo > 0 then
            insert into public.corporate_ledger_entries (
                corporate_wallet_id,
                category,
                amount_kobo,
                reference_type,
                reference_id,
                description,
                metadata
            )
            values (
                v_corporate_wallet.id,
                'corporate_revenue',
                -v_corporate_revenue_kobo,
                'refund',
                v_refund.id,
                'Corporate revenue reversal for refund',
                jsonb_build_object('order_id', v_refund.order_id)
            );
        end if;

        if v_vat_kobo > 0 then
            insert into public.corporate_ledger_entries (
                corporate_wallet_id,
                category,
                amount_kobo,
                reference_type,
                reference_id,
                description,
                metadata
            )
            values (
                v_corporate_wallet.id,
                'vat_liability',
                -v_vat_kobo,
                'refund',
                v_refund.id,
                'VAT reserve reversal for refund',
                jsonb_build_object('order_id', v_refund.order_id)
            );
        end if;

        update public.tax_liabilities
        set status = 'refunded',
            metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('refund_id', v_refund.id, 'refunded_at', now())
        where order_id = v_refund.order_id;
    end if;

    update public.wallets
    set balance = balance + v_refund.amount_kobo
    where id = v_customer_wallet;

    insert into public.ledger_entries (wallet_id, amount, description, reference_id)
    values (v_customer_wallet, v_refund.amount_kobo, 'Customer refund credit', v_refund.order_id);

    update public.refunds
    set status = 'processed',
        processed_by = v_actor,
        processed_at = now()
    where id = p_refund_id;

    update public.orders
    set status = 'refunded',
        payment_status = 'refunded'
    where id = v_refund.order_id;

    update public.order_financials
    set settlement_status = 'refunded',
        updated_at = now()
    where order_id = v_refund.order_id;

    update public.order_disputes
    set status = 'refunded',
        resolution_notes = coalesce(resolution_notes, 'Refund processed'),
        resolved_by = coalesce(resolved_by, v_actor),
        resolved_at = coalesce(resolved_at, now())
    where order_id = v_refund.order_id
      and status in ('open', 'investigating');

    perform public.write_audit_log(
        v_actor,
        'process_refund',
        'refund',
        p_refund_id,
        jsonb_build_object('order_id', v_refund.order_id, 'amount_kobo', v_refund.amount_kobo)
    );

    return jsonb_build_object('success', true, 'order_id', v_refund.order_id);
end;
$function$;

create or replace function public.resolve_order_dispute(
    p_dispute_id uuid,
    p_status public.dispute_status,
    p_resolution_notes text
)
returns jsonb
language plpgsql
security definer
as $function$
declare
    v_actor uuid := auth.uid();
    v_dispute record;
    v_order_total bigint;
    v_refund_result jsonb;
    v_refund_id uuid;
    v_process_result jsonb;
begin
    if not public.jwt_has_any_role(array['admin', 'sub_admin', 'supa_admin']) then
        return jsonb_build_object('success', false, 'error', 'Admin access required');
    end if;

    select *
    into v_dispute
    from public.order_disputes
    where id = p_dispute_id
    for update;

    if not found then
        return jsonb_build_object('success', false, 'error', 'Dispute not found');
    end if;

    if p_status = 'refunded' then
        select total_amount
        into v_order_total
        from public.orders
        where id = v_dispute.order_id
        for update;

        v_refund_result := public.create_refund(
            v_dispute.order_id,
            v_order_total,
            coalesce(nullif(btrim(coalesce(p_resolution_notes, '')), ''), 'Refund approved via dispute resolution')
        );

        if coalesce((v_refund_result ->> 'success')::boolean, false) is not true then
            return v_refund_result;
        end if;

        v_refund_id := (v_refund_result ->> 'refund_id')::uuid;
        v_process_result := public.process_refund(v_refund_id);

        if coalesce((v_process_result ->> 'success')::boolean, false) is not true then
            return v_process_result;
        end if;
    elsif p_status in ('resolved', 'rejected') then
        update public.orders
        set status = coalesce(v_dispute.previous_order_status, status)
        where id = v_dispute.order_id
          and status = 'disputed';

        update public.order_financials
        set settlement_status = coalesce(v_dispute.previous_settlement_status, settlement_status),
            updated_at = now()
        where order_id = v_dispute.order_id
          and settlement_status = 'disputed';
    end if;

    update public.order_disputes
    set status = p_status,
        resolution_notes = nullif(btrim(coalesce(p_resolution_notes, '')), ''),
        resolved_by = v_actor,
        resolved_at = now()
    where id = p_dispute_id
    returning * into v_dispute;

    perform public.write_audit_log(
        v_actor,
        'resolve_order_dispute',
        'order_dispute',
        p_dispute_id,
        jsonb_build_object('status', p_status, 'order_id', v_dispute.order_id)
    );

    return jsonb_build_object('success', true, 'order_id', v_dispute.order_id);
end;
$function$;

drop function if exists public.fetch_nearby_orders(double precision, double precision, double precision);

create function public.fetch_nearby_orders(
    lat double precision,
    long double precision,
    radius_meters double precision
)
returns table(
    id uuid,
    total_amount bigint,
    status text,
    created_at timestamptz,
    merchant_name text,
    merchant_address text,
    merchant_location geography,
    delivery_location jsonb
)
language plpgsql
security definer
as $function$
declare
    v_actor uuid := auth.uid();
begin
    if v_actor is null or not public.jwt_has_role('rider') then
        return;
    end if;

    if not exists (
        select 1
        from public.rider_profiles rp
        where rp.id = v_actor
          and rp.status = 'approved'
    ) then
        return;
    end if;

    if lat is null or long is null or radius_meters is null or radius_meters <= 0 then
        return;
    end if;

    return query
    select distinct
        o.id,
        o.total_amount,
        o.status::text,
        o.created_at,
        coalesce(m.store_name, p.full_name, 'RSS Fulfillment')::text,
        coalesce(m.business_address, p.address, 'Location hidden')::text,
        coalesce(m.location, p.location) as merchant_location,
        null::jsonb as delivery_location
    from public.orders o
    join public.profiles p on p.id = o.merchant_id
    left join public.merchants m on m.id = o.merchant_id
    where o.status = 'ready_for_pickup'
      and o.rider_id is null
      and coalesce(m.location, p.location) is not null
      and ST_DWithin(
          coalesce(m.location, p.location),
          ST_SetSRID(ST_MakePoint(long, lat), 4326)::geography,
          radius_meters
      )
    order by o.rider_requested_at desc nulls last, o.created_at desc;
end;
$function$;

create or replace function public.override_order_assignment(
    p_order_id uuid,
    p_assignment_role text,
    p_new_assignee_id uuid,
    p_reason text
)
returns jsonb
language plpgsql
security definer
as $function$
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

    update public.order_assignments
    set is_active = false,
        updated_at = now()
    where order_id = p_order_id
      and assignment_role = p_assignment_role
      and is_active = true;

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

revoke execute on function public.create_paid_order(uuid, jsonb, jsonb, bigint, jsonb, text) from public, anon;
grant execute on function public.create_paid_order(uuid, jsonb, jsonb, bigint, jsonb, text) to authenticated, service_role;

revoke execute on function public.create_pending_order(uuid, jsonb, jsonb, bigint, jsonb, text) from public, anon;
grant execute on function public.create_pending_order(uuid, jsonb, jsonb, bigint, jsonb, text) to authenticated, service_role;

revoke execute on function public.open_order_dispute(uuid, text) from public, anon;
grant execute on function public.open_order_dispute(uuid, text) to authenticated, service_role;

revoke execute on function public.resolve_order_dispute(uuid, public.dispute_status, text) from public, anon;
grant execute on function public.resolve_order_dispute(uuid, public.dispute_status, text) to authenticated, service_role;

revoke execute on function public.create_refund(uuid, bigint, text) from public, anon;
grant execute on function public.create_refund(uuid, bigint, text) to authenticated, service_role;

revoke execute on function public.process_refund(uuid) from public, anon;
grant execute on function public.process_refund(uuid) to authenticated, service_role;

revoke execute on function public.fetch_nearby_orders(double precision, double precision, double precision) from public, anon;
grant execute on function public.fetch_nearby_orders(double precision, double precision, double precision) to authenticated, service_role;

revoke execute on function public.override_order_assignment(uuid, text, uuid, text) from public, anon;
grant execute on function public.override_order_assignment(uuid, text, uuid, text) to authenticated, service_role;

revoke execute on function public.mark_direct_payment_success(uuid, text) from public, anon, authenticated;
grant execute on function public.mark_direct_payment_success(uuid, text) to service_role;
