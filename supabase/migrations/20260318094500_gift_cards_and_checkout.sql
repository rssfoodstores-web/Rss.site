create table if not exists public.gift_cards (
    id uuid primary key default uuid_generate_v4(),
    code text not null unique,
    purchaser_id uuid not null references public.profiles(id) on delete cascade,
    recipient_id uuid not null references public.profiles(id) on delete cascade,
    recipient_email text not null,
    amount_kobo bigint not null check (amount_kobo > 0),
    remaining_amount_kobo bigint not null check (
        remaining_amount_kobo >= 0
        and remaining_amount_kobo <= amount_kobo
    ),
    payment_method text not null check (payment_method in ('wallet', 'direct')),
    payment_reference text not null unique,
    message text,
    status text not null default 'pending' check (status in ('pending', 'active', 'depleted', 'cancelled', 'refunded')),
    delivered_at timestamptz,
    expires_at timestamptz,
    last_used_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists gift_cards_recipient_status_idx
    on public.gift_cards (recipient_id, status, created_at desc);

create index if not exists gift_cards_purchaser_created_idx
    on public.gift_cards (purchaser_id, created_at desc);

create table if not exists public.gift_card_transactions (
    id uuid primary key default uuid_generate_v4(),
    gift_card_id uuid not null references public.gift_cards(id) on delete cascade,
    actor_id uuid references public.profiles(id) on delete set null,
    transaction_type text not null check (transaction_type in ('purchase', 'debit', 'refund', 'expire')),
    amount_kobo bigint not null check (amount_kobo > 0),
    reference text,
    description text not null,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists gift_card_transactions_card_created_idx
    on public.gift_card_transactions (gift_card_id, created_at desc);

alter table public.gift_cards enable row level security;
alter table public.gift_card_transactions enable row level security;

drop policy if exists "Users can view their own gift cards" on public.gift_cards;
create policy "Users can view their own gift cards"
on public.gift_cards
for select
using (
    auth.uid() = purchaser_id
    or auth.uid() = recipient_id
    or public.jwt_has_any_role(array['admin', 'sub_admin', 'supa_admin'])
);

drop policy if exists "Users can view their own gift card transactions" on public.gift_card_transactions;
create policy "Users can view their own gift card transactions"
on public.gift_card_transactions
for select
using (
    exists (
        select 1
        from public.gift_cards gc
        where gc.id = gift_card_transactions.gift_card_id
          and (
              gc.purchaser_id = auth.uid()
              or gc.recipient_id = auth.uid()
              or public.jwt_has_any_role(array['admin', 'sub_admin', 'supa_admin'])
          )
    )
);

create or replace function public.generate_gift_card_code()
returns text
language plpgsql
set search_path = public
as $function$
declare
    v_code text;
begin
    loop
        v_code := 'RSS-' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 4))
            || '-' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 4))
            || '-' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 4));

        exit when not exists (
            select 1
            from public.gift_cards
            where code = v_code
        );
    end loop;

    return v_code;
end;
$function$;

create or replace function public.lookup_gift_card_recipient(
    p_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
    v_actor uuid := auth.uid();
    v_normalized_email text := lower(btrim(coalesce(p_email, '')));
    v_recipient record;
begin
    if v_actor is null then
        return jsonb_build_object('success', false, 'error', 'Authentication required');
    end if;

    if v_normalized_email = '' then
        return jsonb_build_object('success', false, 'error', 'Recipient email is required');
    end if;

    select
        u.id,
        lower(u.email) as email,
        p.full_name
    into v_recipient
    from auth.users u
    join public.profiles p on p.id = u.id
    where lower(u.email) = v_normalized_email
    limit 1;

    if v_recipient.id is null then
        return jsonb_build_object('success', false, 'error', 'No account was found for that email');
    end if;

    return jsonb_build_object(
        'success', true,
        'user_id', v_recipient.id,
        'email', v_recipient.email,
        'full_name', v_recipient.full_name
    );
end;
$function$;

create or replace function public.purchase_gift_card_with_wallet(
    p_recipient_email text,
    p_amount_kobo bigint,
    p_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
    v_actor uuid := auth.uid();
    v_normalized_email text := lower(btrim(coalesce(p_recipient_email, '')));
    v_message text := nullif(btrim(coalesce(p_message, '')), '');
    v_wallet_id uuid;
    v_wallet_balance bigint;
    v_gift_card_id uuid;
    v_payment_reference text := 'GFT-WAL-' || encode(gen_random_bytes(8), 'hex');
    v_code text := public.generate_gift_card_code();
    v_recipient record;
    v_sender_name text;
begin
    if v_actor is null then
        return jsonb_build_object('success', false, 'error', 'Authentication required');
    end if;

    if p_amount_kobo is null or p_amount_kobo <= 0 then
        return jsonb_build_object('success', false, 'error', 'Gift card amount must be greater than zero');
    end if;

    if v_normalized_email = '' then
        return jsonb_build_object('success', false, 'error', 'Recipient email is required');
    end if;

    select
        u.id,
        lower(u.email) as email,
        p.full_name
    into v_recipient
    from auth.users u
    join public.profiles p on p.id = u.id
    where lower(u.email) = v_normalized_email
    limit 1;

    if v_recipient.id is null then
        return jsonb_build_object('success', false, 'error', 'No account was found for that email');
    end if;

    select full_name
    into v_sender_name
    from public.profiles
    where id = v_actor;

    v_wallet_id := public.ensure_actor_wallet(v_actor, 'customer');

    select balance
    into v_wallet_balance
    from public.wallets
    where id = v_wallet_id
    for update;

    if coalesce(v_wallet_balance, 0) < p_amount_kobo then
        return jsonb_build_object('success', false, 'error', 'Insufficient wallet balance');
    end if;

    insert into public.gift_cards (
        code,
        purchaser_id,
        recipient_id,
        recipient_email,
        amount_kobo,
        remaining_amount_kobo,
        payment_method,
        payment_reference,
        message,
        status,
        delivered_at
    )
    values (
        v_code,
        v_actor,
        v_recipient.id,
        v_recipient.email,
        p_amount_kobo,
        p_amount_kobo,
        'wallet',
        v_payment_reference,
        v_message,
        'active',
        now()
    )
    returning id into v_gift_card_id;

    update public.wallets
    set balance = balance - p_amount_kobo
    where id = v_wallet_id;

    insert into public.wallet_transactions (
        wallet_id,
        amount,
        type,
        status,
        reference,
        description
    )
    values (
        v_wallet_id,
        p_amount_kobo,
        'debit',
        'success',
        v_payment_reference,
        'Gift card purchase for ' || coalesce(v_recipient.full_name, v_recipient.email)
    );

    insert into public.gift_card_transactions (
        gift_card_id,
        actor_id,
        transaction_type,
        amount_kobo,
        reference,
        description,
        metadata
    )
    values (
        v_gift_card_id,
        v_actor,
        'purchase',
        p_amount_kobo,
        v_payment_reference,
        'Gift card purchased and delivered',
        jsonb_build_object('recipient_id', v_recipient.id, 'recipient_email', v_recipient.email)
    );

    perform public.create_notification(
        v_recipient.id,
        'Gift card received',
        coalesce(v_sender_name, 'Someone') || ' sent you a gift card worth ' || public.format_kobo_amount(p_amount_kobo) || '.',
        'gift_card_received',
        '/account/gift-card',
        jsonb_build_object('gift_card_id', v_gift_card_id, 'sender_id', v_actor, 'amount_kobo', p_amount_kobo)
    );

    perform public.create_notification(
        v_actor,
        'Gift card sent',
        'Your gift card to ' || coalesce(v_recipient.full_name, v_recipient.email) || ' is active.',
        'gift_card_sent',
        '/account/gift-card',
        jsonb_build_object('gift_card_id', v_gift_card_id, 'recipient_id', v_recipient.id, 'amount_kobo', p_amount_kobo)
    );

    perform public.write_audit_log(
        v_actor,
        'purchase_gift_card_with_wallet',
        'gift_card',
        v_gift_card_id,
        jsonb_build_object('payment_reference', v_payment_reference, 'recipient_id', v_recipient.id, 'amount_kobo', p_amount_kobo)
    );

    return jsonb_build_object(
        'success', true,
        'gift_card_id', v_gift_card_id,
        'payment_reference', v_payment_reference,
        'code', v_code
    );
end;
$function$;

create or replace function public.create_pending_gift_card_purchase(
    p_recipient_email text,
    p_amount_kobo bigint,
    p_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
    v_actor uuid := auth.uid();
    v_normalized_email text := lower(btrim(coalesce(p_recipient_email, '')));
    v_message text := nullif(btrim(coalesce(p_message, '')), '');
    v_gift_card_id uuid;
    v_payment_reference text := 'GFT-' || encode(gen_random_bytes(8), 'hex');
    v_code text := public.generate_gift_card_code();
    v_recipient record;
begin
    if v_actor is null then
        return jsonb_build_object('success', false, 'error', 'Authentication required');
    end if;

    if p_amount_kobo is null or p_amount_kobo <= 0 then
        return jsonb_build_object('success', false, 'error', 'Gift card amount must be greater than zero');
    end if;

    if v_normalized_email = '' then
        return jsonb_build_object('success', false, 'error', 'Recipient email is required');
    end if;

    select
        u.id,
        lower(u.email) as email,
        p.full_name
    into v_recipient
    from auth.users u
    join public.profiles p on p.id = u.id
    where lower(u.email) = v_normalized_email
    limit 1;

    if v_recipient.id is null then
        return jsonb_build_object('success', false, 'error', 'No account was found for that email');
    end if;

    insert into public.gift_cards (
        code,
        purchaser_id,
        recipient_id,
        recipient_email,
        amount_kobo,
        remaining_amount_kobo,
        payment_method,
        payment_reference,
        message,
        status
    )
    values (
        v_code,
        v_actor,
        v_recipient.id,
        v_recipient.email,
        p_amount_kobo,
        p_amount_kobo,
        'direct',
        v_payment_reference,
        v_message,
        'pending'
    )
    returning id into v_gift_card_id;

    perform public.write_audit_log(
        v_actor,
        'create_pending_gift_card_purchase',
        'gift_card',
        v_gift_card_id,
        jsonb_build_object('payment_reference', v_payment_reference, 'recipient_id', v_recipient.id, 'amount_kobo', p_amount_kobo)
    );

    return jsonb_build_object(
        'success', true,
        'gift_card_id', v_gift_card_id,
        'payment_reference', v_payment_reference,
        'code', v_code,
        'recipient_id', v_recipient.id,
        'recipient_name', v_recipient.full_name
    );
end;
$function$;

create or replace function public.mark_gift_card_purchase_paid(
    p_gift_card_id uuid,
    p_payment_reference text,
    p_amount_kobo bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
    v_gift_card record;
    v_sender_name text;
begin
    select *
    into v_gift_card
    from public.gift_cards
    where id = p_gift_card_id
    for update;

    if not found then
        return jsonb_build_object('success', false, 'error', 'Gift card not found');
    end if;

    if v_gift_card.status in ('active', 'depleted') then
        return jsonb_build_object('success', true, 'gift_card_id', v_gift_card.id, 'message', 'Gift card already activated');
    end if;

    if v_gift_card.status <> 'pending' then
        return jsonb_build_object('success', false, 'error', 'Gift card purchase cannot be activated from its current state');
    end if;

    if p_amount_kobo is null or p_amount_kobo <> v_gift_card.amount_kobo then
        return jsonb_build_object('success', false, 'error', 'Gift card payment amount mismatch');
    end if;

    if coalesce(p_payment_reference, '') <> '' and p_payment_reference <> v_gift_card.payment_reference then
        return jsonb_build_object('success', false, 'error', 'Gift card payment reference mismatch');
    end if;

    update public.gift_cards
    set status = 'active',
        delivered_at = now(),
        updated_at = now()
    where id = v_gift_card.id;

    if not exists (
        select 1
        from public.gift_card_transactions
        where gift_card_id = v_gift_card.id
          and transaction_type = 'purchase'
          and reference = v_gift_card.payment_reference
    ) then
        insert into public.gift_card_transactions (
            gift_card_id,
            actor_id,
            transaction_type,
            amount_kobo,
            reference,
            description,
            metadata
        )
        values (
            v_gift_card.id,
            v_gift_card.purchaser_id,
            'purchase',
            v_gift_card.amount_kobo,
            v_gift_card.payment_reference,
            'Gift card purchased and delivered',
            jsonb_build_object('recipient_id', v_gift_card.recipient_id, 'recipient_email', v_gift_card.recipient_email)
        );
    end if;

    select full_name
    into v_sender_name
    from public.profiles
    where id = v_gift_card.purchaser_id;

    perform public.create_notification(
        v_gift_card.recipient_id,
        'Gift card received',
        coalesce(v_sender_name, 'Someone') || ' sent you a gift card worth ' || public.format_kobo_amount(v_gift_card.amount_kobo) || '.',
        'gift_card_received',
        '/account/gift-card',
        jsonb_build_object('gift_card_id', v_gift_card.id, 'sender_id', v_gift_card.purchaser_id, 'amount_kobo', v_gift_card.amount_kobo)
    );

    perform public.create_notification(
        v_gift_card.purchaser_id,
        'Gift card sent',
        'Your gift card to ' || coalesce(v_gift_card.recipient_email, 'the recipient') || ' is active.',
        'gift_card_sent',
        '/account/gift-card',
        jsonb_build_object('gift_card_id', v_gift_card.id, 'recipient_id', v_gift_card.recipient_id, 'amount_kobo', v_gift_card.amount_kobo)
    );

    perform public.write_audit_log(
        null,
        'mark_gift_card_purchase_paid',
        'gift_card',
        v_gift_card.id,
        jsonb_build_object('payment_reference', v_gift_card.payment_reference, 'amount_kobo', v_gift_card.amount_kobo)
    );

    return jsonb_build_object('success', true, 'gift_card_id', v_gift_card.id);
end;
$function$;

create or replace function public.create_paid_order_with_gift_card(
    p_user_id uuid,
    p_items jsonb,
    p_delivery_location jsonb,
    p_delivery_fee_kobo bigint default 0,
    p_contact_numbers jsonb default '[]'::jsonb,
    p_payment_reference text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
    v_actor uuid := auth.uid();
    v_order_id uuid;
    v_item record;
    v_product record;
    v_merchant_id uuid;
    v_total_kobo bigint := 0;
    v_payment_reference text := coalesce(p_payment_reference, 'GFTPAY-' || encode(gen_random_bytes(8), 'hex'));
    v_assigned_agent_id uuid;
    v_available_kobo bigint := 0;
    v_remaining_to_apply bigint;
    v_debit_kobo bigint;
    v_gift_card record;
begin
    if v_actor is null then
        return jsonb_build_object('success', false, 'error', 'Authentication required');
    end if;

    if p_user_id is distinct from v_actor then
        return jsonb_build_object('success', false, 'error', 'You can only place orders for your own account');
    end if;

    if not exists (
        select 1
        from public.agent_profiles ap
        where ap.status = 'approved'
    ) then
        return jsonb_build_object('success', false, 'error', 'No approved agents are currently available');
    end if;

    if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
        return jsonb_build_object('success', false, 'error', 'Cart is empty');
    end if;

    for v_item in
        select *
        from jsonb_to_recordset(p_items) as item(product_id uuid, quantity integer)
    loop
        if coalesce(v_item.quantity, 0) <= 0 then
            return jsonb_build_object('success', false, 'error', 'Invalid quantity in cart');
        end if;

        select p.id, p.name, p.price, p.stock_level, p.merchant_id
        into v_product
        from public.products p
        where p.id = v_item.product_id
          and p.status = 'approved'
        for update;

        if v_product.id is null then
            return jsonb_build_object('success', false, 'error', 'Product not found or not approved');
        end if;

        if coalesce(v_product.stock_level, 0) < v_item.quantity then
            return jsonb_build_object('success', false, 'error', 'Insufficient stock for ' || v_product.name);
        end if;

        if v_merchant_id is null then
            v_merchant_id := v_product.merchant_id;
        elsif v_merchant_id <> v_product.merchant_id then
            return jsonb_build_object('success', false, 'error', 'Mixed merchant carts are not allowed');
        end if;

        v_total_kobo := v_total_kobo + (v_product.price * v_item.quantity);
    end loop;

    v_total_kobo := v_total_kobo + greatest(coalesce(p_delivery_fee_kobo, 0), 0);
    v_remaining_to_apply := v_total_kobo;

    for v_gift_card in
        select id, code, remaining_amount_kobo
        from public.gift_cards
        where recipient_id = p_user_id
          and status = 'active'
          and remaining_amount_kobo > 0
          and (expires_at is null or expires_at > now())
        order by expires_at asc nulls last, created_at asc
        for update
    loop
        v_available_kobo := v_available_kobo + v_gift_card.remaining_amount_kobo;
    end loop;

    if v_available_kobo < v_total_kobo then
        return jsonb_build_object('success', false, 'error', 'Insufficient gift card balance');
    end if;

    insert into public.orders (
        customer_id,
        merchant_id,
        total_amount,
        status,
        payment_status,
        delivery_location,
        payment_ref,
        delivery_fee_kobo,
        delivery_fee,
        contact_numbers
    )
    values (
        p_user_id,
        v_merchant_id,
        v_total_kobo,
        'awaiting_agent_acceptance',
        'paid',
        case
            when p_delivery_location is null then null
            else ST_SetSRID(ST_GeomFromGeoJSON(p_delivery_location), 4326)::geography
        end,
        v_payment_reference,
        greatest(coalesce(p_delivery_fee_kobo, 0), 0),
        greatest(coalesce(p_delivery_fee_kobo, 0), 0) / 100.0,
        coalesce(p_contact_numbers, '[]'::jsonb)
    )
    returning id into v_order_id;

    for v_item in
        select *
        from jsonb_to_recordset(p_items) as item(product_id uuid, quantity integer)
    loop
        select p.id, p.price
        into v_product
        from public.products p
        where p.id = v_item.product_id;

        insert into public.order_items (
            order_id,
            product_id,
            quantity,
            price_per_unit
        )
        values (
            v_order_id,
            v_item.product_id,
            v_item.quantity,
            v_product.price
        );

        update public.products
        set stock_level = greatest(coalesce(stock_level, 0) - v_item.quantity, 0)
        where id = v_item.product_id;
    end loop;

    for v_gift_card in
        select id, code, remaining_amount_kobo
        from public.gift_cards
        where recipient_id = p_user_id
          and status = 'active'
          and remaining_amount_kobo > 0
          and (expires_at is null or expires_at > now())
        order by expires_at asc nulls last, created_at asc
        for update
    loop
        exit when v_remaining_to_apply <= 0;

        v_debit_kobo := least(v_gift_card.remaining_amount_kobo, v_remaining_to_apply);

        update public.gift_cards
        set remaining_amount_kobo = remaining_amount_kobo - v_debit_kobo,
            status = case
                when remaining_amount_kobo - v_debit_kobo <= 0 then 'depleted'
                else 'active'
            end,
            last_used_at = now(),
            updated_at = now()
        where id = v_gift_card.id;

        insert into public.gift_card_transactions (
            gift_card_id,
            actor_id,
            transaction_type,
            amount_kobo,
            reference,
            description,
            metadata
        )
        values (
            v_gift_card.id,
            v_actor,
            'debit',
            v_debit_kobo,
            v_payment_reference,
            'Gift card applied to order ' || upper(substr(v_order_id::text, 1, 8)),
            jsonb_build_object('order_id', v_order_id, 'gift_card_code', v_gift_card.code)
        );

        v_remaining_to_apply := v_remaining_to_apply - v_debit_kobo;
    end loop;

    if v_remaining_to_apply > 0 then
        raise exception 'Gift card balance became unavailable during checkout';
    end if;

    perform public.refresh_order_financials(v_order_id);

    v_assigned_agent_id := public.assign_best_agent(
        v_order_id,
        p_user_id,
        'auto',
        'System auto assignment after gift card payment'
    );

    if v_assigned_agent_id is null then
        raise exception 'No approved agents are currently available';
    end if;

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
        v_order_id,
        'merchant',
        v_merchant_id,
        p_user_id,
        'auto',
        'Merchant linked from ordered products',
        true
    );

    perform public.create_notification(
        p_user_id,
        'Gift card applied',
        'Your gift card balance paid for order #' || upper(substr(v_order_id::text, 1, 8)) || '. Amount: ' || public.format_kobo_amount(v_total_kobo) || '.',
        'gift_card_debit',
        '/account/gift-card',
        jsonb_build_object('order_id', v_order_id, 'amount_kobo', v_total_kobo)
    );

    perform public.write_audit_log(
        p_user_id,
        'create_paid_order_with_gift_card',
        'order',
        v_order_id,
        jsonb_build_object('payment_reference', v_payment_reference, 'merchant_id', v_merchant_id, 'amount_kobo', v_total_kobo)
    );

    return jsonb_build_object('success', true, 'order_id', v_order_id, 'payment_reference', v_payment_reference);
end;
$function$;

revoke execute on function public.lookup_gift_card_recipient(text) from public, anon;
grant execute on function public.lookup_gift_card_recipient(text) to authenticated, service_role;

revoke execute on function public.purchase_gift_card_with_wallet(text, bigint, text) from public, anon;
grant execute on function public.purchase_gift_card_with_wallet(text, bigint, text) to authenticated, service_role;

revoke execute on function public.create_pending_gift_card_purchase(text, bigint, text) from public, anon;
grant execute on function public.create_pending_gift_card_purchase(text, bigint, text) to authenticated, service_role;

revoke execute on function public.mark_gift_card_purchase_paid(uuid, text, bigint) from public, anon, authenticated;
grant execute on function public.mark_gift_card_purchase_paid(uuid, text, bigint) to service_role;

revoke execute on function public.create_paid_order_with_gift_card(uuid, jsonb, jsonb, bigint, jsonb, text) from public, anon;
grant execute on function public.create_paid_order_with_gift_card(uuid, jsonb, jsonb, bigint, jsonb, text) to authenticated, service_role;
