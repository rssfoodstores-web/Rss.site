create table public.agent_assignment_settings (
    singleton boolean primary key default true check (singleton),
    coverage_radius_km integer not null default 10 check (coverage_radius_km between 1 and 100),
    active_order_limit integer not null default 5 check (active_order_limit between 1 and 100),
    offer_timeout_seconds integer not null default 120 check (offer_timeout_seconds between 30 and 900)
);
insert into public.agent_assignment_settings default values;
alter table public.agent_assignment_settings enable row level security;
revoke all on public.agent_assignment_settings from public, anon, authenticated;
grant select, update on public.agent_assignment_settings to authenticated;
create policy "Staff read agent settings" on public.agent_assignment_settings for select to authenticated
using ((select public.jwt_has_any_role(array['admin','sub_admin','supa_admin'])));
create policy "Admins update agent settings" on public.agent_assignment_settings for update to authenticated
using ((select public.jwt_has_any_role(array['admin','supa_admin'])))
with check ((select public.jwt_has_any_role(array['admin','supa_admin'])));

alter table public.orders add column agent_offer_expires_at timestamptz;
alter table public.orders add column agent_pickup_location public.geography(point,4326);
create index orders_agent_offer_expiration_idx on public.orders(agent_offer_expires_at)
where status = 'awaiting_agent_acceptance' and agent_offer_expires_at is not null;

create function public.agent_active_order_count(p_agent uuid, p_excluded uuid)
returns bigint language sql stable set search_path = ''
as $function$
    select count(*) from public.orders
    where assigned_agent_id = p_agent and id is distinct from p_excluded
      and status in ('awaiting_agent_acceptance','awaiting_merchant_confirmation','processing','ready_for_pickup','out_for_delivery','rescheduled','return_in_transit');
$function$;
revoke all on function public.agent_active_order_count(uuid,uuid) from public, anon, authenticated;

create function public.alert_agent_assignment_staff(p_order_id uuid, p_reason text)
returns void language sql set search_path = ''
as $function$
    select public.create_notification(
        staff.user_id, 'Order needs an agent', p_reason, 'agent_assignment_required', '/admin/agent',
        jsonb_build_object('order_id', p_order_id)
    )
    from (select distinct user_id from public.user_roles where role in ('admin','sub_admin','supa_admin')) staff
    where not exists (
        select 1 from public.notifications n
        where n.user_id = staff.user_id and n.type = 'agent_assignment_required'
          and n.read is not true and n.metadata->>'order_id' = p_order_id::text
    );
$function$;
revoke all on function public.alert_agent_assignment_staff(uuid,text) from public, anon, authenticated;

create or replace function public.assign_best_agent(
    p_order_id uuid, p_assigned_by uuid default null,
    p_method public.assignment_method default 'auto', p_reason text default null
)
returns uuid language plpgsql security definer set search_path = ''
as $function$
declare
    order_row public.orders%rowtype;
    settings public.agent_assignment_settings%rowtype;
    pickup public.geography;
    candidate uuid;
begin
    select * into order_row from public.orders
    where id = p_order_id and payment_status = 'paid' and status = 'awaiting_agent_acceptance' for update;
    if not found or order_row.assigned_agent_id is not null then return order_row.assigned_agent_id; end if;

    select * into strict settings from public.agent_assignment_settings where singleton;
    pickup := order_row.agent_pickup_location;
    if pickup is null then
        select location into pickup from public.merchants where id = order_row.merchant_id;
        if pickup is not null then
            update public.orders set agent_pickup_location = pickup where id = p_order_id;
        end if;
    end if;

    if pickup is null then
        perform public.alert_agent_assignment_staff(p_order_id, 'The merchant pickup pin is missing. Review the order in Agent assignments.');
        return null;
    end if;
    if (select count(*) from public.order_assignments where order_id = p_order_id and assignment_role = 'agent' and method = 'auto') >= 3 then
        perform public.alert_agent_assignment_staff(p_order_id, 'Three automatic offers expired. Choose an agent in Agent assignments.');
        return null;
    end if;

    perform pg_advisory_xact_lock(563251, 1);
    select aws.agent_id into candidate
    from public.agent_work_settings aws
    join public.agent_profiles ap on ap.id = aws.agent_id and ap.status = 'approved'
    join public.user_roles ur on ur.user_id = ap.id and ur.role = 'agent'
    cross join lateral (select public.st_setsrid(public.st_makepoint(aws.longitude, aws.latitude),4326)::public.geography as pin) coordinates
    cross join lateral (select public.agent_active_order_count(aws.agent_id,p_order_id) as workload) load
    where aws.on_duty and load.workload < settings.active_order_limit
        and public.st_dwithin(coordinates.pin, pickup, settings.coverage_radius_km * 1000)
        and not exists (
            select 1 from public.order_assignments a
            where a.order_id = p_order_id and a.assignment_role = 'agent' and a.assignee_id = aws.agent_id
        )
    order by public.st_distance(coordinates.pin,pickup), load.workload, ap.created_at, ap.id
    limit 1 for share of aws;

    if candidate is null then
        perform public.alert_agent_assignment_staff(p_order_id, 'No on-duty agent in range has capacity. Review the order in Agent assignments.');
        return null;
    end if;

    update public.orders
    set assigned_agent_id = candidate, assignment_method = p_method, agent_assigned_at = now(),
        agent_offer_expires_at = clock_timestamp() + make_interval(secs => settings.offer_timeout_seconds)
    where id = p_order_id;
    update public.order_assignments set is_active = false, updated_at = now()
    where order_id = p_order_id and assignment_role = 'agent' and is_active = true;
    insert into public.order_assignments(order_id,assignment_role,assignee_id,assigned_by,method,reason,is_active)
    values(p_order_id,'agent',candidate,p_assigned_by,p_method,p_reason,true);
    return candidate;
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
        perform pg_advisory_xact_lock(563251, 1);
        if v_order.payment_status <> 'paid' or v_order.status in ('completed','cancelled','refunded') then
            return jsonb_build_object('success', false, 'error', 'Only an active paid order can be offered to an agent');
        end if;
        if public.agent_active_order_count(p_new_assignee_id, p_order_id) >= (
            select active_order_limit from public.agent_assignment_settings where singleton
        ) then
            return jsonb_build_object('success', false, 'error', 'The agent is at their active order limit');
        end if;

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
            agent_offer_expires_at = clock_timestamp() + make_interval(secs => (select offer_timeout_seconds from public.agent_assignment_settings where singleton)),
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

    if v_order.agent_offer_expires_at <= clock_timestamp() then
        return jsonb_build_object('success', false, 'error', 'This offer expired');
    end if;

    if not exists (
        select 1 from public.agent_work_settings aws
        join public.agent_profiles ap on ap.id = aws.agent_id and ap.status = 'approved'
        join public.user_roles ur on ur.user_id = ap.id and ur.role = 'agent'
        where aws.agent_id = v_actor
    ) then
        return jsonb_build_object('success', false, 'error', 'Confirm your working location before accepting orders');
    end if;

    update public.orders set status = 'awaiting_merchant_confirmation', agent_accepted_at = now(), agent_offer_expires_at = null where id = p_order_id;
    update public.order_assignments set accepted_at = now(), updated_at = now() where order_id = p_order_id and assignment_role = 'agent' and assignee_id = v_actor and is_active = true;
    perform public.write_audit_log(v_actor, 'accept_agent_assignment', 'order', p_order_id, '{}'::jsonb);
    return jsonb_build_object('success', true, 'order_id', p_order_id);
end;
$function$;

create or replace function public.list_agents_ready_for_assignment()
returns table (agent_id uuid, name text)
language sql stable security definer set search_path = ''
as $function$
    select aws.agent_id, coalesce(nullif(btrim(p.full_name), ''), 'Agent')
    from public.agent_work_settings aws
    join public.agent_profiles ap on ap.id = aws.agent_id and ap.status = 'approved'
    join public.user_roles ur on ur.user_id = ap.id and ur.role = 'agent'
    join public.profiles p on p.id = aws.agent_id
    cross join public.agent_assignment_settings settings
    where aws.on_duty and auth.uid() is not null
      and public.jwt_has_any_role(array['admin','sub_admin','supa_admin'])
      and public.agent_active_order_count(aws.agent_id,null) < settings.active_order_limit
    order by 2, 1;
$function$;

create function public.expire_agent_offers()
returns void language plpgsql set search_path = ''
as $function$
declare
    expired record;
begin
    for expired in
        select id, assignment_method from public.orders
        where status = 'awaiting_agent_acceptance' and payment_status = 'paid'
          and assigned_agent_id is not null and agent_offer_expires_at <= clock_timestamp()
        order by agent_offer_expires_at
        limit 25 for update skip locked
    loop
        update public.order_assignments set is_active = false, updated_at = now()
        where order_id = expired.id and assignment_role = 'agent' and is_active = true;
        update public.orders set assigned_agent_id = null, agent_offer_expires_at = null, agent_assigned_at = null
        where id = expired.id;
        if expired.assignment_method = 'auto' then
            perform public.assign_best_agent(expired.id, null, 'auto', 'Retry after offer expired');
        else
            perform public.alert_agent_assignment_staff(expired.id, 'The manual offer expired. Choose another agent in Agent assignments.');
        end if;
    end loop;
end;
$function$;
revoke all on function public.expire_agent_offers() from public, anon, authenticated;
select cron.schedule('expire-agent-offers', '15 seconds', 'select public.expire_agent_offers();');
