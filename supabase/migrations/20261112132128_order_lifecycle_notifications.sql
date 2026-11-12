create function public.notify_delivery_participants(
    p_order public.orders,
    p_title text,
    p_message text,
    p_type text,
    p_event text,
    p_recipients uuid[] default null,
    p_omit uuid[] default '{}'::uuid[]
)
returns void
language sql
set search_path = ''
as $function$
    select public.create_notification(
        recipient, p_title, p_message, p_type,
        public.order_action_url(recipient, p_order),
        jsonb_build_object('order_id', (p_order).id, 'event', p_event)
    )
    from (
        select distinct recipient
        from unnest(coalesce(p_recipients, array[(p_order).customer_id, (p_order).merchant_id, (p_order).assigned_agent_id, (p_order).rider_id])) as audience(recipient)
        where recipient is not null and not (recipient = any(array_remove(p_omit, null)))
    ) recipients;
$function$;
revoke all on function public.notify_delivery_participants(public.orders,text,text,text,text,uuid[],uuid[])
    from public, anon, authenticated, service_role;

-- Extend the existing trigger in place so assignment and payout notices retain their established copy and links.
do $migration$
declare
    definition text := pg_get_functiondef('public.notify_order_parties()'::regprocedure);
    assignment_start text := $old$    if tg_op = 'INSERT' or new.status is distinct from old.status then$old$;
    delivered_case text := $old$            when 'delivered' then
                null;$old$;
    cancelled_case text := $old$            when 'cancelled' then
                null;$old$;
begin
    if strpos(definition, assignment_start) = 0
        or strpos(definition, delivered_case) = 0
        or strpos(definition, cancelled_case) = 0
        or strpos(definition, 'when ''disputed'' then') = 0
        or strpos(definition, 'when ''refunded'' then') = 0
        or strpos(definition, '        end case;') = 0 then
        raise exception 'Order notification trigger differs from the expected version.';
    end if;

    definition := replace(definition, assignment_start, $new$    if tg_op = 'UPDATE' and old.rider_id is not null and new.rider_id is distinct from old.rider_id then
        perform public.create_notification(old.rider_id, 'Rider assignment ended',
            'You are no longer assigned to order #' || v_order_short || '.', 'rider_assignment', '/rider',
            jsonb_build_object('order_id', new.id, 'event', 'rider_unassigned'));
        if new.rider_id is null and new.status = 'ready_for_pickup' and old.status = new.status then
            perform public.notify_delivery_participants(new, 'Finding another rider',
                'The pickup for order #' || v_order_short || ' is available for a new rider.',
                'dispatch_update', 'rider_reopened');
        end if;
    end if;

    if tg_op = 'UPDATE' and old.assigned_agent_id is not null
        and new.assigned_agent_id is distinct from old.assigned_agent_id
        and (new.agent_checkout_group_id is null or exists (
            select 1 from public.delivery_checkout_groups checkout
            where checkout.id = new.agent_checkout_group_id and checkout.order_ids[1] = new.id
        )) then
        perform public.create_notification(old.assigned_agent_id, 'Agent assignment ended',
            'You are no longer assigned to order #' || v_order_short || '.', 'order_assignment', '/agent/orders',
            jsonb_build_object('order_id', new.id, 'event', 'agent_unassigned'));
    end if;

    if tg_op = 'INSERT' or new.status is distinct from old.status then$new$);
    definition := replace(definition, delivered_case, $new$            when 'delivered' then
                perform public.notify_delivery_participants(new, 'Order delivered',
                    'Order #' || v_order_short || ' was delivered.', 'order_update', 'delivered');
            when 'delivery_failed' then
                perform public.notify_delivery_participants(new, 'Delivery could not be completed',
                    'The rider reported a delivery problem on order #' || v_order_short || '.', 'order_issue', 'delivery_failed');
            when 'rescheduled' then
                perform public.notify_delivery_participants(new, 'Delivery rescheduled',
                    'The delivery schedule changed for order #' || v_order_short || '.', 'dispatch_update', 'rescheduled');
            when 'return_in_transit' then
                perform public.notify_delivery_participants(new, 'Order returning to the merchant',
                    'Order #' || v_order_short || ' is on its way back to the merchant.', 'dispatch_update', 'return_in_transit');
            when 'returned_to_merchant' then
                perform public.notify_delivery_participants(new, 'Order returned to the merchant',
                    'The merchant received the return for order #' || v_order_short || '.', 'dispatch_update', 'returned_to_merchant');$new$);
    definition := replace(definition, cancelled_case, $new$            when 'cancelled' then
                if tg_op = 'UPDATE' then
                    perform public.notify_delivery_participants(new, 'Order cancelled',
                        'Order #' || v_order_short || ' was cancelled.', 'order_update', 'cancelled',
                        case when old.payment_status = 'paid' then null else array[new.customer_id] end);
                end if;$new$);
    definition := replace(definition, 'when ''disputed'' then', $new$when 'disputed' then
                perform public.notify_delivery_participants(new, 'Order dispute opened',
                    'A dispute has been opened for order #' || v_order_short || '.', 'order_issue', 'disputed',
                    array[new.assigned_agent_id, new.rider_id], array[new.customer_id, new.merchant_id]);$new$);
    definition := replace(definition, 'when ''refunded'' then', $new$when 'refunded' then
                perform public.notify_delivery_participants(new, 'Order refunded',
                    'Order #' || v_order_short || ' has been refunded.', 'order_issue', 'refunded',
                    array[new.assigned_agent_id, new.rider_id], array[new.customer_id, new.merchant_id]);$new$);
    definition := replace(definition, '        end case;', '            else null;' || chr(10) || '        end case;');
    execute definition;
end;
$migration$;
