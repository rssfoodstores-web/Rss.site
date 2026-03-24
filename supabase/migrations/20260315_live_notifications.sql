alter table public.notifications
    add column if not exists action_url text,
    add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists notifications_user_read_created_idx
    on public.notifications(user_id, read, created_at desc);

drop policy if exists "System can insert notifications" on public.notifications;
create policy "Users and admins can insert notifications"
on public.notifications
for insert
with check (
    auth.uid() = user_id
    or public.jwt_has_any_role(array['admin', 'sub_admin', 'supa_admin'])
);

create or replace function public.format_kobo_amount(p_amount_kobo bigint)
returns text
language sql
immutable
as $$
    select 'NGN ' || to_char(coalesce(p_amount_kobo, 0)::numeric / 100, 'FM999,999,999,990D00');
$$;

create or replace function public.order_action_url(p_user_id uuid, p_order public.orders)
returns text
language plpgsql
stable
as $$
begin
    if p_user_id is null then
        return null;
    end if;

    if p_order.customer_id = p_user_id then
        return '/account/orders/' || p_order.id::text;
    end if;

    if p_order.merchant_id = p_user_id then
        return '/merchant/orders/' || p_order.id::text;
    end if;

    if p_order.assigned_agent_id = p_user_id then
        return '/agent';
    end if;

    if p_order.rider_id = p_user_id then
        return '/rider';
    end if;

    return '/account/orders/' || p_order.id::text;
end;
$$;

create or replace function public.create_notification(
    p_user_id uuid,
    p_title text,
    p_message text,
    p_type text default null,
    p_action_url text default null,
    p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_notification_id uuid;
begin
    if p_user_id is null then
        return null;
    end if;

    insert into public.notifications (
        user_id,
        title,
        message,
        type,
        action_url,
        metadata
    )
    values (
        p_user_id,
        p_title,
        p_message,
        p_type,
        p_action_url,
        coalesce(p_metadata, '{}'::jsonb)
    )
    returning id into v_notification_id;

    return v_notification_id;
end;
$$;

create or replace function public.notify_order_parties()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_order_short text := upper(substr(new.id::text, 1, 8));
    v_customer_url text := public.order_action_url(new.customer_id, new);
    v_merchant_url text := public.order_action_url(new.merchant_id, new);
    v_agent_url text := public.order_action_url(new.assigned_agent_id, new);
    v_rider_url text := public.order_action_url(new.rider_id, new);
begin
    if tg_op = 'INSERT' and new.status = 'awaiting_agent_acceptance' and new.payment_status = 'paid' then
        perform public.create_notification(
            new.customer_id,
            'Order placed',
            'Order #' || v_order_short || ' has been confirmed and is waiting for agent coordination.',
            'order_update',
            v_customer_url,
            jsonb_build_object('order_id', new.id, 'event', 'order_placed')
        );

        perform public.create_notification(
            new.merchant_id,
            'New paid order',
            'Order #' || v_order_short || ' is waiting in your merchant queue.',
            'order_update',
            v_merchant_url,
            jsonb_build_object('order_id', new.id, 'event', 'merchant_new_order')
        );
    end if;

    if tg_op = 'UPDATE' and new.assigned_agent_id is distinct from old.assigned_agent_id and new.assigned_agent_id is not null then
        perform public.create_notification(
            new.assigned_agent_id,
            'New order assigned',
            'Order #' || v_order_short || ' has been assigned to you. Review and accept it from your dashboard.',
            'order_assignment',
            v_agent_url,
            jsonb_build_object('order_id', new.id, 'event', 'agent_assigned')
        );

        perform public.create_notification(
            new.customer_id,
            'Agent assigned',
            'An agent has been assigned to order #' || v_order_short || '.',
            'order_assignment',
            v_customer_url,
            jsonb_build_object('order_id', new.id, 'event', 'agent_assigned')
        );
    end if;

    if tg_op = 'UPDATE' and new.rider_id is distinct from old.rider_id and new.rider_id is not null then
        perform public.create_notification(
            new.rider_id,
            'Pickup mission assigned',
            'Order #' || v_order_short || ' is yours. Pickup code ' || coalesce(new.pickup_code, '----') || ', delivery code ' || coalesce(new.delivery_code, '----') || '.',
            'rider_assignment',
            v_rider_url,
            jsonb_build_object(
                'order_id', new.id,
                'event', 'rider_assigned',
                'pickup_code', new.pickup_code,
                'delivery_code', new.delivery_code
            )
        );

        perform public.create_notification(
            new.merchant_id,
            'Rider claimed your order',
            'A rider has claimed order #' || v_order_short || '. Verify pickup code ' || coalesce(new.pickup_code, '----') || ' at handoff.',
            'rider_assignment',
            v_merchant_url,
            jsonb_build_object('order_id', new.id, 'event', 'rider_assigned', 'pickup_code', new.pickup_code)
        );

        perform public.create_notification(
            new.customer_id,
            'Rider assigned',
            'A rider has been assigned to order #' || v_order_short || '.',
            'rider_assignment',
            v_customer_url,
            jsonb_build_object('order_id', new.id, 'event', 'rider_assigned')
        );

        perform public.create_notification(
            new.assigned_agent_id,
            'Rider claimed the order',
            'A rider has claimed order #' || v_order_short || '.',
            'rider_assignment',
            v_agent_url,
            jsonb_build_object('order_id', new.id, 'event', 'rider_assigned')
        );
    end if;

    if tg_op = 'INSERT' or new.status is distinct from old.status then
        case new.status
            when 'awaiting_agent_acceptance' then
                if tg_op = 'UPDATE' then
                    perform public.create_notification(
                        new.customer_id,
                        'Payment confirmed',
                        'Order #' || v_order_short || ' has been paid and is now waiting for agent coordination.',
                        'order_update',
                        v_customer_url,
                        jsonb_build_object('order_id', new.id, 'event', 'payment_confirmed')
                    );

                    perform public.create_notification(
                        new.merchant_id,
                        'New paid order',
                        'Order #' || v_order_short || ' has been paid and is waiting in your merchant queue.',
                        'order_update',
                        v_merchant_url,
                        jsonb_build_object('order_id', new.id, 'event', 'merchant_new_order')
                    );
                end if;
            when 'awaiting_merchant_confirmation' then
                perform public.create_notification(
                    new.assigned_agent_id,
                    'Assignment accepted',
                    'You accepted order #' || v_order_short || '. Waiting for merchant confirmation.',
                    'order_update',
                    v_agent_url,
                    jsonb_build_object('order_id', new.id, 'event', 'agent_accepted')
                );

                perform public.create_notification(
                    new.merchant_id,
                    'Merchant confirmation needed',
                    'Agent coordination has started for order #' || v_order_short || '. Confirm the order to begin preparation.',
                    'order_update',
                    v_merchant_url,
                    jsonb_build_object('order_id', new.id, 'event', 'merchant_confirmation_needed')
                );

                perform public.create_notification(
                    new.customer_id,
                    'Merchant confirmation pending',
                    'Order #' || v_order_short || ' is now with the merchant for confirmation.',
                    'order_update',
                    v_customer_url,
                    jsonb_build_object('order_id', new.id, 'event', 'merchant_confirmation_needed')
                );
            when 'processing' then
                perform public.create_notification(
                    new.merchant_id,
                    'Order is being prepared',
                    'Order #' || v_order_short || ' is now marked as preparing.',
                    'order_update',
                    v_merchant_url,
                    jsonb_build_object('order_id', new.id, 'event', 'processing')
                );

                perform public.create_notification(
                    new.assigned_agent_id,
                    'Merchant confirmed order',
                    'Merchant confirmed order #' || v_order_short || '. Request a rider when it is ready.',
                    'order_update',
                    v_agent_url,
                    jsonb_build_object('order_id', new.id, 'event', 'processing')
                );

                perform public.create_notification(
                    new.customer_id,
                    'Merchant is preparing your order',
                    'Order #' || v_order_short || ' is now being prepared.',
                    'order_update',
                    v_customer_url,
                    jsonb_build_object('order_id', new.id, 'event', 'processing')
                );
            when 'ready_for_pickup' then
                perform public.create_notification(
                    new.assigned_agent_id,
                    'Rider request is live',
                    'Order #' || v_order_short || ' is open for rider dispatch.',
                    'dispatch_update',
                    v_agent_url,
                    jsonb_build_object('order_id', new.id, 'event', 'ready_for_pickup')
                );

                perform public.create_notification(
                    new.merchant_id,
                    'Waiting for rider claim',
                    'Order #' || v_order_short || ' is now open for rider dispatch.',
                    'dispatch_update',
                    v_merchant_url,
                    jsonb_build_object('order_id', new.id, 'event', 'ready_for_pickup')
                );

                perform public.create_notification(
                    new.customer_id,
                    'Finding a rider',
                    'We are finding a rider for order #' || v_order_short || '.',
                    'dispatch_update',
                    v_customer_url,
                    jsonb_build_object('order_id', new.id, 'event', 'ready_for_pickup')
                );
            when 'out_for_delivery' then
                perform public.create_notification(
                    new.rider_id,
                    'Pickup verified',
                    'Merchant handoff is complete for order #' || v_order_short || '. Head to the customer now.',
                    'dispatch_update',
                    v_rider_url,
                    jsonb_build_object('order_id', new.id, 'event', 'out_for_delivery')
                );

                perform public.create_notification(
                    new.customer_id,
                    'Order is out for delivery',
                    'Order #' || v_order_short || ' is on the way. Keep your delivery code ready.',
                    'dispatch_update',
                    v_customer_url,
                    jsonb_build_object('order_id', new.id, 'event', 'out_for_delivery', 'delivery_code', new.delivery_code)
                );

                perform public.create_notification(
                    new.merchant_id,
                    'Order released to rider',
                    'Order #' || v_order_short || ' has left your store with the rider.',
                    'dispatch_update',
                    v_merchant_url,
                    jsonb_build_object('order_id', new.id, 'event', 'out_for_delivery')
                );

                perform public.create_notification(
                    new.assigned_agent_id,
                    'Order is out for delivery',
                    'Order #' || v_order_short || ' is now on the road.',
                    'dispatch_update',
                    v_agent_url,
                    jsonb_build_object('order_id', new.id, 'event', 'out_for_delivery')
                );
            when 'completed' then
                perform public.create_notification(
                    new.customer_id,
                    'Order delivered',
                    'Order #' || v_order_short || ' was delivered successfully.',
                    'order_update',
                    v_customer_url,
                    jsonb_build_object('order_id', new.id, 'event', 'completed')
                );

                perform public.create_notification(
                    new.merchant_id,
                    'Order completed',
                    'Order #' || v_order_short || ' was completed and your settlement has been posted.',
                    'order_update',
                    v_merchant_url,
                    jsonb_build_object('order_id', new.id, 'event', 'completed')
                );

                perform public.create_notification(
                    new.assigned_agent_id,
                    'Order completed',
                    'Order #' || v_order_short || ' was completed and your commission has been posted.',
                    'order_update',
                    v_agent_url,
                    jsonb_build_object('order_id', new.id, 'event', 'completed')
                );

                perform public.create_notification(
                    new.rider_id,
                    'Delivery completed',
                    'Order #' || v_order_short || ' was completed and your earnings have been posted.',
                    'order_update',
                    v_rider_url,
                    jsonb_build_object('order_id', new.id, 'event', 'completed')
                );
            when 'disputed' then
                perform public.create_notification(
                    new.customer_id,
                    'Order dispute opened',
                    'A dispute has been opened for order #' || v_order_short || '. Our team will review it.',
                    'order_issue',
                    v_customer_url,
                    jsonb_build_object('order_id', new.id, 'event', 'disputed')
                );

                perform public.create_notification(
                    new.merchant_id,
                    'Order dispute opened',
                    'A dispute has been opened for order #' || v_order_short || '.',
                    'order_issue',
                    v_merchant_url,
                    jsonb_build_object('order_id', new.id, 'event', 'disputed')
                );
            when 'refunded' then
                perform public.create_notification(
                    new.customer_id,
                    'Refund processed',
                    'Refund for order #' || v_order_short || ' has been processed to your wallet.',
                    'wallet_credit',
                    '/account/wallet',
                    jsonb_build_object('order_id', new.id, 'event', 'refunded')
                );

                perform public.create_notification(
                    new.merchant_id,
                    'Order refunded',
                    'Order #' || v_order_short || ' has been refunded.',
                    'order_issue',
                    v_merchant_url,
                    jsonb_build_object('order_id', new.id, 'event', 'refunded')
                );
        end case;
    end if;

    return new;
end;
$$;

create or replace function public.notify_wallet_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_owner_id uuid;
    v_amount_text text := public.format_kobo_amount(new.amount);
    v_wallet_url text := '/account/wallet';
begin
    select owner_id
    into v_owner_id
    from public.wallets
    where id = new.wallet_id;

    if v_owner_id is null then
        return new;
    end if;

    if tg_op = 'INSERT' then
        if new.type = 'credit' and new.status = 'pending' then
            perform public.create_notification(
                v_owner_id,
                'Top-up started',
                coalesce(new.description, 'Wallet top-up started') || '. Amount: ' || v_amount_text || '.',
                'wallet_pending',
                v_wallet_url,
                jsonb_build_object('reference', new.reference, 'event', 'wallet_credit_pending', 'amount_kobo', new.amount)
            );
        elsif new.type = 'debit' and new.status = 'pending' then
            perform public.create_notification(
                v_owner_id,
                'Withdrawal in progress',
                coalesce(new.description, 'Wallet withdrawal requested') || '. Amount: ' || v_amount_text || '.',
                'wallet_pending',
                v_wallet_url,
                jsonb_build_object('reference', new.reference, 'event', 'wallet_debit_pending', 'amount_kobo', new.amount)
            );
        elsif new.type = 'debit' and new.status = 'success' then
            perform public.create_notification(
                v_owner_id,
                'Wallet debited',
                coalesce(new.description, 'Wallet debit processed') || '. Amount: ' || v_amount_text || '.',
                'wallet_debit',
                v_wallet_url,
                jsonb_build_object('reference', new.reference, 'event', 'wallet_debited', 'amount_kobo', new.amount)
            );
        elsif new.type = 'credit' and new.status = 'success' then
            perform public.create_notification(
                v_owner_id,
                'Wallet credited',
                coalesce(new.description, 'Wallet credit processed') || '. Amount: ' || v_amount_text || '.',
                'wallet_credit',
                v_wallet_url,
                jsonb_build_object('reference', new.reference, 'event', 'wallet_credited', 'amount_kobo', new.amount)
            );
        end if;

        return new;
    end if;

    if new.status is distinct from old.status then
        if new.type = 'credit' and new.status = 'success' then
            perform public.create_notification(
                v_owner_id,
                'Top-up completed',
                coalesce(new.description, 'Wallet credit processed') || '. Amount: ' || v_amount_text || '.',
                'wallet_credit',
                v_wallet_url,
                jsonb_build_object('reference', new.reference, 'event', 'wallet_credit_completed', 'amount_kobo', new.amount)
            );
        elsif new.type = 'debit' and new.status = 'success' then
            perform public.create_notification(
                v_owner_id,
                'Withdrawal sent',
                coalesce(new.description, 'Wallet withdrawal completed') || '. Amount: ' || v_amount_text || '.',
                'wallet_debit',
                v_wallet_url,
                jsonb_build_object('reference', new.reference, 'event', 'wallet_debit_completed', 'amount_kobo', new.amount)
            );
        elsif new.type = 'debit' and new.status = 'failed' then
            perform public.create_notification(
                v_owner_id,
                'Withdrawal failed',
                coalesce(new.description, 'Wallet withdrawal failed') || '. Any held funds have been returned to your wallet if applicable.',
                'wallet_issue',
                v_wallet_url,
                jsonb_build_object('reference', new.reference, 'event', 'wallet_debit_failed', 'amount_kobo', new.amount)
            );
        end if;
    end if;

    return new;
end;
$$;

create or replace function public.notify_ledger_entry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_owner_id uuid;
    v_wallet_url text := '/account/wallet';
    v_amount_text text := public.format_kobo_amount(abs(new.amount));
    v_title text;
    v_type text;
begin
    select owner_id
    into v_owner_id
    from public.wallets
    where id = new.wallet_id;

    if v_owner_id is null then
        return new;
    end if;

    if new.amount >= 0 then
        if new.description ilike '%merchant payout%' then
            v_title := 'Merchant payout received';
            v_type := 'wallet_credit';
        elsif new.description ilike '%agent payout%' then
            v_title := 'Agent commission received';
            v_type := 'wallet_credit';
        elsif new.description ilike '%rider payout%' then
            v_title := 'Rider earnings received';
            v_type := 'wallet_credit';
        elsif new.description ilike '%refund%' then
            v_title := 'Refund credited';
            v_type := 'wallet_credit';
        else
            v_title := 'Wallet credited';
            v_type := 'wallet_credit';
        end if;
    else
        v_title := 'Wallet debited';
        v_type := 'wallet_debit';
    end if;

    perform public.create_notification(
        v_owner_id,
        v_title,
        coalesce(new.description, 'Wallet activity recorded') || '. Amount: ' || v_amount_text || '.',
        v_type,
        v_wallet_url,
        jsonb_build_object('reference_id', new.reference_id, 'event', 'ledger_entry', 'amount_kobo', new.amount)
    );

    return new;
end;
$$;

drop trigger if exists notify_order_parties_on_change on public.orders;
create trigger notify_order_parties_on_change
after insert or update of status, assigned_agent_id, rider_id, pickup_code, delivery_code, payment_status
on public.orders
for each row
execute function public.notify_order_parties();

drop trigger if exists notify_wallet_transaction_on_change on public.wallet_transactions;
create trigger notify_wallet_transaction_on_change
after insert or update of status
on public.wallet_transactions
for each row
execute function public.notify_wallet_transaction();

drop trigger if exists notify_ledger_entry_on_insert on public.ledger_entries;
create trigger notify_ledger_entry_on_insert
after insert
on public.ledger_entries
for each row
execute function public.notify_ledger_entry();
