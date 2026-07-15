create or replace function public.process_reward_point_expiries(p_user_id uuid default null::uuid)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
    v_actor uuid := auth.uid();
    v_lot record;
    v_expired_count integer := 0;
begin
    if v_actor is null and not public.jwt_has_any_role(array['admin', 'sub_admin', 'supa_admin']) then
        raise exception 'Authentication required';
    end if;

    if p_user_id is null then
        if not public.jwt_has_any_role(array['admin', 'sub_admin', 'supa_admin']) then
            raise exception 'Admin access required to process all reward expiries';
        end if;
    elsif p_user_id is distinct from v_actor and not public.jwt_has_any_role(array['admin', 'sub_admin', 'supa_admin']) then
        raise exception 'You can only process your own reward expiries';
    end if;

    for v_lot in
        select *
        from public.reward_point_lots
        where status = 'available'
          and remaining_points > 0
          and expires_at is not null
          and expires_at <= now()
          and (p_user_id is null or user_id = p_user_id)
        for update
    loop
        perform public.apply_reward_point_balance_delta(v_lot.user_id, -v_lot.remaining_points, 0, 0);

        update public.reward_point_lots
        set status = 'expired',
            remaining_points = 0,
            updated_at = now()
        where id = v_lot.id;

        perform public.create_reward_point_event(
            v_lot.user_id,
            'expired',
            -v_lot.remaining_points,
            'Reward points expired',
            v_lot.id,
            null,
            v_lot.source_kind,
            v_lot.source_id,
            jsonb_build_object('expired_at', now())
        );

        v_expired_count := v_expired_count + 1;
    end loop;

    return v_expired_count;
end;
$function$;

revoke execute on function public.apply_reward_point_balance_delta(uuid, integer, integer, integer) from public, anon, authenticated;
revoke execute on function public.create_reward_point_event(uuid, text, integer, text, uuid, uuid, text, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.create_reward_point_lot(uuid, integer, text, uuid, text, text, boolean, text, timestamp with time zone, jsonb) from public, anon, authenticated;
revoke execute on function public.ensure_reward_point_balance(uuid) from public, anon, authenticated;
revoke execute on function public.apply_reward_points_redemption(uuid, uuid, integer, bigint, boolean) from public, anon, authenticated;
revoke execute on function public.queue_order_purchase_reward_points(uuid) from public, anon, authenticated;
revoke execute on function public.release_order_purchase_reward_points(uuid) from public, anon, authenticated;
revoke execute on function public.cancel_order_purchase_reward_points(uuid) from public, anon, authenticated;
revoke execute on function public.reverse_order_purchase_reward_points(uuid) from public, anon, authenticated;
revoke execute on function public.restore_order_reward_point_redemption(uuid) from public, anon, authenticated;
revoke execute on function public.cancel_reward_point_lot_by_source_key(text, text) from public, anon, authenticated;
revoke execute on function public.reverse_reward_point_lot_by_source_key(text, text) from public, anon, authenticated;
revoke execute on function public.mark_pending_order_paid(uuid, text) from public, anon, authenticated;
revoke execute on function public.mark_direct_payment_success(uuid, text) from public, anon, authenticated;

revoke execute on function public.get_reward_checkout_summary(bigint) from public, anon;
revoke execute on function public.process_reward_point_expiries(uuid) from public, anon;

grant execute on function public.get_reward_checkout_summary(bigint) to authenticated, service_role;
grant execute on function public.process_reward_point_expiries(uuid) to authenticated, service_role;
grant execute on function public.apply_reward_point_balance_delta(uuid, integer, integer, integer) to service_role;
grant execute on function public.create_reward_point_event(uuid, text, integer, text, uuid, uuid, text, uuid, jsonb) to service_role;
grant execute on function public.create_reward_point_lot(uuid, integer, text, uuid, text, text, boolean, text, timestamp with time zone, jsonb) to service_role;
grant execute on function public.ensure_reward_point_balance(uuid) to service_role;
grant execute on function public.apply_reward_points_redemption(uuid, uuid, integer, bigint, boolean) to service_role;
grant execute on function public.queue_order_purchase_reward_points(uuid) to service_role;
grant execute on function public.release_order_purchase_reward_points(uuid) to service_role;
grant execute on function public.cancel_order_purchase_reward_points(uuid) to service_role;
grant execute on function public.reverse_order_purchase_reward_points(uuid) to service_role;
grant execute on function public.restore_order_reward_point_redemption(uuid) to service_role;
grant execute on function public.cancel_reward_point_lot_by_source_key(text, text) to service_role;
grant execute on function public.reverse_reward_point_lot_by_source_key(text, text) to service_role;
grant execute on function public.mark_pending_order_paid(uuid, text) to service_role;
grant execute on function public.mark_direct_payment_success(uuid, text) to service_role;
