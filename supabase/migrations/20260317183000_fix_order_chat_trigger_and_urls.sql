create or replace function public.order_chat_thread_url(
    p_user_id uuid,
    p_order_id uuid,
    p_channel public.order_chat_channel
)
returns text
language sql
stable
security definer
set search_path to 'public'
as $function$
    select case
        when o.customer_id = p_user_id
            then '/account/messages?order=' || o.id::text || '&channel=customer'
        when o.merchant_id = p_user_id
            then '/merchant/messages?order=' || o.id::text || '&channel=' || p_channel::text
        when o.assigned_agent_id = p_user_id
            then '/agent/messages?order=' || o.id::text || '&channel=' || p_channel::text
        when o.rider_id = p_user_id
            then '/rider/messages?order=' || o.id::text || '&channel=' || p_channel::text
        else '/account/messages?order=' || o.id::text || '&channel=customer'
    end
    from public.orders o
    where o.id = p_order_id;
$function$;

create or replace function public.order_chat_thread_url(
    p_user_id uuid,
    p_order_id uuid
)
returns text
language sql
stable
security definer
set search_path to 'public'
as $function$
    select public.order_chat_thread_url(
        p_user_id,
        p_order_id,
        case
            when o.customer_id = p_user_id then 'customer'::public.order_chat_channel
            when o.merchant_id = p_user_id then 'ops'::public.order_chat_channel
            when o.assigned_agent_id = p_user_id then 'ops'::public.order_chat_channel
            when o.rider_id = p_user_id then 'ops'::public.order_chat_channel
            else 'customer'::public.order_chat_channel
        end
    )
    from public.orders o
    where o.id = p_order_id;
$function$;

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

    perform public.mark_order_chat_read(new.order_id, new.channel, new.sender_id);

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
