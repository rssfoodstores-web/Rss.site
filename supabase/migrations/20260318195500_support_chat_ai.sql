insert into public.app_settings (key, value, description)
values (
    'support_ai_settings',
    jsonb_build_object(
        'enabled', true,
        'assistant_name', 'RSS Support',
        'welcome_title', 'Chat with RSS Support',
        'welcome_message', 'Ask about orders, delivery timelines, payment instructions, gift cards, reward points, or checkout help.',
        'handoff_message', 'We could not fully resolve this in chat. Our human support team will review the conversation and follow up using your email or phone number.',
        'model', 'gemini-2.5-flash',
        'system_prompt', 'You are the RSS Foods website support assistant. Keep answers concise, practical, and accurate. You can help with order tracking guidance, delivery timelines, payment instructions, gift cards, reward points, checkout guidance, contact-page support, and general account questions. Do not invent live order statuses, inventory numbers, or policy promises. When a user needs manual intervention, refund handling, failed payment investigation, account recovery, merchant-only action, or anything you cannot confirm safely, mark the issue for human follow-up.'
    ),
    'AI support chat settings for the contact-page support widget.'
)
on conflict (key) do update
set value = coalesce(public.app_settings.value, '{}'::jsonb) || excluded.value,
    description = excluded.description;

create table if not exists public.support_conversations (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references public.profiles(id) on delete set null,
    visitor_name text not null,
    visitor_email text not null,
    visitor_phone text,
    subject text,
    channel text not null default 'contact_page' check (channel in ('contact_page')),
    status text not null default 'open' check (status in ('open', 'human_follow_up', 'resolved')),
    ai_enabled_snapshot boolean not null default true,
    resolved_by_ai boolean not null default false,
    escalated_to_human boolean not null default false,
    access_token_hash text not null unique,
    last_customer_message_at timestamptz,
    last_ai_message_at timestamptz,
    last_message_at timestamptz not null default now(),
    last_message_preview text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.support_messages (
    id uuid primary key default uuid_generate_v4(),
    conversation_id uuid not null references public.support_conversations(id) on delete cascade,
    sender_role text not null check (sender_role in ('customer', 'assistant', 'admin', 'system')),
    sender_id uuid references public.profiles(id) on delete set null,
    body text not null check (char_length(btrim(body)) > 0 and char_length(body) <= 4000),
    ai_generated boolean not null default false,
    escalation_marker boolean not null default false,
    response_time_ms integer check (response_time_ms is null or response_time_ms >= 0),
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists support_conversations_last_message_idx
    on public.support_conversations (last_message_at desc);

create index if not exists support_conversations_status_idx
    on public.support_conversations (status, escalated_to_human, resolved_by_ai);

create index if not exists support_conversations_user_idx
    on public.support_conversations (user_id, created_at desc);

create index if not exists support_messages_conversation_created_idx
    on public.support_messages (conversation_id, created_at asc);

drop trigger if exists support_conversations_set_updated_at on public.support_conversations;
create trigger support_conversations_set_updated_at
before update on public.support_conversations
for each row
execute function public.set_updated_at();

create or replace function public.support_hash_token(p_token text)
returns text
language sql
immutable
strict
set search_path = public
as $$
    select md5(btrim(p_token));
$$;

create or replace function public.get_support_ai_settings()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
    select
        jsonb_build_object(
            'enabled', true,
            'assistant_name', 'RSS Support',
            'welcome_title', 'Chat with RSS Support',
            'welcome_message', 'Ask about orders, delivery timelines, payment instructions, gift cards, reward points, or checkout help.',
            'handoff_message', 'We could not fully resolve this in chat. Our human support team will review the conversation and follow up using your email or phone number.',
            'model', 'gemini-2.5-flash',
            'system_prompt', 'You are the RSS Foods website support assistant. Keep answers concise, practical, and accurate. You can help with order tracking guidance, delivery timelines, payment instructions, gift cards, reward points, checkout guidance, contact-page support, and general account questions. Do not invent live order statuses, inventory numbers, or policy promises. When a user needs manual intervention, refund handling, failed payment investigation, account recovery, merchant-only action, or anything you cannot confirm safely, mark the issue for human follow-up.'
        ) || coalesce(
            (
                select value
                from public.app_settings
                where key = 'support_ai_settings'
            ),
            '{}'::jsonb
        );
$$;

create or replace function public.support_user_can_access_conversation(
    p_conversation_id uuid,
    p_access_token text default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_allowed boolean := false;
    v_token text := nullif(btrim(coalesce(p_access_token, '')), '');
begin
    if public.jwt_has_any_role(array['admin', 'sub_admin', 'supa_admin']) then
        return true;
    end if;

    select exists (
        select 1
        from public.support_conversations sc
        where sc.id = p_conversation_id
          and (
              (auth.uid() is not null and sc.user_id = auth.uid())
              or (v_token is not null and sc.access_token_hash = public.support_hash_token(v_token))
          )
    )
    into v_allowed;

    return coalesce(v_allowed, false);
end;
$$;

create or replace function public.start_support_conversation(
    p_name text,
    p_email text,
    p_initial_message text,
    p_phone text default null,
    p_subject text default null,
    p_channel text default 'contact_page'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_name text := btrim(coalesce(p_name, ''));
    v_email text := lower(btrim(coalesce(p_email, '')));
    v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
    v_subject text := nullif(btrim(coalesce(p_subject, '')), '');
    v_message text := btrim(coalesce(p_initial_message, ''));
    v_channel text := coalesce(nullif(btrim(coalesce(p_channel, '')), ''), 'contact_page');
    v_token text := encode(gen_random_bytes(24), 'hex');
    v_conversation_id uuid;
    v_settings jsonb := public.get_support_ai_settings();
    v_ai_enabled boolean := coalesce((v_settings ->> 'enabled')::boolean, true);
begin
    if char_length(v_name) < 2 then
        raise exception 'Please provide your name.';
    end if;

    if v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
        raise exception 'Please provide a valid email address.';
    end if;

    if char_length(v_message) < 2 then
        raise exception 'Please enter a support message.';
    end if;

    if char_length(v_message) > 4000 then
        raise exception 'Support messages must be 4000 characters or fewer.';
    end if;

    if v_channel <> 'contact_page' then
        raise exception 'Unsupported support channel.';
    end if;

    insert into public.support_conversations (
        user_id,
        visitor_name,
        visitor_email,
        visitor_phone,
        subject,
        channel,
        status,
        ai_enabled_snapshot,
        access_token_hash,
        last_customer_message_at,
        last_message_at,
        last_message_preview
    )
    values (
        auth.uid(),
        v_name,
        v_email,
        v_phone,
        v_subject,
        v_channel,
        case when v_ai_enabled then 'open' else 'human_follow_up' end,
        v_ai_enabled,
        public.support_hash_token(v_token),
        now(),
        now(),
        left(v_message, 220)
    )
    returning id into v_conversation_id;

    insert into public.support_messages (
        conversation_id,
        sender_role,
        body,
        ai_generated,
        escalation_marker,
        metadata
    )
    values (
        v_conversation_id,
        'customer',
        v_message,
        false,
        false,
        jsonb_build_object('channel', v_channel)
    );

    return jsonb_build_object(
        'conversationId', v_conversation_id,
        'accessToken', v_token,
        'aiEnabled', v_ai_enabled,
        'handoffMessage', coalesce(v_settings ->> 'handoff_message', '')
    );
end;
$$;

create or replace function public.append_support_customer_message(
    p_conversation_id uuid,
    p_access_token text,
    p_message text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_message text := btrim(coalesce(p_message, ''));
begin
    if not public.support_user_can_access_conversation(p_conversation_id, p_access_token) then
        raise exception 'Unauthorized conversation access.';
    end if;

    if char_length(v_message) < 2 then
        raise exception 'Please enter a support message.';
    end if;

    if char_length(v_message) > 4000 then
        raise exception 'Support messages must be 4000 characters or fewer.';
    end if;

    insert into public.support_messages (
        conversation_id,
        sender_role,
        body,
        ai_generated,
        escalation_marker
    )
    values (
        p_conversation_id,
        'customer',
        v_message,
        false,
        false
    );

    update public.support_conversations
    set
        last_customer_message_at = now(),
        last_message_at = now(),
        last_message_preview = left(v_message, 220),
        status = case when status = 'resolved' then 'open' else status end,
        resolved_by_ai = case when status = 'resolved' then false else resolved_by_ai end
    where id = p_conversation_id;

    return jsonb_build_object('success', true);
end;
$$;

create or replace function public.append_support_assistant_message(
    p_conversation_id uuid,
    p_access_token text,
    p_body text,
    p_should_escalate boolean default false,
    p_resolved_by_ai boolean default false,
    p_response_time_ms integer default null,
    p_sender_role text default 'assistant',
    p_ai_generated boolean default true,
    p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_body text := btrim(coalesce(p_body, ''));
    v_sender_role text := coalesce(nullif(btrim(coalesce(p_sender_role, '')), ''), 'assistant');
begin
    if not public.support_user_can_access_conversation(p_conversation_id, p_access_token) then
        raise exception 'Unauthorized conversation access.';
    end if;

    if v_sender_role not in ('assistant', 'system') then
        raise exception 'Unsupported assistant sender role.';
    end if;

    if char_length(v_body) < 2 then
        raise exception 'Assistant message cannot be empty.';
    end if;

    if char_length(v_body) > 4000 then
        raise exception 'Assistant messages must be 4000 characters or fewer.';
    end if;

    insert into public.support_messages (
        conversation_id,
        sender_role,
        body,
        ai_generated,
        escalation_marker,
        response_time_ms,
        metadata
    )
    values (
        p_conversation_id,
        v_sender_role,
        v_body,
        coalesce(p_ai_generated, false),
        coalesce(p_should_escalate, false),
        case when coalesce(p_ai_generated, false) then greatest(coalesce(p_response_time_ms, 0), 0) else null end,
        coalesce(p_metadata, '{}'::jsonb)
    );

    update public.support_conversations
    set
        last_ai_message_at = case when v_sender_role = 'assistant' then now() else last_ai_message_at end,
        last_message_at = now(),
        last_message_preview = left(v_body, 220),
        status = case
            when coalesce(p_should_escalate, false) then 'human_follow_up'
            when coalesce(p_resolved_by_ai, false) then 'resolved'
            when status = 'resolved' then 'open'
            else status
        end,
        escalated_to_human = escalated_to_human or coalesce(p_should_escalate, false),
        resolved_by_ai = case
            when coalesce(p_should_escalate, false) then false
            when coalesce(p_resolved_by_ai, false) then true
            else false
        end
    where id = p_conversation_id;

    return jsonb_build_object('success', true);
end;
$$;

create or replace function public.get_support_conversation_snapshot(
    p_conversation_id uuid,
    p_access_token text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_conversation public.support_conversations%rowtype;
    v_messages jsonb := '[]'::jsonb;
begin
    if not public.support_user_can_access_conversation(p_conversation_id, p_access_token) then
        raise exception 'Unauthorized conversation access.';
    end if;

    select *
    into v_conversation
    from public.support_conversations
    where id = p_conversation_id;

    if not found then
        raise exception 'Support conversation not found.';
    end if;

    select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'id', sm.id,
                'conversationId', sm.conversation_id,
                'senderRole', sm.sender_role,
                'body', sm.body,
                'aiGenerated', sm.ai_generated,
                'escalationMarker', sm.escalation_marker,
                'responseTimeMs', sm.response_time_ms,
                'metadata', sm.metadata,
                'createdAt', sm.created_at
            )
            order by sm.created_at asc
        ),
        '[]'::jsonb
    )
    into v_messages
    from public.support_messages sm
    where sm.conversation_id = v_conversation.id;

    return jsonb_build_object(
        'conversation',
        jsonb_build_object(
            'id', v_conversation.id,
            'userId', v_conversation.user_id,
            'visitorName', v_conversation.visitor_name,
            'visitorEmail', v_conversation.visitor_email,
            'visitorPhone', v_conversation.visitor_phone,
            'subject', v_conversation.subject,
            'channel', v_conversation.channel,
            'status', v_conversation.status,
            'aiEnabledSnapshot', v_conversation.ai_enabled_snapshot,
            'resolvedByAi', v_conversation.resolved_by_ai,
            'escalatedToHuman', v_conversation.escalated_to_human,
            'lastCustomerMessageAt', v_conversation.last_customer_message_at,
            'lastAiMessageAt', v_conversation.last_ai_message_at,
            'lastMessageAt', v_conversation.last_message_at,
            'lastMessagePreview', v_conversation.last_message_preview,
            'createdAt', v_conversation.created_at,
            'updatedAt', v_conversation.updated_at
        ),
        'messages', v_messages
    );
end;
$$;

alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;

drop policy if exists "Admins can manage support conversations" on public.support_conversations;
create policy "Admins can manage support conversations"
on public.support_conversations
using (public.jwt_has_any_role(array['admin', 'sub_admin', 'supa_admin']))
with check (public.jwt_has_any_role(array['admin', 'sub_admin', 'supa_admin']));

drop policy if exists "Conversation owners can view own support conversations" on public.support_conversations;
create policy "Conversation owners can view own support conversations"
on public.support_conversations
for select
using (user_id = auth.uid());

drop policy if exists "Admins can manage support messages" on public.support_messages;
create policy "Admins can manage support messages"
on public.support_messages
using (public.jwt_has_any_role(array['admin', 'sub_admin', 'supa_admin']))
with check (public.jwt_has_any_role(array['admin', 'sub_admin', 'supa_admin']));

drop policy if exists "Conversation owners can view own support messages" on public.support_messages;
create policy "Conversation owners can view own support messages"
on public.support_messages
for select
using (
    exists (
        select 1
        from public.support_conversations sc
        where sc.id = support_messages.conversation_id
          and sc.user_id = auth.uid()
    )
);

grant select, update on public.support_conversations to authenticated, service_role;
grant select on public.support_messages to authenticated, service_role;

grant execute on function public.get_support_ai_settings() to anon, authenticated, service_role;
grant execute on function public.support_user_can_access_conversation(uuid, text) to anon, authenticated, service_role;
grant execute on function public.start_support_conversation(text, text, text, text, text, text) to anon, authenticated, service_role;
grant execute on function public.append_support_customer_message(uuid, text, text) to anon, authenticated, service_role;
grant execute on function public.append_support_assistant_message(uuid, text, text, boolean, boolean, integer, text, boolean, jsonb) to anon, authenticated, service_role;
grant execute on function public.get_support_conversation_snapshot(uuid, text) to anon, authenticated, service_role;

do $$
begin
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
        if not exists (
            select 1
            from pg_publication_tables
            where pubname = 'supabase_realtime'
              and schemaname = 'public'
              and tablename = 'support_conversations'
        ) then
            alter publication supabase_realtime add table public.support_conversations;
        end if;

        if not exists (
            select 1
            from pg_publication_tables
            where pubname = 'supabase_realtime'
              and schemaname = 'public'
              and tablename = 'support_messages'
        ) then
            alter publication supabase_realtime add table public.support_messages;
        end if;
    end if;
end
$$;
