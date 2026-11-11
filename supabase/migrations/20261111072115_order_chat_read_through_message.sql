create function public.read_order_chat_through_message(
    p_order_id uuid,
    p_channel public.order_chat_channel,
    p_message_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
    viewer uuid := auth.uid();
    message_time timestamptz;
begin
    if viewer is null or not public.can_access_order_chat(p_order_id, p_channel, viewer) then
        return false;
    end if;

    select created_at into message_time
    from public.order_messages
    where id = p_message_id and order_id = p_order_id and channel = p_channel;

    if not found then
        return false;
    end if;

    insert into public.order_message_reads (order_id, user_id, channel, last_read_message_at, updated_at)
    values (p_order_id, viewer, p_channel, message_time, now())
    on conflict (order_id, user_id, channel) do update
        set last_read_message_at = excluded.last_read_message_at, updated_at = now()
        where order_message_reads.last_read_message_at < excluded.last_read_message_at;

    update public.notifications as notification
    set read = true
    where notification.user_id = viewer
      and notification.type = 'order_message'
      and notification.read is not true
      and (
          exists (
              select 1
              from public.order_messages as message
              where message.id::text = notification.metadata->>'message_id'
                and message.order_id = p_order_id
                and message.channel = p_channel
                and message.created_at <= message_time
          )
          or (
              notification.metadata->>'message_id' is null
              and notification.created_at <= message_time
              and notification.action_url = public.order_chat_thread_url(viewer, p_order_id, p_channel)
          )
      );

    return true;
end;
$$;

revoke all on function public.read_order_chat_through_message(uuid, public.order_chat_channel, uuid) from public, anon;
grant execute on function public.read_order_chat_through_message(uuid, public.order_chat_channel, uuid) to authenticated;

create or replace function public.notify_order_chat_message()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
    v_order public.orders%rowtype;
    v_order_short text;
    v_sender_name text;
    v_sender_role text;
    v_thread_label text;
    v_recipient_ids uuid[];
    v_recipient_id uuid;
begin
    select *
    into v_order
    from public.orders
    where id = new.order_id;

    if not found then
        return new;
    end if;

    v_order_short := upper(substr(v_order.id::text, 1, 8));
    select full_name into v_sender_name from public.profiles where id = new.sender_id;
    v_sender_name := coalesce(v_sender_name, 'Someone');
    v_sender_role := coalesce(public.order_chat_role(new.order_id, new.sender_id), 'participant');
    v_thread_label := case
        when new.channel = 'ops'::public.order_chat_channel then 'operations thread'
        else 'customer thread'
    end;

    v_recipient_ids := case
        when new.channel = 'ops'::public.order_chat_channel
            then array[v_order.merchant_id, v_order.assigned_agent_id, v_order.rider_id]
        else array[v_order.customer_id, v_order.merchant_id, v_order.assigned_agent_id, v_order.rider_id]
    end;

    for v_recipient_id in
        select distinct recipient_id
        from unnest(v_recipient_ids) as recipient_id
    loop
        continue when v_recipient_id is null or v_recipient_id = new.sender_id;

        perform public.create_notification(
            v_recipient_id,
            'New message on order #' || v_order_short,
            v_sender_name || ' sent a new message in the ' || v_thread_label || ' for order #' || v_order_short || '.',
            'order_message',
            public.order_chat_thread_url(v_recipient_id, new.order_id, new.channel),
            jsonb_build_object(
                'order_id', new.order_id,
                'message_id', new.id,
                'event', 'order_message',
                'channel', new.channel,
                'sender_role', v_sender_role
            )
        );
    end loop;

    return new;
end;
$function$;
