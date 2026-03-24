do $$
begin
    if not exists (
        select 1
        from pg_type
        where typnamespace = 'public'::regnamespace
          and typname = 'order_chat_channel'
    ) then
        create type public.order_chat_channel as enum ('customer', 'ops');
    end if;
end $$;

alter table public.order_messages
    add column if not exists channel public.order_chat_channel;

update public.order_messages
set channel = 'customer'::public.order_chat_channel
where channel is null;

alter table public.order_messages
    alter column channel set default 'customer'::public.order_chat_channel;

alter table public.order_messages
    alter column channel set not null;

alter table public.order_message_reads
    add column if not exists channel public.order_chat_channel;

update public.order_message_reads
set channel = 'customer'::public.order_chat_channel
where channel is null;

alter table public.order_message_reads
    alter column channel set default 'customer'::public.order_chat_channel;

alter table public.order_message_reads
    alter column channel set not null;

drop policy if exists "Order chat participants can read messages" on public.order_messages;
drop policy if exists "Order chat participants can send messages" on public.order_messages;
drop policy if exists "Order chat participants can read read-states" on public.order_message_reads;
drop policy if exists "Order chat participants can insert read-states" on public.order_message_reads;
drop policy if exists "Order chat participants can update read-states" on public.order_message_reads;

drop function if exists public.get_order_chat_messages(uuid, uuid);
drop function if exists public.get_order_chat_participants(uuid, uuid);
drop function if exists public.list_order_chat_threads(uuid);
drop function if exists public.mark_order_chat_read(uuid, uuid);
drop function if exists public.can_access_order_chat(uuid, uuid);

alter table public.order_message_reads
    drop constraint if exists order_message_reads_pkey;

alter table public.order_message_reads
    add constraint order_message_reads_pkey primary key (order_id, user_id, channel);

create index if not exists order_messages_order_channel_created_idx
    on public.order_messages (order_id, channel, created_at desc);

create or replace function public.can_access_order_chat(
    p_order_id uuid,
    p_channel public.order_chat_channel,
    p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
    select exists (
        select 1
        from public.orders o
        where o.id = p_order_id
          and p_user_id is not null
          and case
              when p_channel = 'customer'::public.order_chat_channel
                  then p_user_id in (o.customer_id, o.merchant_id, o.assigned_agent_id, o.rider_id)
              when p_channel = 'ops'::public.order_chat_channel
                  then p_user_id in (o.merchant_id, o.assigned_agent_id, o.rider_id)
              else false
          end
    );
$function$;

create or replace function public.get_order_chat_messages(
    p_order_id uuid,
    p_channel public.order_chat_channel,
    p_user_id uuid default auth.uid()
)
returns table(
    id uuid,
    order_id uuid,
    channel public.order_chat_channel,
    sender_id uuid,
    sender_role text,
    sender_name text,
    sender_phone text,
    sender_avatar_url text,
    body text,
    created_at timestamp with time zone,
    is_mine boolean
)
language sql
stable
security definer
set search_path to 'public'
as $function$
    select
        om.id,
        om.order_id,
        om.channel,
        om.sender_id,
        public.order_chat_role(om.order_id, om.sender_id) as sender_role,
        sender_profile.full_name as sender_name,
        sender_profile.phone as sender_phone,
        sender_profile.avatar_url as sender_avatar_url,
        om.body,
        om.created_at,
        om.sender_id = p_user_id as is_mine
    from public.order_messages om
    left join public.profiles sender_profile on sender_profile.id = om.sender_id
    where om.order_id = p_order_id
      and om.channel = p_channel
      and public.can_access_order_chat(om.order_id, p_channel, p_user_id)
    order by om.created_at asc;
$function$;

create or replace function public.get_order_chat_participants(
    p_order_id uuid,
    p_channel public.order_chat_channel,
    p_user_id uuid default auth.uid()
)
returns table(
    profile_id uuid,
    role text,
    full_name text,
    phone text,
    avatar_url text,
    address text,
    is_current_user boolean,
    sort_order integer
)
language sql
stable
security definer
set search_path to 'public'
as $function$
    with target_order as (
        select *
        from public.orders o
        where o.id = p_order_id
          and public.can_access_order_chat(o.id, p_channel, p_user_id)
    )
    select *
    from (
        select
            o.customer_id as profile_id,
            'customer'::text as role,
            customer_profile.full_name,
            customer_profile.phone,
            customer_profile.avatar_url,
            customer_profile.address,
            o.customer_id = p_user_id as is_current_user,
            1 as sort_order
        from target_order o
        left join public.profiles customer_profile on customer_profile.id = o.customer_id

        union all

        select
            o.merchant_id as profile_id,
            'merchant'::text as role,
            coalesce(merchant_account.store_name, merchant_profile.full_name, 'Merchant') as full_name,
            merchant_profile.phone,
            merchant_profile.avatar_url,
            coalesce(merchant_account.business_address, merchant_profile.address) as address,
            o.merchant_id = p_user_id as is_current_user,
            2 as sort_order
        from target_order o
        left join public.merchants merchant_account on merchant_account.id = o.merchant_id
        left join public.profiles merchant_profile on merchant_profile.id = o.merchant_id

        union all

        select
            o.assigned_agent_id as profile_id,
            'agent'::text as role,
            agent_profile.full_name,
            agent_profile.phone,
            agent_profile.avatar_url,
            agent_profile.address,
            o.assigned_agent_id = p_user_id as is_current_user,
            3 as sort_order
        from target_order o
        left join public.profiles agent_profile on agent_profile.id = o.assigned_agent_id

        union all

        select
            o.rider_id as profile_id,
            'rider'::text as role,
            rider_profile.full_name,
            rider_profile.phone,
            rider_profile.avatar_url,
            rider_profile.address,
            o.rider_id = p_user_id as is_current_user,
            4 as sort_order
        from target_order o
        left join public.profiles rider_profile on rider_profile.id = o.rider_id
    ) participants
    where profile_id is not null
      and (p_channel = 'customer'::public.order_chat_channel or role <> 'customer')
    order by sort_order asc;
$function$;

create or replace function public.list_order_chat_threads(
    p_user_id uuid default auth.uid()
)
returns table(
    order_id uuid,
    order_status text,
    order_created_at timestamp with time zone,
    total_amount bigint,
    current_user_role text,
    customer_id uuid,
    customer_name text,
    customer_phone text,
    customer_avatar_url text,
    merchant_id uuid,
    merchant_name text,
    merchant_phone text,
    merchant_avatar_url text,
    agent_id uuid,
    agent_name text,
    agent_phone text,
    agent_avatar_url text,
    rider_id uuid,
    rider_name text,
    rider_phone text,
    rider_avatar_url text,
    last_message_at timestamp with time zone,
    last_message_preview text,
    last_message_sender_id uuid,
    last_message_sender_name text,
    last_message_channel public.order_chat_channel,
    unread_count bigint,
    customer_unread_count bigint,
    ops_unread_count bigint,
    accessible_channels public.order_chat_channel[]
)
language sql
stable
security definer
set search_path to 'public'
as $function$
    with accessible_orders as (
        select o.*
        from public.orders o
        where p_user_id is not null
          and p_user_id in (o.customer_id, o.merchant_id, o.assigned_agent_id, o.rider_id)
    ),
    thread_base as (
        select
            o.id as order_id,
            o.status::text as order_status,
            o.created_at as order_created_at,
            o.total_amount,
            public.order_chat_role(o.id, p_user_id) as current_user_role,
            o.customer_id,
            customer_profile.full_name as customer_name,
            customer_profile.phone as customer_phone,
            customer_profile.avatar_url as customer_avatar_url,
            o.merchant_id,
            coalesce(merchant_account.store_name, merchant_profile.full_name, 'Merchant') as merchant_name,
            merchant_profile.phone as merchant_phone,
            merchant_profile.avatar_url as merchant_avatar_url,
            o.assigned_agent_id as agent_id,
            agent_profile.full_name as agent_name,
            agent_profile.phone as agent_phone,
            agent_profile.avatar_url as agent_avatar_url,
            o.rider_id,
            rider_profile.full_name as rider_name,
            rider_profile.phone as rider_phone,
            rider_profile.avatar_url as rider_avatar_url
        from accessible_orders o
        left join public.profiles customer_profile on customer_profile.id = o.customer_id
        left join public.merchants merchant_account on merchant_account.id = o.merchant_id
        left join public.profiles merchant_profile on merchant_profile.id = o.merchant_id
        left join public.profiles agent_profile on agent_profile.id = o.assigned_agent_id
        left join public.profiles rider_profile on rider_profile.id = o.rider_id
    ),
    thread_channels as (
        select
            tb.*,
            case
                when tb.current_user_role = 'customer'
                    then array['customer'::public.order_chat_channel]
                when tb.current_user_role in ('merchant', 'agent', 'rider')
                    then array['ops'::public.order_chat_channel, 'customer'::public.order_chat_channel]
                else array[]::public.order_chat_channel[]
            end as accessible_channels
        from thread_base tb
    )
    select
        tc.order_id,
        tc.order_status,
        tc.order_created_at,
        tc.total_amount,
        tc.current_user_role,
        tc.customer_id,
        tc.customer_name,
        tc.customer_phone,
        tc.customer_avatar_url,
        tc.merchant_id,
        tc.merchant_name,
        tc.merchant_phone,
        tc.merchant_avatar_url,
        tc.agent_id,
        tc.agent_name,
        tc.agent_phone,
        tc.agent_avatar_url,
        tc.rider_id,
        tc.rider_name,
        tc.rider_phone,
        tc.rider_avatar_url,
        last_message.created_at as last_message_at,
        last_message.body as last_message_preview,
        last_message.sender_id as last_message_sender_id,
        last_message.sender_name as last_message_sender_name,
        last_message.channel as last_message_channel,
        coalesce(unread.customer_unread_count, 0) + coalesce(unread.ops_unread_count, 0) as unread_count,
        coalesce(unread.customer_unread_count, 0) as customer_unread_count,
        coalesce(unread.ops_unread_count, 0) as ops_unread_count,
        tc.accessible_channels
    from thread_channels tc
    left join lateral (
        select
            om.body,
            om.created_at,
            om.sender_id,
            om.channel,
            sender_profile.full_name as sender_name
        from public.order_messages om
        left join public.profiles sender_profile on sender_profile.id = om.sender_id
        where om.order_id = tc.order_id
          and om.channel = any(tc.accessible_channels)
        order by om.created_at desc
        limit 1
    ) last_message on true
    left join lateral (
        select
            count(*) filter (
                where om.channel = 'customer'::public.order_chat_channel
                  and om.sender_id <> p_user_id
                  and om.created_at > coalesce(customer_reads.last_read_message_at, '-infinity'::timestamp with time zone)
            )::bigint as customer_unread_count,
            count(*) filter (
                where om.channel = 'ops'::public.order_chat_channel
                  and om.sender_id <> p_user_id
                  and om.created_at > coalesce(ops_reads.last_read_message_at, '-infinity'::timestamp with time zone)
            )::bigint as ops_unread_count
        from public.order_messages om
        left join public.order_message_reads customer_reads
            on customer_reads.order_id = tc.order_id
           and customer_reads.user_id = p_user_id
           and customer_reads.channel = 'customer'::public.order_chat_channel
        left join public.order_message_reads ops_reads
            on ops_reads.order_id = tc.order_id
           and ops_reads.user_id = p_user_id
           and ops_reads.channel = 'ops'::public.order_chat_channel
        where om.order_id = tc.order_id
          and om.channel = any(tc.accessible_channels)
    ) unread on true
    order by coalesce(last_message.created_at, tc.order_created_at) desc, tc.order_created_at desc;
$function$;

create or replace function public.mark_order_chat_read(
    p_order_id uuid,
    p_channel public.order_chat_channel,
    p_user_id uuid default auth.uid()
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
    if not public.can_access_order_chat(p_order_id, p_channel, p_user_id) then
        raise exception 'Not allowed to access this order chat.' using errcode = '42501';
    end if;

    insert into public.order_message_reads (
        order_id,
        user_id,
        channel,
        last_read_message_at,
        created_at,
        updated_at
    )
    values (
        p_order_id,
        p_user_id,
        p_channel,
        now(),
        now(),
        now()
    )
    on conflict (order_id, user_id, channel)
    do update
    set last_read_message_at = excluded.last_read_message_at,
        updated_at = now();

    return true;
end;
$function$;

revoke all on function public.can_access_order_chat(uuid, public.order_chat_channel, uuid) from public;
revoke all on function public.get_order_chat_messages(uuid, public.order_chat_channel, uuid) from public;
revoke all on function public.get_order_chat_participants(uuid, public.order_chat_channel, uuid) from public;
revoke all on function public.list_order_chat_threads(uuid) from public;
revoke all on function public.mark_order_chat_read(uuid, public.order_chat_channel, uuid) from public;

grant execute on function public.can_access_order_chat(uuid, public.order_chat_channel, uuid) to anon, authenticated, service_role;
grant execute on function public.get_order_chat_messages(uuid, public.order_chat_channel, uuid) to anon, authenticated, service_role;
grant execute on function public.get_order_chat_participants(uuid, public.order_chat_channel, uuid) to anon, authenticated, service_role;
grant execute on function public.list_order_chat_threads(uuid) to anon, authenticated, service_role;
grant execute on function public.mark_order_chat_read(uuid, public.order_chat_channel, uuid) to anon, authenticated, service_role;

create policy "Order chat participants can read messages"
on public.order_messages
for select
using (public.can_access_order_chat(order_id, channel, auth.uid()));

create policy "Order chat participants can send messages"
on public.order_messages
for insert
with check (
    sender_id = auth.uid()
    and public.can_access_order_chat(order_id, channel, auth.uid())
);

create policy "Order chat participants can read read-states"
on public.order_message_reads
for select
using (
    user_id = auth.uid()
    and public.can_access_order_chat(order_id, channel, auth.uid())
);

create policy "Order chat participants can insert read-states"
on public.order_message_reads
for insert
with check (
    user_id = auth.uid()
    and public.can_access_order_chat(order_id, channel, auth.uid())
);

create policy "Order chat participants can update read-states"
on public.order_message_reads
for update
using (
    user_id = auth.uid()
    and public.can_access_order_chat(order_id, channel, auth.uid())
)
with check (
    user_id = auth.uid()
    and public.can_access_order_chat(order_id, channel, auth.uid())
);
