-- Direct payment order creation and confirmation hardening.

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
as $$
declare
    v_order_id uuid;
    v_item record;
    v_product record;
    v_merchant_id uuid;
    v_total_kobo bigint := 0;
    v_payment_reference text := coalesce(p_payment_reference, 'ORD-' || encode(gen_random_bytes(8), 'hex'));
begin
    if p_user_id is null then
        return jsonb_build_object('success', false, 'error', 'Missing user');
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
$$;

create or replace function public.mark_direct_payment_success(
    p_order_id uuid,
    p_payment_reference text
)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_order record;
    v_item record;
    v_product record;
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

        if v_product.id is null then
            return jsonb_build_object('success', false, 'error', 'Product missing during payment confirmation');
        end if;

        if coalesce(v_product.stock_level, 0) < v_item.quantity then
            return jsonb_build_object('success', false, 'error', 'Insufficient stock for ' || v_product.name);
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
    perform public.assign_best_agent(p_order_id, null, 'auto', 'System auto assignment after direct payment confirmation');
    perform public.write_audit_log(
        null,
        'mark_direct_payment_success',
        'order',
        p_order_id,
        jsonb_build_object('payment_reference', coalesce(p_payment_reference, v_order.payment_ref))
    );

    return jsonb_build_object('success', true, 'order_id', p_order_id);
end;
$$;
