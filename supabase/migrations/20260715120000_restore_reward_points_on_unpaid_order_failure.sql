create or replace function public.cancel_unpaid_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
    v_actor uuid := auth.uid();
    v_order public.orders;
begin
    if v_actor is null then
        return jsonb_build_object('success', false, 'error', 'Authentication required');
    end if;

    select *
    into v_order
    from public.orders
    where id = p_order_id
    for update;

    if not found then
        return jsonb_build_object('success', false, 'error', 'Order not found');
    end if;

    if v_order.customer_id <> v_actor and not public.jwt_has_any_role(array['admin', 'sub_admin', 'supa_admin']) then
        return jsonb_build_object('success', false, 'error', 'You cannot cancel this order');
    end if;

    if v_order.status <> 'pending' or v_order.payment_status <> 'pending' then
        return jsonb_build_object('success', false, 'error', 'Only unpaid pending orders can be cancelled');
    end if;

    update public.orders
    set status = 'cancelled',
        payment_status = 'failed'
    where id = p_order_id;

    perform public.restore_order_reward_point_redemption(p_order_id);

    perform public.write_audit_log(
        v_actor,
        'cancel_unpaid_order',
        'order',
        p_order_id,
        '{}'::jsonb
    );

    return jsonb_build_object('success', true, 'order_id', p_order_id);
end;
$function$;

create or replace function public.mark_pending_order_paid(p_order_id uuid, p_payment_reference text default null::text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
    v_order public.orders;
    v_item record;
    v_validation jsonb;
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

        perform public.restore_order_reward_point_redemption(p_order_id);

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
