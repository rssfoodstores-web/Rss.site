alter table public.orders add column agent_checkout_group_id uuid
    references public.delivery_checkout_groups(id);
create index orders_agent_checkout_group_idx on public.orders(agent_checkout_group_id)
    where agent_checkout_group_id is not null;

alter table public.agent_assignment_settings add column proposed_commission_bps integer
    not null default 2000 check (proposed_commission_bps between 0 and 10000);

-- Preserve the existing notifications for customers and merchants. The checkout offer sends one
-- agent notification after assigning all pickups, so suppress only the per-merchant agent message.
do $migration$
declare
    original text := pg_get_functiondef('public.notify_order_parties()'::regprocedure);
    agent_message text := $message$        perform public.create_notification(
            new.assigned_agent_id,
            'New order assigned',$message$;
    replacement text := $message$        if new.agent_checkout_group_id is null then
            perform public.create_notification(
            new.assigned_agent_id,
            'New order assigned',$message$;
    end_of_message text := $message$            jsonb_build_object('order_id', new.id, 'event', 'agent_assigned')
        );

        perform public.create_notification(
            new.customer_id,
            'Agent assigned',$message$;
begin
    if strpos(original, agent_message) = 0 or strpos(original, end_of_message) = 0 then
        raise exception 'The existing agent notification changed. Review the checkout offer migration.';
    end if;
    execute replace(replace(original, agent_message, replacement), end_of_message,
        replace(end_of_message, E'        );\n', E'            );\n        end if;\n'));
end;
$migration$;

create or replace function public.agent_active_order_count(p_agent uuid, p_excluded uuid)
returns bigint language sql stable set search_path = ''
as $function$
    select count(distinct coalesce(o.agent_checkout_group_id, o.id))
    from public.orders o
    left join public.orders excluded on excluded.id = p_excluded
    where o.assigned_agent_id = p_agent and o.id is distinct from p_excluded
      and (excluded.agent_checkout_group_id is null or o.agent_checkout_group_id is distinct from excluded.agent_checkout_group_id)
      and o.status in ('awaiting_agent_acceptance','awaiting_merchant_confirmation','processing','ready_for_pickup','out_for_delivery','rescheduled','return_in_transit');
$function$;

create function public.offer_checkout_to_agent(p_group uuid, p_manual_agent uuid default null, p_actor uuid default null, p_reason text default null)
returns uuid language plpgsql set search_path = ''
as $function$
declare
    settings public.agent_assignment_settings%rowtype;
    anchor uuid;
    notification_order uuid;
    candidate uuid;
    offer_method public.assignment_method := case when p_manual_agent is null then 'auto' else 'override' end;
    deadline timestamptz;
begin
    select order_ids[1] into anchor from public.delivery_checkout_groups where id = p_group for update;
    if not found then return null; end if;
    perform id from public.orders where agent_checkout_group_id = p_group order by id for update;

    if exists (
        select 1 from public.orders where agent_checkout_group_id = p_group
          and status not in ('cancelled','refunded')
          and (payment_status is distinct from 'paid' or status is distinct from 'awaiting_agent_acceptance')
    ) then return null; end if;
    if not exists (
        select 1 from public.orders where agent_checkout_group_id = p_group and status = 'awaiting_agent_acceptance'
    ) then return null; end if;
    if p_manual_agent is null and exists (
        select 1 from public.orders where agent_checkout_group_id = p_group
            and status = 'awaiting_agent_acceptance' and assigned_agent_id is not null
    ) then return null; end if;

    select * into strict settings from public.agent_assignment_settings where singleton;
    update public.orders o set agent_pickup_location = m.location
    from public.merchants m
    where o.agent_checkout_group_id = p_group and o.merchant_id = m.id and o.agent_pickup_location is null;

    if p_manual_agent is null and (
        select count(distinct a.assignee_id)
        from public.order_assignments a join public.orders o on o.id = a.order_id
        where o.agent_checkout_group_id = p_group and a.assignment_role = 'agent' and a.method = 'auto'
    ) >= 3 then
        perform public.alert_agent_assignment_staff(anchor, 'Three automatic offers ended. Choose an agent in Agent assignments.');
        return null;
    end if;

    perform pg_advisory_xact_lock(563251, 1);
    select aws.agent_id into candidate
    from public.agent_work_settings aws
    join public.agent_profiles ap on ap.id = aws.agent_id and ap.status = 'approved'
    join public.user_roles ur on ur.user_id = ap.id and ur.role = 'agent'
    cross join lateral (select public.st_setsrid(public.st_makepoint(aws.longitude, aws.latitude),4326)::public.geography as pin) coordinates
    cross join lateral (select public.agent_active_order_count(aws.agent_id,anchor) as workload) load
    cross join lateral (
        select max(public.st_distance(coordinates.pin, o.agent_pickup_location)) as farthest,
            bool_and(coalesce(public.st_dwithin(coordinates.pin, o.agent_pickup_location, settings.coverage_radius_km * 1000), false)) as covered
        from public.orders o where o.agent_checkout_group_id = p_group and o.status = 'awaiting_agent_acceptance'
    ) route
    where aws.on_duty and load.workload < settings.active_order_limit and (
        aws.agent_id = p_manual_agent or (p_manual_agent is null and route.covered and not exists (
            select 1 from public.order_assignments a join public.orders o on o.id = a.order_id
            where o.agent_checkout_group_id = p_group and a.assignment_role = 'agent' and a.assignee_id = aws.agent_id
        ))
    )
    order by route.farthest, load.workload, ap.created_at, ap.id
    limit 1 for share of aws;

    if candidate is null then
        if p_manual_agent is null then
            perform public.alert_agent_assignment_staff(anchor, 'No on-duty agent with capacity covers every pickup. Review Agent assignments.');
        end if;
        return null;
    end if;

    deadline := clock_timestamp() + make_interval(secs => settings.offer_timeout_seconds);
    select id into strict notification_order from public.orders
    where agent_checkout_group_id = p_group and status = 'awaiting_agent_acceptance'
    order by (id = anchor) desc, id limit 1;
    update public.orders set assigned_agent_id = candidate, assignment_method = offer_method,
        agent_assigned_at = now(), agent_offer_expires_at = deadline
    where agent_checkout_group_id = p_group and status = 'awaiting_agent_acceptance';
    update public.order_assignments a set is_active = false, updated_at = now()
    from public.orders o where o.id = a.order_id and o.agent_checkout_group_id = p_group
      and a.assignment_role = 'agent' and a.is_active;
    insert into public.order_assignments(order_id, assignment_role, assignee_id, assigned_by, method, reason, is_active)
    select id, 'agent', candidate, p_actor, offer_method, p_reason, true
    from public.orders where agent_checkout_group_id = p_group and status = 'awaiting_agent_acceptance';
    perform public.create_notification(candidate,
        case when p_manual_agent is null then 'Nearby order offer' else 'Order offered by Admin' end,
        'A paid order with multiple merchant pickups is available. Open Orders to respond.',
        'order_assignment', '/agent/orders?order=' || notification_order::text,
        jsonb_build_object('order_id', notification_order, 'checkout_id', p_group, 'event', 'agent_assigned'));
    return candidate;
end;
$function$;
revoke all on function public.offer_checkout_to_agent(uuid,uuid,uuid,text) from public, anon, authenticated, service_role;

alter function public.assign_best_agent(uuid,uuid,public.assignment_method,text) rename to assign_best_single_agent;
revoke all on function public.assign_best_single_agent(uuid,uuid,public.assignment_method,text) from public, anon, authenticated, service_role;
create function public.assign_best_agent(
    p_order_id uuid, p_assigned_by uuid default null, p_method public.assignment_method default 'auto', p_reason text default null
)
returns uuid language plpgsql security definer set search_path = ''
as $function$
declare
    checkout uuid;
begin
    if current_setting('rss.defer_checkout_agent', true) = 'true' then return null; end if;
    select agent_checkout_group_id into checkout from public.orders where id = p_order_id;
    if checkout is not null then
        return public.offer_checkout_to_agent(checkout, null, p_assigned_by, p_reason);
    end if;
    return public.assign_best_single_agent(p_order_id, p_assigned_by, p_method, p_reason);
end;
$function$;
revoke all on function public.assign_best_agent(uuid,uuid,public.assignment_method,text) from public, anon, authenticated;
grant execute on function public.assign_best_agent(uuid,uuid,public.assignment_method,text) to service_role;

alter function public.accept_agent_assignment(uuid) rename to accept_single_agent_assignment;
revoke all on function public.accept_single_agent_assignment(uuid) from public, anon, authenticated, service_role;
create function public.accept_agent_assignment(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
    offered public.orders%rowtype;
    checkout uuid;
    actor uuid := auth.uid();
begin
    select agent_checkout_group_id into checkout from public.orders where id = p_order_id;
    if checkout is null then return public.accept_single_agent_assignment(p_order_id); end if;
    perform 1 from public.delivery_checkout_groups where id = checkout for update;
    perform id from public.orders where agent_checkout_group_id = checkout order by id for update;
    select * into strict offered from public.orders where id = p_order_id;
    if actor is null or offered.assigned_agent_id is distinct from actor
        or offered.status <> 'awaiting_agent_acceptance' then
        return jsonb_build_object('success', false, 'error', 'This offer is no longer available');
    end if;
    if offered.agent_offer_expires_at is null or offered.agent_offer_expires_at <= clock_timestamp() then
        return jsonb_build_object('success', false, 'error', 'This offer expired');
    end if;
    if not exists (
        select 1 from public.agent_work_settings aws
        join public.agent_profiles ap on ap.id = aws.agent_id and ap.status = 'approved'
        join public.user_roles ur on ur.user_id = ap.id and ur.role = 'agent'
        where aws.agent_id = actor
    ) then return jsonb_build_object('success', false, 'error', 'Confirm your working location before accepting orders'); end if;
    if exists (
        select 1 from public.orders where agent_checkout_group_id = checkout
        and status not in ('cancelled','refunded')
        and (assigned_agent_id is distinct from actor or status is distinct from 'awaiting_agent_acceptance'
            or payment_status is distinct from 'paid')
    ) then return jsonb_build_object('success', false, 'error', 'This checkout changed. Refresh and try again.'); end if;

    update public.orders set status = 'awaiting_merchant_confirmation', agent_accepted_at = now(), agent_offer_expires_at = null
    where agent_checkout_group_id = checkout and status = 'awaiting_agent_acceptance';
    update public.order_assignments a set accepted_at = now(), updated_at = now()
    from public.orders o where o.id = a.order_id and o.agent_checkout_group_id = checkout
        and a.assignment_role = 'agent' and a.assignee_id = actor and a.is_active;
    perform public.write_audit_log(actor, 'accept_agent_assignment', 'order', p_order_id, jsonb_build_object('checkout_id', checkout));
    return jsonb_build_object('success', true, 'order_id', p_order_id);
end;
$function$;
revoke all on function public.accept_agent_assignment(uuid) from public, anon;
grant execute on function public.accept_agent_assignment(uuid) to authenticated;

create function public.release_agent_offer(p_order_id uuid, p_actor uuid, p_expired boolean)
returns boolean language plpgsql set search_path = ''
as $function$
declare
    checkout uuid;
    anchor uuid := p_order_id;
    offered public.orders%rowtype;
    released_ids uuid[];
    reason text := case when p_expired then 'expired' else 'was declined' end;
begin
    select agent_checkout_group_id into checkout from public.orders where id = p_order_id;
    if checkout is not null then
        select order_ids[1] into anchor from public.delivery_checkout_groups where id = checkout for update;
        perform id from public.orders where agent_checkout_group_id = checkout order by id for update;
    end if;
    select * into offered from public.orders where id = p_order_id for update;
    if not found or offered.status <> 'awaiting_agent_acceptance' or offered.payment_status <> 'paid'
        or offered.assigned_agent_id is null
        or (p_expired and (offered.agent_offer_expires_at is null or offered.agent_offer_expires_at > clock_timestamp()))
        or (not p_expired and (offered.assigned_agent_id is distinct from p_actor or offered.agent_offer_expires_at <= clock_timestamp())) then
        return false;
    end if;
    with released as (
        update public.orders set assigned_agent_id = null, agent_offer_expires_at = null, agent_assigned_at = null
        where (id = p_order_id or agent_checkout_group_id = checkout)
            and status = 'awaiting_agent_acceptance' and assigned_agent_id = offered.assigned_agent_id
        returning id
    ) select array_agg(id) into released_ids from released;
    update public.order_assignments set is_active = false, updated_at = now()
    where order_id = any(released_ids) and assignment_role = 'agent' and is_active;
    if not p_expired then
        perform public.write_audit_log(p_actor, 'decline_agent_assignment', 'order', p_order_id, jsonb_build_object('checkout_id', checkout));
    end if;
    if offered.assignment_method = 'auto' then
        perform public.assign_best_agent(anchor, null, 'auto', 'Retry after offer ' || reason);
    else
        perform public.alert_agent_assignment_staff(anchor, 'The manual offer ' || reason || '. Choose another agent in Agent assignments.');
    end if;
    return true;
end;
$function$;
revoke all on function public.release_agent_offer(uuid,uuid,boolean) from public, anon, authenticated, service_role;

create function public.decline_agent_assignment(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
begin
    if auth.uid() is not null and public.release_agent_offer(p_order_id, auth.uid(), false) then
        return jsonb_build_object('success', true);
    end if;
    return jsonb_build_object('success', false, 'error', 'This offer is no longer available');
end;
$function$;
revoke all on function public.decline_agent_assignment(uuid) from public, anon;
grant execute on function public.decline_agent_assignment(uuid) to authenticated;

create or replace function public.expire_agent_offers()
returns void language plpgsql set search_path = ''
as $function$
declare
    target uuid;
begin
    -- Skip rows held by payment, acceptance or staff rather than waiting while holding the capacity lock.
    for target in
        select o.id from public.delivery_checkout_groups g
        join lateral (
            select id, agent_offer_expires_at from public.orders
            where agent_checkout_group_id = g.id and status = 'awaiting_agent_acceptance' and payment_status = 'paid'
                and assigned_agent_id is not null and agent_offer_expires_at <= clock_timestamp()
            order by agent_offer_expires_at, id limit 1
        ) o on true
        order by o.agent_offer_expires_at limit 25 for update of g skip locked
    loop
        perform public.release_agent_offer(target, null, true);
    end loop;
    for target in
        select id from public.orders
        where agent_checkout_group_id is null and status = 'awaiting_agent_acceptance' and payment_status = 'paid'
            and assigned_agent_id is not null and agent_offer_expires_at <= clock_timestamp()
        order by agent_offer_expires_at limit 25 for update skip locked
    loop
        perform public.release_agent_offer(target, null, true);
    end loop;
end;
$function$;

alter function public.override_order_assignment(uuid,text,uuid,text) rename to override_single_order_assignment;
revoke all on function public.override_single_order_assignment(uuid,text,uuid,text) from public, anon, authenticated, service_role;
create function public.override_order_assignment(p_order_id uuid, p_assignment_role text, p_new_assignee_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
    checkout uuid;
    actor uuid := auth.uid();
begin
    if not public.jwt_has_any_role(array['admin','sub_admin','supa_admin']) or actor is null then
        return jsonb_build_object('success', false, 'error', 'Admin access required');
    end if;
    select agent_checkout_group_id into checkout from public.orders where id = p_order_id;
    if checkout is null or p_assignment_role <> 'agent' then
        return public.override_single_order_assignment(p_order_id, p_assignment_role, p_new_assignee_id, p_reason);
    end if;
    if p_new_assignee_id is null or public.offer_checkout_to_agent(checkout, p_new_assignee_id, actor, p_reason) is null then
        return jsonb_build_object('success', false, 'error', 'The checkout must be awaiting acceptance and the agent must be on duty with capacity.');
    end if;
    perform public.write_audit_log(actor, 'override_order_assignment', 'order', p_order_id, jsonb_build_object('checkout_id', checkout, 'assignee_id', p_new_assignee_id, 'reason', p_reason));
    return jsonb_build_object('success', true, 'order_id', p_order_id);
end;
$function$;
revoke all on function public.override_order_assignment(uuid,text,uuid,text) from public, anon;
grant execute on function public.override_order_assignment(uuid,text,uuid,text) to authenticated;

create or replace function public.assign_waiting_order_to_agent(p_order_id uuid, p_agent_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
    checkout uuid;
begin
    if auth.uid() is null or not public.jwt_has_any_role(array['admin','sub_admin','supa_admin']) then
        return jsonb_build_object('success', false, 'error', 'Admin access required');
    end if;
    select agent_checkout_group_id into checkout from public.orders where id = p_order_id;
    if checkout is not null then
        perform 1 from public.delivery_checkout_groups where id = checkout for update;
        perform id from public.orders where agent_checkout_group_id = checkout order by id for update;
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

create or replace function public.checkout_delivery_address(
    p_address_id uuid, p_items jsonb, p_quoted_fee bigint, p_quoted_subtotal bigint,
    p_contacts jsonb, p_points integer, p_method text, p_attempt_id uuid
) returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $function$
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

create or replace function public.confirm_delivery_checkout_payment(p_group_id uuid, p_reference text, p_amount_kobo bigint)
returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $function$
declare
    v_group public.delivery_checkout_groups;
    v_order public.orders;
    v_id uuid;
    v_result jsonb;
    v_previous_defer text;
begin
    select * into v_group from public.delivery_checkout_groups where id = p_group_id for update;
    if not found or v_group.method <> 'direct' or v_group.payment_reference is distinct from p_reference
       or v_group.total_kobo is distinct from p_amount_kobo then
        return jsonb_build_object('success', false, 'error', 'Checkout payment did not match.');
    end if;
    if v_group.payment_processed then
        return jsonb_build_object('success', true);
    end if;

    v_previous_defer := current_setting('rss.defer_checkout_agent', true);
    if cardinality(v_group.order_ids) > 1 then
        perform set_config('rss.defer_checkout_agent', 'true', true);
    end if;

    foreach v_id in array v_group.order_ids loop
        select * into strict v_order from public.orders where id = v_id for update;
        if v_order.status = 'cancelled' or v_order.payment_status = 'failed' then
            v_result := public.handle_late_order_payment(v_id, v_order.payment_ref, v_order.total_amount);
        else
            v_result := public.mark_direct_payment_success(v_id, v_order.payment_ref);
        end if;
        if not coalesce((v_result->>'success')::boolean, false) then
            raise exception using errcode = 'P0001', message = coalesce(v_result->>'error', 'Could not confirm checkout.');
        end if;
    end loop;
    perform set_config('rss.defer_checkout_agent', coalesce(v_previous_defer, ''), true);
    if exists (select 1 from public.orders where agent_checkout_group_id = p_group_id) then
        perform public.offer_checkout_to_agent(p_group_id);
    elsif cardinality(v_group.order_ids) > 1 then
        -- A checkout started before this migration keeps its original assignment behavior.
        foreach v_id in array v_group.order_ids loop
            perform public.assign_best_agent(v_id);
        end loop;
    end if;
    update public.delivery_checkout_groups set payment_processed = true where id = p_group_id;
    return jsonb_build_object('success', true);
exception when raise_exception then
    return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$function$;
