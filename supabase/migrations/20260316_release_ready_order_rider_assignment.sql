create or replace function public.release_ready_order_rider_assignment(
    p_order_id uuid,
    p_reason text default 'Stale rider assignment released by admin'
)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_actor uuid := auth.uid();
    v_order record;
begin
    if not public.jwt_has_any_role(array['admin', 'sub_admin', 'supa_admin']) then
        return jsonb_build_object('success', false, 'error', 'Admin access required');
    end if;

    select *
    into v_order
    from public.orders
    where id = p_order_id
    for update;

    if not found then
        return jsonb_build_object('success', false, 'error', 'Order not found');
    end if;

    if v_order.status <> 'ready_for_pickup' then
        return jsonb_build_object('success', false, 'error', 'Only ready-for-pickup orders can be released');
    end if;

    if v_order.rider_id is null then
        return jsonb_build_object('success', true, 'message', 'Order is already open for rider claim', 'order_id', p_order_id);
    end if;

    update public.order_assignments
    set is_active = false,
        updated_at = now()
    where order_id = p_order_id
      and assignment_role = 'rider'
      and is_active = true;

    update public.orders
    set rider_id = null,
        rider_assigned_at = null,
        pickup_code = null,
        delivery_code = null
    where id = p_order_id;

    perform public.write_audit_log(
        v_actor,
        'release_ready_order_rider_assignment',
        'order',
        p_order_id,
        jsonb_build_object('reason', p_reason, 'released_rider_id', v_order.rider_id)
    );

    return jsonb_build_object('success', true, 'order_id', p_order_id);
end;
$$;
