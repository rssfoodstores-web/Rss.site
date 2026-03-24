create or replace function public.rider_release_ready_order_assignment(
    p_order_id uuid,
    p_reason text default 'Rider released stale pickup assignment'
)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_actor uuid := auth.uid();
    v_order record;
begin
    if not public.jwt_has_role('rider') then
        return jsonb_build_object('success', false, 'error', 'Rider access required');
    end if;

    select *
    into v_order
    from public.orders
    where id = p_order_id
    for update;

    if not found then
        return jsonb_build_object('success', false, 'error', 'Order not found');
    end if;

    if v_order.rider_id is distinct from v_actor then
        return jsonb_build_object('success', false, 'error', 'You are not assigned to this order');
    end if;

    if v_order.status <> 'ready_for_pickup' then
        return jsonb_build_object('success', false, 'error', 'Only pickup-stage assignments can be released');
    end if;

    if v_order.pickup_verified_at is not null then
        return jsonb_build_object('success', false, 'error', 'Pickup has already been verified');
    end if;

    update public.order_assignments
    set is_active = false,
        updated_at = now()
    where order_id = p_order_id
      and assignment_role = 'rider'
      and assignee_id = v_actor
      and is_active = true;

    update public.orders
    set rider_id = null,
        rider_assigned_at = null,
        pickup_code = null,
        delivery_code = null
    where id = p_order_id;

    perform public.write_audit_log(
        v_actor,
        'rider_release_ready_order_assignment',
        'order',
        p_order_id,
        jsonb_build_object('reason', p_reason)
    );

    return jsonb_build_object('success', true, 'order_id', p_order_id);
end;
$$;
