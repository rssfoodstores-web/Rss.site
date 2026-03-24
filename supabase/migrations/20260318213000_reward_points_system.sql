insert into public.app_settings (key, value, description)
values (
    'reward_system_settings',
    jsonb_build_object(
        'enabled', true,
        'point_value_naira', 1,
        'purchase_points_per_spend_unit', 1,
        'purchase_spend_unit_naira', 100,
        'expiration_days', 365,
        'cook_off_approved_points', 50,
        'cook_off_featured_bonus_points', 75,
        'cook_off_winner_bonus_points', 200,
        'referral_welcome_bonus_points', 150,
        'points_cover_delivery_fee', false
    ),
    'Reward points system configuration, including toggle, redemption value, earn rates, and bonus rules.'
)
on conflict (key) do update
set value = excluded.value,
    description = excluded.description;

alter table public.orders
    add column if not exists subtotal_amount_kobo bigint not null default 0,
    add column if not exists points_discount_kobo bigint not null default 0,
    add column if not exists points_redeemed integer not null default 0;

update public.orders
set subtotal_amount_kobo = greatest(total_amount - coalesce(delivery_fee_kobo, 0), 0)
where subtotal_amount_kobo = 0
  and coalesce(total_amount, 0) > 0;

create table if not exists public.reward_point_balances (
    user_id uuid primary key references public.profiles(id) on delete cascade,
    available_points integer not null default 0 check (available_points >= 0),
    pending_points integer not null default 0 check (pending_points >= 0),
    debt_points integer not null default 0 check (debt_points >= 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.reward_point_lots (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    source_kind text not null check (
        source_kind = any (
            array[
                'order_purchase',
                'cook_off_approved',
                'cook_off_featured',
                'cook_off_winner',
                'referral_welcome_bonus',
                'redemption_restore',
                'admin_bonus'
            ]
        )
    ),
    source_id uuid null,
    source_key text unique,
    status text not null default 'pending' check (
        status = any (array['pending', 'available', 'offset', 'expired', 'redeemed', 'cancelled', 'reversed'])
    ),
    original_points integer not null check (original_points > 0),
    remaining_points integer not null default 0 check (remaining_points >= 0),
    offset_points integer not null default 0 check (offset_points >= 0),
    expired_points integer not null default 0 check (expired_points >= 0),
    description text not null,
    available_at timestamptz null,
    expires_at timestamptz null,
    created_by uuid null references public.profiles(id) on delete set null,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (remaining_points + offset_points + expired_points <= original_points)
);

create table if not exists public.reward_point_redemptions (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null unique references public.orders(id) on delete cascade,
    user_id uuid not null references public.profiles(id) on delete cascade,
    points_used integer not null check (points_used > 0),
    discount_kobo bigint not null check (discount_kobo >= 0),
    status text not null default 'reserved' check (status = any (array['reserved', 'applied', 'restored', 'voided'])),
    description text not null,
    metadata jsonb not null default '{}'::jsonb,
    restored_at timestamptz null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.reward_point_events (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    event_type text not null check (
        event_type = any (
            array[
                'earned_pending',
                'earned_available',
                'redeemed',
                'restored',
                'expired',
                'reversed',
                'cancelled'
            ]
        )
    ),
    points_delta integer not null,
    available_balance_after integer not null default 0,
    pending_balance_after integer not null default 0,
    debt_balance_after integer not null default 0,
    lot_id uuid null references public.reward_point_lots(id) on delete set null,
    redemption_id uuid null references public.reward_point_redemptions(id) on delete set null,
    source_kind text null,
    source_id uuid null,
    description text not null,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists idx_reward_point_lots_user_status on public.reward_point_lots(user_id, status, created_at desc);
create index if not exists idx_reward_point_lots_expires_at on public.reward_point_lots(expires_at) where status = 'available';
create index if not exists idx_reward_point_redemptions_user_created on public.reward_point_redemptions(user_id, created_at desc);
create index if not exists idx_reward_point_events_user_created on public.reward_point_events(user_id, created_at desc);

insert into public.reward_point_balances (user_id, available_points)
select p.id, greatest(coalesce(p.points_balance, 0), 0)
from public.profiles p
where coalesce(p.points_balance, 0) > 0
on conflict (user_id) do nothing;

insert into public.reward_point_lots (
    user_id,
    source_kind,
    source_id,
    source_key,
    status,
    original_points,
    remaining_points,
    description,
    available_at,
    metadata
)
select
    p.id,
    'admin_bonus',
    p.id,
    'legacy-profile-balance:' || p.id::text,
    'available',
    p.points_balance,
    p.points_balance,
    'Legacy reward points balance migrated into the rewards system',
    now(),
    jsonb_build_object('migration', '20260318213000_reward_points_system')
from public.profiles p
where coalesce(p.points_balance, 0) > 0
  and not exists (
      select 1
      from public.reward_point_lots lot
      where lot.source_key = 'legacy-profile-balance:' || p.id::text
  );

create or replace function public.get_reward_system_settings()
returns jsonb
language plpgsql
stable
set search_path = public
as $function$
declare
    v_value jsonb := '{}'::jsonb;
begin
    select
        case
            when jsonb_typeof(value) = 'object' then value
            else '{}'::jsonb
        end
    into v_value
    from public.app_settings
    where key = 'reward_system_settings';

    return jsonb_build_object(
        'enabled', coalesce((v_value ->> 'enabled')::boolean, true),
        'point_value_naira', coalesce((v_value ->> 'point_value_naira')::numeric, 1),
        'purchase_points_per_spend_unit', coalesce((v_value ->> 'purchase_points_per_spend_unit')::integer, 1),
        'purchase_spend_unit_naira', coalesce((v_value ->> 'purchase_spend_unit_naira')::integer, 100),
        'expiration_days', coalesce((v_value ->> 'expiration_days')::integer, 365),
        'cook_off_approved_points', coalesce((v_value ->> 'cook_off_approved_points')::integer, 50),
        'cook_off_featured_bonus_points', coalesce((v_value ->> 'cook_off_featured_bonus_points')::integer, 75),
        'cook_off_winner_bonus_points', coalesce((v_value ->> 'cook_off_winner_bonus_points')::integer, 200),
        'referral_welcome_bonus_points', coalesce((v_value ->> 'referral_welcome_bonus_points')::integer, 150),
        'points_cover_delivery_fee', coalesce((v_value ->> 'points_cover_delivery_fee')::boolean, false)
    );
end;
$function$;

create or replace function public.reward_points_enabled()
returns boolean
language sql
stable
set search_path = public
as $function$
    select coalesce((public.get_reward_system_settings() ->> 'enabled')::boolean, true);
$function$;

create or replace function public.reward_point_value_kobo()
returns bigint
language sql
stable
set search_path = public
as $function$
    select greatest(round(coalesce((public.get_reward_system_settings() ->> 'point_value_naira')::numeric, 1) * 100)::bigint, 1);
$function$;

create or replace function public.reward_point_expiration_days()
returns integer
language sql
stable
set search_path = public
as $function$
    select greatest(coalesce((public.get_reward_system_settings() ->> 'expiration_days')::integer, 365), 1);
$function$;

create or replace function public.reward_purchase_points_per_spend_unit()
returns integer
language sql
stable
set search_path = public
as $function$
    select greatest(coalesce((public.get_reward_system_settings() ->> 'purchase_points_per_spend_unit')::integer, 1), 0);
$function$;

create or replace function public.reward_purchase_spend_unit_naira()
returns integer
language sql
stable
set search_path = public
as $function$
    select greatest(coalesce((public.get_reward_system_settings() ->> 'purchase_spend_unit_naira')::integer, 100), 1);
$function$;

create or replace function public.ensure_reward_point_balance(p_user_id uuid)
returns public.reward_point_balances
language plpgsql
security definer
set search_path = public
as $function$
declare
    v_balance public.reward_point_balances;
begin
    insert into public.reward_point_balances (user_id)
    values (p_user_id)
    on conflict (user_id) do nothing;

    select *
    into v_balance
    from public.reward_point_balances
    where user_id = p_user_id
    for update;

    return v_balance;
end;
$function$;

create or replace function public.apply_reward_point_balance_delta(
    p_user_id uuid,
    p_available_delta integer default 0,
    p_pending_delta integer default 0,
    p_debt_delta integer default 0
)
returns public.reward_point_balances
language plpgsql
security definer
set search_path = public
as $function$
declare
    v_balance public.reward_point_balances;
    v_available integer;
    v_pending integer;
    v_debt integer;
begin
    v_balance := public.ensure_reward_point_balance(p_user_id);

    v_available := v_balance.available_points + coalesce(p_available_delta, 0);
    v_pending := v_balance.pending_points + coalesce(p_pending_delta, 0);
    v_debt := v_balance.debt_points + coalesce(p_debt_delta, 0);

    if v_available < 0 then
        raise exception 'Reward point available balance cannot be negative';
    end if;

    if v_pending < 0 then
        raise exception 'Reward point pending balance cannot be negative';
    end if;

    if v_debt < 0 then
        raise exception 'Reward point debt balance cannot be negative';
    end if;

    update public.reward_point_balances
    set available_points = v_available,
        pending_points = v_pending,
        debt_points = v_debt,
        updated_at = now()
    where user_id = p_user_id
    returning * into v_balance;

    update public.profiles
    set points_balance = v_balance.available_points
    where id = p_user_id;

    return v_balance;
end;
$function$;

create or replace function public.create_reward_point_event(
    p_user_id uuid,
    p_event_type text,
    p_points_delta integer,
    p_description text,
    p_lot_id uuid default null,
    p_redemption_id uuid default null,
    p_source_kind text default null,
    p_source_id uuid default null,
    p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
    v_balance public.reward_point_balances;
    v_event_id uuid;
begin
    v_balance := public.ensure_reward_point_balance(p_user_id);

    insert into public.reward_point_events (
        user_id,
        event_type,
        points_delta,
        available_balance_after,
        pending_balance_after,
        debt_balance_after,
        lot_id,
        redemption_id,
        source_kind,
        source_id,
        description,
        metadata
    )
    values (
        p_user_id,
        p_event_type,
        p_points_delta,
        v_balance.available_points,
        v_balance.pending_points,
        v_balance.debt_points,
        p_lot_id,
        p_redemption_id,
        p_source_kind,
        p_source_id,
        p_description,
        coalesce(p_metadata, '{}'::jsonb)
    )
    returning id into v_event_id;

    return v_event_id;
end;
$function$;

create or replace function public.compute_purchase_reward_points(p_net_subtotal_kobo bigint)
returns integer
language plpgsql
stable
set search_path = public
as $function$
declare
    v_points_per_unit integer := public.reward_purchase_points_per_spend_unit();
    v_spend_unit_naira integer := public.reward_purchase_spend_unit_naira();
    v_spend_unit_kobo bigint := greatest(v_spend_unit_naira, 1)::bigint * 100;
begin
    if p_net_subtotal_kobo <= 0 or v_points_per_unit <= 0 or v_spend_unit_kobo <= 0 then
        return 0;
    end if;

    return floor(p_net_subtotal_kobo::numeric / v_spend_unit_kobo::numeric)::integer * v_points_per_unit;
end;
$function$;

create or replace function public.create_reward_point_lot(
    p_user_id uuid,
    p_points integer,
    p_source_kind text,
    p_source_id uuid,
    p_source_key text,
    p_description text,
    p_is_pending boolean default false,
    p_event_type text default null,
    p_created_by uuid default null,
    p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
    v_balance public.reward_point_balances;
    v_lot_id uuid;
    v_existing_lot uuid;
    v_expiration_days integer := public.reward_point_expiration_days();
    v_offset_points integer := 0;
    v_available_points integer := 0;
    v_status text;
begin
    if p_points is null or p_points <= 0 then
        return null;
    end if;

    if p_source_key is not null then
        select id
        into v_existing_lot
        from public.reward_point_lots
        where source_key = p_source_key;

        if v_existing_lot is not null then
            return v_existing_lot;
        end if;
    end if;

    if p_is_pending then
        insert into public.reward_point_lots (
            user_id,
            source_kind,
            source_id,
            source_key,
            status,
            original_points,
            remaining_points,
            description,
            created_by,
            metadata
        )
        values (
            p_user_id,
            p_source_kind,
            p_source_id,
            p_source_key,
            'pending',
            p_points,
            p_points,
            p_description,
            p_created_by,
            coalesce(p_metadata, '{}'::jsonb)
        )
        returning id into v_lot_id;

        perform public.apply_reward_point_balance_delta(p_user_id, 0, p_points, 0);

        perform public.create_reward_point_event(
            p_user_id,
            coalesce(p_event_type, 'earned_pending'),
            p_points,
            p_description,
            v_lot_id,
            null,
            p_source_kind,
            p_source_id,
            p_metadata
        );

        return v_lot_id;
    end if;

    v_balance := public.ensure_reward_point_balance(p_user_id);
    v_offset_points := least(v_balance.debt_points, p_points);
    v_available_points := p_points - v_offset_points;
    v_status := case when v_available_points > 0 then 'available' else 'offset' end;

    insert into public.reward_point_lots (
        user_id,
        source_kind,
        source_id,
        source_key,
        status,
        original_points,
        remaining_points,
        offset_points,
        description,
        available_at,
        expires_at,
        created_by,
        metadata
    )
    values (
        p_user_id,
        p_source_kind,
        p_source_id,
        p_source_key,
        v_status,
        p_points,
        v_available_points,
        v_offset_points,
        p_description,
        now(),
        case when v_available_points > 0 then now() + make_interval(days => v_expiration_days) else null end,
        p_created_by,
        coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('offset_points', v_offset_points)
    )
    returning id into v_lot_id;

    perform public.apply_reward_point_balance_delta(p_user_id, v_available_points, 0, -v_offset_points);

    perform public.create_reward_point_event(
        p_user_id,
        coalesce(p_event_type, 'earned_available'),
        p_points,
        p_description,
        v_lot_id,
        null,
        p_source_kind,
        p_source_id,
        coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('offset_points', v_offset_points)
    );

    return v_lot_id;
end;
$function$;

create or replace function public.process_reward_point_expiries(p_user_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
    v_lot record;
    v_expired_count integer := 0;
begin
    for v_lot in
        select *
        from public.reward_point_lots
        where status = 'available'
          and remaining_points > 0
          and expires_at is not null
          and expires_at <= now()
          and (p_user_id is null or user_id = p_user_id)
        order by expires_at asc, created_at asc
        for update
    loop
        perform public.apply_reward_point_balance_delta(v_lot.user_id, -v_lot.remaining_points, 0, 0);

        update public.reward_point_lots
        set expired_points = expired_points + remaining_points,
            remaining_points = 0,
            status = 'expired',
            updated_at = now()
        where id = v_lot.id;

        perform public.create_reward_point_event(
            v_lot.user_id,
            'expired',
            -v_lot.remaining_points,
            'Reward points expired: ' || v_lot.description,
            v_lot.id,
            null,
            v_lot.source_kind,
            v_lot.source_id,
            jsonb_build_object('expired_points', v_lot.remaining_points)
        );

        v_expired_count := v_expired_count + 1;
    end loop;

    return v_expired_count;
end;
$function$;

create or replace function public.reverse_reward_point_lot_by_source_key(
    p_source_key text,
    p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
    v_lot public.reward_point_lots;
    v_available_reduction integer := 0;
    v_debt_increase integer := 0;
    v_total_reversal integer := 0;
begin
    if p_source_key is null or btrim(p_source_key) = '' then
        return null;
    end if;

    select *
    into v_lot
    from public.reward_point_lots
    where source_key = p_source_key
    for update;

    if not found then
        return null;
    end if;

    if v_lot.status in ('cancelled', 'reversed') then
        return v_lot.id;
    end if;

    v_available_reduction := v_lot.remaining_points;
    v_debt_increase := greatest(v_lot.original_points - v_lot.expired_points - v_lot.remaining_points, 0);
    v_total_reversal := v_available_reduction + v_debt_increase;

    if v_available_reduction > 0 or v_debt_increase > 0 then
        perform public.apply_reward_point_balance_delta(v_lot.user_id, -v_available_reduction, 0, v_debt_increase);
    end if;

    update public.reward_point_lots
    set remaining_points = 0,
        status = 'reversed',
        updated_at = now()
    where id = v_lot.id;

    if v_total_reversal > 0 then
        perform public.create_reward_point_event(
            v_lot.user_id,
            'reversed',
            -v_total_reversal,
            p_reason,
            v_lot.id,
            null,
            v_lot.source_kind,
            v_lot.source_id,
            jsonb_build_object(
                'available_reduction', v_available_reduction,
                'debt_increase', v_debt_increase,
                'expired_points', v_lot.expired_points
            )
        );
    end if;

    return v_lot.id;
end;
$function$;

create or replace function public.cancel_reward_point_lot_by_source_key(
    p_source_key text,
    p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
    v_lot public.reward_point_lots;
begin
    if p_source_key is null or btrim(p_source_key) = '' then
        return null;
    end if;

    select *
    into v_lot
    from public.reward_point_lots
    where source_key = p_source_key
    for update;

    if not found then
        return null;
    end if;

    if v_lot.status <> 'pending' then
        return v_lot.id;
    end if;

    perform public.apply_reward_point_balance_delta(v_lot.user_id, 0, -v_lot.remaining_points, 0);

    update public.reward_point_lots
    set remaining_points = 0,
        status = 'cancelled',
        updated_at = now()
    where id = v_lot.id;

    perform public.create_reward_point_event(
        v_lot.user_id,
        'cancelled',
        -v_lot.original_points,
        p_reason,
        v_lot.id,
        null,
        v_lot.source_kind,
        v_lot.source_id,
        '{}'::jsonb
    );

    return v_lot.id;
end;
$function$;

create or replace function public.queue_order_purchase_reward_points(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
    v_order public.orders;
    v_points integer;
    v_net_subtotal_kobo bigint;
begin
    if not public.reward_points_enabled() then
        return;
    end if;

    select *
    into v_order
    from public.orders
    where id = p_order_id;

    if not found or v_order.payment_status <> 'paid' then
        return;
    end if;

    if exists (
        select 1
        from public.reward_point_lots
        where source_key = 'order-purchase:' || p_order_id::text
    ) then
        return;
    end if;

    v_net_subtotal_kobo := greatest(coalesce(v_order.subtotal_amount_kobo, 0) - coalesce(v_order.points_discount_kobo, 0), 0);
    v_points := public.compute_purchase_reward_points(v_net_subtotal_kobo);

    if v_points <= 0 then
        return;
    end if;

    perform public.create_reward_point_lot(
        v_order.customer_id,
        v_points,
        'order_purchase',
        p_order_id,
        'order-purchase:' || p_order_id::text,
        'Pending purchase points for order #' || upper(substr(p_order_id::text, 1, 8)),
        true,
        'earned_pending',
        null,
        jsonb_build_object('order_id', p_order_id, 'net_subtotal_kobo', v_net_subtotal_kobo)
    );
end;
$function$;

create or replace function public.release_order_purchase_reward_points(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
    v_lot public.reward_point_lots;
    v_balance public.reward_point_balances;
    v_expiration_days integer := public.reward_point_expiration_days();
    v_offset_points integer;
    v_available_points integer;
begin
    select *
    into v_lot
    from public.reward_point_lots
    where source_key = 'order-purchase:' || p_order_id::text
    for update;

    if not found or v_lot.status <> 'pending' then
        return;
    end if;

    v_balance := public.ensure_reward_point_balance(v_lot.user_id);
    v_offset_points := least(v_balance.debt_points, v_lot.remaining_points);
    v_available_points := v_lot.remaining_points - v_offset_points;

    perform public.apply_reward_point_balance_delta(v_lot.user_id, v_available_points, -v_lot.remaining_points, -v_offset_points);

    update public.reward_point_lots
    set status = case when v_available_points > 0 then 'available' else 'offset' end,
        offset_points = offset_points + v_offset_points,
        remaining_points = v_available_points,
        available_at = now(),
        expires_at = case when v_available_points > 0 then now() + make_interval(days => v_expiration_days) else null end,
        updated_at = now(),
        metadata = metadata || jsonb_build_object('released_at', now(), 'release_offset_points', v_offset_points)
    where id = v_lot.id;

    perform public.create_reward_point_event(
        v_lot.user_id,
        'earned_available',
        v_lot.original_points,
        'Purchase points activated for order #' || upper(substr(p_order_id::text, 1, 8)),
        v_lot.id,
        null,
        v_lot.source_kind,
        v_lot.source_id,
        jsonb_build_object('offset_points', v_offset_points, 'available_points', v_available_points)
    );
end;
$function$;

create or replace function public.cancel_order_purchase_reward_points(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
    perform public.cancel_reward_point_lot_by_source_key(
        'order-purchase:' || p_order_id::text,
        'Pending purchase points cancelled for order #' || upper(substr(p_order_id::text, 1, 8))
    );
end;
$function$;

create or replace function public.reverse_order_purchase_reward_points(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
    perform public.reverse_reward_point_lot_by_source_key(
        'order-purchase:' || p_order_id::text,
        'Purchase points reversed for refunded order #' || upper(substr(p_order_id::text, 1, 8))
    );
end;
$function$;

create or replace function public.restore_order_reward_point_redemption(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
    v_redemption public.reward_point_redemptions;
begin
    select *
    into v_redemption
    from public.reward_point_redemptions
    where order_id = p_order_id
    for update;

    if not found or v_redemption.status not in ('reserved', 'applied') then
        return;
    end if;

    perform public.create_reward_point_lot(
        v_redemption.user_id,
        v_redemption.points_used,
        'redemption_restore',
        p_order_id,
        'redemption-restore:' || p_order_id::text,
        'Reward points restored from order #' || upper(substr(p_order_id::text, 1, 8)),
        false,
        'restored',
        null,
        jsonb_build_object('order_id', p_order_id, 'restored_from_redemption_id', v_redemption.id)
    );

    update public.reward_point_redemptions
    set status = 'restored',
        restored_at = now(),
        updated_at = now()
    where id = v_redemption.id;
end;
$function$;

create or replace function public.apply_reward_points_redemption(
    p_user_id uuid,
    p_order_id uuid,
    p_requested_points integer,
    p_item_subtotal_kobo bigint,
    p_reservation_only boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
    v_actor uuid := auth.uid();
    v_balance public.reward_point_balances;
    v_redemption_id uuid;
    v_lot record;
    v_points_to_use integer := 0;
    v_points_left integer := 0;
    v_point_value_kobo bigint := public.reward_point_value_kobo();
    v_max_discount_kobo bigint := greatest(coalesce(p_item_subtotal_kobo, 0), 0);
    v_max_points_by_order integer := 0;
    v_discount_kobo bigint := 0;
    v_take integer := 0;
    v_description text;
begin
    if v_actor is null then
        return jsonb_build_object('success', false, 'error', 'Authentication required');
    end if;

    if p_user_id is distinct from v_actor then
        return jsonb_build_object('success', false, 'error', 'You can only redeem your own reward points');
    end if;

    if p_requested_points is null or p_requested_points <= 0 then
        return jsonb_build_object('success', true, 'points_used', 0, 'discount_kobo', 0);
    end if;

    if not public.reward_points_enabled() then
        return jsonb_build_object('success', false, 'error', 'Reward points are currently disabled');
    end if;

    if exists (
        select 1
        from public.reward_point_redemptions r
        where r.user_id = p_user_id
          and r.status = 'reserved'
          and r.order_id <> p_order_id
    ) then
        return jsonb_build_object('success', false, 'error', 'Complete or cancel your existing unpaid reward-points order before redeeming again');
    end if;

    perform public.process_reward_point_expiries(p_user_id);

    v_balance := public.ensure_reward_point_balance(p_user_id);
    v_max_points_by_order := floor(v_max_discount_kobo::numeric / v_point_value_kobo::numeric)::integer;
    v_points_to_use := least(p_requested_points, v_balance.available_points, v_max_points_by_order);

    if v_points_to_use <= 0 then
        return jsonb_build_object('success', false, 'error', 'No redeemable reward points are available for this order');
    end if;

    v_discount_kobo := v_points_to_use::bigint * v_point_value_kobo;
    v_description := case
        when p_reservation_only then 'Reward points reserved for order #' || upper(substr(p_order_id::text, 1, 8))
        else 'Reward points applied to order #' || upper(substr(p_order_id::text, 1, 8))
    end;

    insert into public.reward_point_redemptions (
        order_id,
        user_id,
        points_used,
        discount_kobo,
        status,
        description,
        metadata
    )
    values (
        p_order_id,
        p_user_id,
        v_points_to_use,
        v_discount_kobo,
        case when p_reservation_only then 'reserved' else 'applied' end,
        v_description,
        jsonb_build_object('point_value_kobo', v_point_value_kobo)
    )
    returning id into v_redemption_id;

    v_points_left := v_points_to_use;

    for v_lot in
        select *
        from public.reward_point_lots
        where user_id = p_user_id
          and status = 'available'
          and remaining_points > 0
        order by expires_at asc nulls last, available_at asc nulls last, created_at asc
        for update
    loop
        exit when v_points_left <= 0;

        v_take := least(v_points_left, v_lot.remaining_points);

        update public.reward_point_lots
        set remaining_points = remaining_points - v_take,
            status = case
                when remaining_points - v_take <= 0 then 'redeemed'
                else status
            end,
            updated_at = now()
        where id = v_lot.id;

        v_points_left := v_points_left - v_take;
    end loop;

    if v_points_left > 0 then
        raise exception 'Reward points became unavailable during checkout';
    end if;

    perform public.apply_reward_point_balance_delta(p_user_id, -v_points_to_use, 0, 0);

    perform public.create_reward_point_event(
        p_user_id,
        'redeemed',
        -v_points_to_use,
        v_description,
        null,
        v_redemption_id,
        'order_redemption',
        p_order_id,
        jsonb_build_object('discount_kobo', v_discount_kobo, 'status', case when p_reservation_only then 'reserved' else 'applied' end)
    );

    return jsonb_build_object(
        'success', true,
        'points_used', v_points_to_use,
        'discount_kobo', v_discount_kobo,
        'redemption_id', v_redemption_id,
        'status', case when p_reservation_only then 'reserved' else 'applied' end
    );
end;
$function$;

create or replace function public.get_reward_checkout_summary(p_subtotal_kobo bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
    v_actor uuid := auth.uid();
    v_settings jsonb := public.get_reward_system_settings();
    v_balance public.reward_point_balances;
    v_point_value_kobo bigint := public.reward_point_value_kobo();
    v_max_discount_kobo bigint := greatest(coalesce(p_subtotal_kobo, 0), 0);
    v_max_redeemable_points integer := 0;
begin
    if v_actor is null then
        return jsonb_build_object('success', false, 'error', 'Authentication required');
    end if;

    perform public.process_reward_point_expiries(v_actor);
    v_balance := public.ensure_reward_point_balance(v_actor);
    v_max_redeemable_points := floor(v_max_discount_kobo::numeric / v_point_value_kobo::numeric)::integer;

    return jsonb_build_object(
        'success', true,
        'enabled', public.reward_points_enabled(),
        'available_points', v_balance.available_points,
        'pending_points', v_balance.pending_points,
        'debt_points', v_balance.debt_points,
        'point_value_naira', coalesce((v_settings ->> 'point_value_naira')::numeric, 1),
        'point_value_kobo', v_point_value_kobo,
        'max_redeemable_points', least(v_balance.available_points, v_max_redeemable_points),
        'max_discount_kobo', least(v_balance.available_points, v_max_redeemable_points)::bigint * v_point_value_kobo
    );
end;
$function$;

create or replace function public.sync_cook_off_reward_points_for_entry(p_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
    v_entry record;
    v_settings jsonb := public.get_reward_system_settings();
begin
    select *
    into v_entry
    from public.cook_off_entries
    where id = p_entry_id;

    if not found then
        return;
    end if;

    if v_entry.status = 'approved' and public.reward_points_enabled() then
        perform public.create_reward_point_lot(
            v_entry.user_id,
            greatest(coalesce((v_settings ->> 'cook_off_approved_points')::integer, 50), 0),
            'cook_off_approved',
            v_entry.id,
            'cookoff-approved:' || v_entry.id::text,
            'Cook-Off approved entry bonus',
            false,
            'earned_available',
            v_entry.reviewed_by,
            jsonb_build_object('entry_id', v_entry.id, 'session_id', v_entry.session_id)
        );

        if coalesce(v_entry.is_featured, false) then
            perform public.create_reward_point_lot(
                v_entry.user_id,
                greatest(coalesce((v_settings ->> 'cook_off_featured_bonus_points')::integer, 75), 0),
                'cook_off_featured',
                v_entry.id,
                'cookoff-featured:' || v_entry.id::text,
                'Cook-Off featured entry bonus',
                false,
                'earned_available',
                v_entry.reviewed_by,
                jsonb_build_object('entry_id', v_entry.id, 'session_id', v_entry.session_id)
            );
        else
            perform public.reverse_reward_point_lot_by_source_key(
                'cookoff-featured:' || v_entry.id::text,
                'Cook-Off featured bonus reversed'
            );
        end if;

        if v_entry.winner_position is not null then
            perform public.create_reward_point_lot(
                v_entry.user_id,
                greatest(coalesce((v_settings ->> 'cook_off_winner_bonus_points')::integer, 200), 0),
                'cook_off_winner',
                v_entry.id,
                'cookoff-winner:' || v_entry.id::text,
                'Cook-Off winner bonus',
                false,
                'earned_available',
                v_entry.reviewed_by,
                jsonb_build_object('entry_id', v_entry.id, 'session_id', v_entry.session_id, 'winner_position', v_entry.winner_position)
            );
        else
            perform public.reverse_reward_point_lot_by_source_key(
                'cookoff-winner:' || v_entry.id::text,
                'Cook-Off winner bonus reversed'
            );
        end if;
    else
        perform public.reverse_reward_point_lot_by_source_key(
            'cookoff-approved:' || v_entry.id::text,
            'Cook-Off approval bonus reversed'
        );
        perform public.reverse_reward_point_lot_by_source_key(
            'cookoff-featured:' || v_entry.id::text,
            'Cook-Off featured bonus reversed'
        );
        perform public.reverse_reward_point_lot_by_source_key(
            'cookoff-winner:' || v_entry.id::text,
            'Cook-Off winner bonus reversed'
        );
    end if;
end;
$function$;

create or replace function public.award_referral_welcome_bonus_for_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
    v_order public.orders;
    v_referred_by uuid;
    v_settings jsonb := public.get_reward_system_settings();
begin
    if not public.reward_points_enabled() then
        return;
    end if;

    select *
    into v_order
    from public.orders
    where id = p_order_id;

    if not found or v_order.status not in ('delivered', 'completed') then
        return;
    end if;

    select referred_by
    into v_referred_by
    from public.profiles
    where id = v_order.customer_id;

    if v_referred_by is null then
        return;
    end if;

    if exists (
        select 1
        from public.reward_point_lots
        where user_id = v_order.customer_id
          and source_kind = 'referral_welcome_bonus'
          and status not in ('reversed', 'cancelled')
    ) then
        return;
    end if;

    perform public.create_reward_point_lot(
        v_order.customer_id,
        greatest(coalesce((v_settings ->> 'referral_welcome_bonus_points')::integer, 150), 0),
        'referral_welcome_bonus',
        p_order_id,
        'referral-welcome:' || p_order_id::text,
        'Referral welcome bonus after first delivered order',
        false,
        'earned_available',
        null,
        jsonb_build_object('order_id', p_order_id, 'referred_by', v_referred_by)
    );
end;
$function$;

create or replace function public.handle_reward_points_for_order_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
    if (tg_op = 'INSERT' and new.payment_status = 'paid')
        or (
            tg_op = 'UPDATE'
            and coalesce(old.payment_status::text, '') <> coalesce(new.payment_status::text, '')
            and new.payment_status = 'paid'
        ) then
        perform public.queue_order_purchase_reward_points(new.id);
    end if;

    if tg_op = 'UPDATE'
        and coalesce(old.status::text, '') not in ('delivered', 'completed')
        and new.status in ('delivered', 'completed') then
        perform public.release_order_purchase_reward_points(new.id);
        perform public.award_referral_welcome_bonus_for_order(new.id);
    end if;

    if tg_op = 'UPDATE'
        and coalesce(old.status::text, '') not in ('cancelled', 'refunded')
        and new.status in ('cancelled', 'refunded') then
        if coalesce(old.status::text, '') in ('delivered', 'completed') then
            perform public.reverse_order_purchase_reward_points(new.id);
            perform public.reverse_reward_point_lot_by_source_key(
                'referral-welcome:' || new.id::text,
                'Referral welcome bonus reversed after order refund'
            );
        else
            perform public.cancel_order_purchase_reward_points(new.id);
        end if;

        perform public.restore_order_reward_point_redemption(new.id);
    end if;

    return new;
end;
$function$;

create or replace function public.handle_reward_points_for_cookoff_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
    perform public.sync_cook_off_reward_points_for_entry(new.id);
    return new;
end;
$function$;

drop trigger if exists trg_reward_points_on_order_change on public.orders;
create trigger trg_reward_points_on_order_change
after insert or update of status, payment_status on public.orders
for each row
execute function public.handle_reward_points_for_order_change();

drop trigger if exists trg_reward_points_on_cookoff_change on public.cook_off_entries;
create trigger trg_reward_points_on_cookoff_change
after insert or update of status, is_featured, winner_position on public.cook_off_entries
for each row
execute function public.handle_reward_points_for_cookoff_change();

create or replace function public.cancel_unpaid_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
    v_actor uuid := auth.uid();
    v_order public.orders;
begin
    if v_actor is null then
        return jsonb_build_object('success', false, 'error', 'Authentication required');
    end if;

    select *
    into v_order
    from public.orders
    where id = p_order_id
    for update;

    if not found then
        return jsonb_build_object('success', false, 'error', 'Order not found');
    end if;

    if v_order.customer_id <> v_actor and not public.jwt_has_any_role(array['admin', 'sub_admin', 'supa_admin']) then
        return jsonb_build_object('success', false, 'error', 'You cannot cancel this order');
    end if;

    if v_order.status <> 'pending' or v_order.payment_status <> 'pending' then
        return jsonb_build_object('success', false, 'error', 'Only unpaid pending orders can be cancelled');
    end if;

    update public.orders
    set status = 'cancelled',
        payment_status = 'failed'
    where id = p_order_id;

    perform public.write_audit_log(
        v_actor,
        'cancel_unpaid_order',
        'order',
        p_order_id,
        '{}'::jsonb
    );

    return jsonb_build_object('success', true, 'order_id', p_order_id);
end;
$function$;

drop function if exists public.create_paid_order(uuid, jsonb, jsonb, bigint, jsonb, text);
create function public.create_paid_order(
    p_user_id uuid,
    p_items jsonb,
    p_delivery_location jsonb,
    p_delivery_fee_kobo bigint default 0,
    p_contact_numbers jsonb default '[]'::jsonb,
    p_payment_reference text default null,
    p_points_to_redeem integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
    v_actor uuid := auth.uid();
    v_wallet_id uuid;
    v_wallet_balance bigint;
    v_order_id uuid := gen_random_uuid();
    v_item record;
    v_product record;
    v_validation jsonb;
    v_merchant_id uuid;
    v_subtotal_kobo bigint := 0;
    v_total_kobo bigint := 0;
    v_payment_reference text := coalesce(p_payment_reference, 'WAL-' || encode(gen_random_bytes(8), 'hex'));
    v_assigned_agent_id uuid;
    v_redemption jsonb := jsonb_build_object('success', true, 'points_used', 0, 'discount_kobo', 0);
    v_points_discount_kobo bigint := 0;
    v_points_used integer := 0;
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

    perform public.process_reward_point_expiries(p_user_id);

    v_wallet_id := public.ensure_actor_wallet(p_user_id, 'customer');

    select balance
    into v_wallet_balance
    from public.wallets
    where id = v_wallet_id
    for update;

    for v_item in
        select *
        from jsonb_to_recordset(p_items) as item(product_id uuid, quantity integer)
    loop
        v_validation := public.validate_orderable_product(v_item.product_id, v_item.quantity, true);

        if not coalesce((v_validation ->> 'success')::boolean, false) then
            return jsonb_build_object('success', false, 'error', coalesce(v_validation ->> 'error', 'Product validation failed'));
        end if;

        if v_merchant_id is null then
            v_merchant_id := (v_validation ->> 'merchant_id')::uuid;
        elsif v_merchant_id <> (v_validation ->> 'merchant_id')::uuid then
            return jsonb_build_object('success', false, 'error', 'Mixed merchant carts are not allowed');
        end if;

        v_subtotal_kobo := v_subtotal_kobo + (((v_validation ->> 'price_kobo')::bigint) * v_item.quantity);
    end loop;

    if coalesce(p_points_to_redeem, 0) > 0 then
        v_redemption := public.apply_reward_points_redemption(
            p_user_id,
            v_order_id,
            p_points_to_redeem,
            v_subtotal_kobo,
            false
        );

        if not coalesce((v_redemption ->> 'success')::boolean, false) then
            return v_redemption;
        end if;

        v_points_discount_kobo := coalesce((v_redemption ->> 'discount_kobo')::bigint, 0);
        v_points_used := coalesce((v_redemption ->> 'points_used')::integer, 0);
    end if;

    v_total_kobo := greatest(v_subtotal_kobo - v_points_discount_kobo, 0) + greatest(coalesce(p_delivery_fee_kobo, 0), 0);

    if coalesce(v_wallet_balance, 0) < v_total_kobo then
        if v_points_used > 0 then
            perform public.restore_order_reward_point_redemption(v_order_id);
        end if;

        return jsonb_build_object('success', false, 'error', 'Insufficient wallet balance');
    end if;

    insert into public.orders (
        id,
        customer_id,
        merchant_id,
        total_amount,
        subtotal_amount_kobo,
        points_discount_kobo,
        points_redeemed,
        status,
        payment_status,
        delivery_location,
        payment_ref,
        delivery_fee_kobo,
        delivery_fee,
        contact_numbers
    )
    values (
        v_order_id,
        p_user_id,
        v_merchant_id,
        v_total_kobo,
        v_subtotal_kobo,
        v_points_discount_kobo,
        v_points_used,
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
    );

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

        perform public.consume_orderable_product_stock(v_item.product_id, v_item.quantity);
    end loop;

    update public.wallets
    set balance = balance - v_total_kobo
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
        v_total_kobo,
        'debit',
        'success',
        v_payment_reference,
        'Customer wallet payment for order ' || substr(v_order_id::text, 1, 8)
    );

    perform public.refresh_order_financials(v_order_id);

    v_assigned_agent_id := public.assign_best_agent(
        v_order_id,
        p_user_id,
        'auto',
        'System auto assignment after paid order creation'
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

    perform public.write_audit_log(
        p_user_id,
        'create_paid_order',
        'order',
        v_order_id,
        jsonb_build_object('payment_reference', v_payment_reference, 'merchant_id', v_merchant_id, 'points_used', v_points_used)
    );

    return jsonb_build_object('success', true, 'order_id', v_order_id, 'payment_reference', v_payment_reference);
end;
$function$;

drop function if exists public.create_paid_order_with_gift_card(uuid, jsonb, jsonb, bigint, jsonb, text);
create function public.create_paid_order_with_gift_card(
    p_user_id uuid,
    p_items jsonb,
    p_delivery_location jsonb,
    p_delivery_fee_kobo bigint default 0,
    p_contact_numbers jsonb default '[]'::jsonb,
    p_payment_reference text default null,
    p_points_to_redeem integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
    v_actor uuid := auth.uid();
    v_order_id uuid := gen_random_uuid();
    v_item record;
    v_product record;
    v_validation jsonb;
    v_merchant_id uuid;
    v_subtotal_kobo bigint := 0;
    v_total_kobo bigint := 0;
    v_payment_reference text := coalesce(p_payment_reference, 'GFTPAY-' || encode(gen_random_bytes(8), 'hex'));
    v_assigned_agent_id uuid;
    v_available_kobo bigint := 0;
    v_remaining_to_apply bigint;
    v_debit_kobo bigint;
    v_gift_card record;
    v_redemption jsonb := jsonb_build_object('success', true, 'points_used', 0, 'discount_kobo', 0);
    v_points_discount_kobo bigint := 0;
    v_points_used integer := 0;
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

    perform public.process_reward_point_expiries(p_user_id);

    for v_item in
        select *
        from jsonb_to_recordset(p_items) as item(product_id uuid, quantity integer)
    loop
        v_validation := public.validate_orderable_product(v_item.product_id, v_item.quantity, true);

        if not coalesce((v_validation ->> 'success')::boolean, false) then
            return jsonb_build_object('success', false, 'error', coalesce(v_validation ->> 'error', 'Product validation failed'));
        end if;

        if v_merchant_id is null then
            v_merchant_id := (v_validation ->> 'merchant_id')::uuid;
        elsif v_merchant_id <> (v_validation ->> 'merchant_id')::uuid then
            return jsonb_build_object('success', false, 'error', 'Mixed merchant carts are not allowed');
        end if;

        v_subtotal_kobo := v_subtotal_kobo + (((v_validation ->> 'price_kobo')::bigint) * v_item.quantity);
    end loop;

    if coalesce(p_points_to_redeem, 0) > 0 then
        v_redemption := public.apply_reward_points_redemption(
            p_user_id,
            v_order_id,
            p_points_to_redeem,
            v_subtotal_kobo,
            false
        );

        if not coalesce((v_redemption ->> 'success')::boolean, false) then
            return v_redemption;
        end if;

        v_points_discount_kobo := coalesce((v_redemption ->> 'discount_kobo')::bigint, 0);
        v_points_used := coalesce((v_redemption ->> 'points_used')::integer, 0);
    end if;

    v_total_kobo := greatest(v_subtotal_kobo - v_points_discount_kobo, 0) + greatest(coalesce(p_delivery_fee_kobo, 0), 0);
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
        if v_points_used > 0 then
            perform public.restore_order_reward_point_redemption(v_order_id);
        end if;

        return jsonb_build_object('success', false, 'error', 'Insufficient gift card balance');
    end if;

    insert into public.orders (
        id,
        customer_id,
        merchant_id,
        total_amount,
        subtotal_amount_kobo,
        points_discount_kobo,
        points_redeemed,
        status,
        payment_status,
        delivery_location,
        payment_ref,
        delivery_fee_kobo,
        delivery_fee,
        contact_numbers
    )
    values (
        v_order_id,
        p_user_id,
        v_merchant_id,
        v_total_kobo,
        v_subtotal_kobo,
        v_points_discount_kobo,
        v_points_used,
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
    );

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

        perform public.consume_orderable_product_stock(v_item.product_id, v_item.quantity);
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
        jsonb_build_object('payment_reference', v_payment_reference, 'merchant_id', v_merchant_id, 'amount_kobo', v_total_kobo, 'points_used', v_points_used)
    );

    return jsonb_build_object('success', true, 'order_id', v_order_id, 'payment_reference', v_payment_reference);
end;
$function$;

drop function if exists public.create_pending_order(uuid, jsonb, jsonb, bigint, jsonb, text);
create function public.create_pending_order(
    p_user_id uuid,
    p_items jsonb,
    p_delivery_location jsonb,
    p_delivery_fee_kobo bigint default 0,
    p_contact_numbers jsonb default '[]'::jsonb,
    p_payment_reference text default null,
    p_points_to_redeem integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
    v_actor uuid := auth.uid();
    v_order_id uuid := gen_random_uuid();
    v_item record;
    v_product record;
    v_validation jsonb;
    v_merchant_id uuid;
    v_subtotal_kobo bigint := 0;
    v_total_kobo bigint := 0;
    v_payment_reference text := coalesce(p_payment_reference, 'ORD-' || encode(gen_random_bytes(8), 'hex'));
    v_redemption jsonb := jsonb_build_object('success', true, 'points_used', 0, 'discount_kobo', 0);
    v_points_discount_kobo bigint := 0;
    v_points_used integer := 0;
begin
    if v_actor is null then
        return jsonb_build_object('success', false, 'error', 'Authentication required');
    end if;

    if p_user_id is distinct from v_actor then
        return jsonb_build_object('success', false, 'error', 'You can only place orders for your own account');
    end if;

    if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
        return jsonb_build_object('success', false, 'error', 'Cart is empty');
    end if;

    perform public.process_reward_point_expiries(p_user_id);

    for v_item in
        select *
        from jsonb_to_recordset(p_items) as item(product_id uuid, quantity integer)
    loop
        v_validation := public.validate_orderable_product(v_item.product_id, v_item.quantity, false);

        if not coalesce((v_validation ->> 'success')::boolean, false) then
            return jsonb_build_object('success', false, 'error', coalesce(v_validation ->> 'error', 'Product validation failed'));
        end if;

        if v_merchant_id is null then
            v_merchant_id := (v_validation ->> 'merchant_id')::uuid;
        elsif v_merchant_id <> (v_validation ->> 'merchant_id')::uuid then
            return jsonb_build_object('success', false, 'error', 'Mixed merchant carts are not allowed');
        end if;

        v_subtotal_kobo := v_subtotal_kobo + (((v_validation ->> 'price_kobo')::bigint) * v_item.quantity);
    end loop;

    if coalesce(p_points_to_redeem, 0) > 0 then
        v_redemption := public.apply_reward_points_redemption(
            p_user_id,
            v_order_id,
            p_points_to_redeem,
            v_subtotal_kobo,
            true
        );

        if not coalesce((v_redemption ->> 'success')::boolean, false) then
            return v_redemption;
        end if;

        v_points_discount_kobo := coalesce((v_redemption ->> 'discount_kobo')::bigint, 0);
        v_points_used := coalesce((v_redemption ->> 'points_used')::integer, 0);
    end if;

    v_total_kobo := greatest(v_subtotal_kobo - v_points_discount_kobo, 0) + greatest(coalesce(p_delivery_fee_kobo, 0), 0);

    insert into public.orders (
        id,
        customer_id,
        merchant_id,
        total_amount,
        subtotal_amount_kobo,
        points_discount_kobo,
        points_redeemed,
        status,
        payment_status,
        delivery_location,
        payment_ref,
        delivery_fee_kobo,
        delivery_fee,
        contact_numbers
    )
    values (
        v_order_id,
        p_user_id,
        v_merchant_id,
        v_total_kobo,
        v_subtotal_kobo,
        v_points_discount_kobo,
        v_points_used,
        'pending',
        'pending',
        case
            when p_delivery_location is null then null
            else ST_SetSRID(ST_GeomFromGeoJSON(p_delivery_location), 4326)::geography
        end,
        v_payment_reference,
        greatest(coalesce(p_delivery_fee_kobo, 0), 0),
        greatest(coalesce(p_delivery_fee_kobo, 0), 0) / 100.0,
        coalesce(p_contact_numbers, '[]'::jsonb)
    );

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
    end loop;

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

    perform public.write_audit_log(
        p_user_id,
        'create_pending_order',
        'order',
        v_order_id,
        jsonb_build_object('payment_reference', v_payment_reference, 'merchant_id', v_merchant_id, 'points_used', v_points_used)
    );

    return jsonb_build_object(
        'success',
        true,
        'order_id',
        v_order_id,
        'payment_reference',
        v_payment_reference,
        'points_used',
        v_points_used,
        'points_discount_kobo',
        v_points_discount_kobo
    );
end;
$function$;

create or replace function public.mark_pending_order_paid(
    p_order_id uuid,
    p_payment_reference text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
    v_order public.orders;
    v_item record;
    v_validation jsonb;
    v_customer_wallet uuid;
    v_refund_id uuid;
    v_assigned_agent_id uuid;
begin
    select *
    into v_order
    from public.orders
    where id = p_order_id
    for update;

    if not found then
        return jsonb_build_object('success', false, 'error', 'Order not found');
    end if;

    if v_order.payment_status = 'paid' then
        update public.reward_point_redemptions
        set status = 'applied',
            updated_at = now()
        where order_id = p_order_id
          and status = 'reserved';

        return jsonb_build_object('success', true, 'order_id', p_order_id, 'message', 'Order already marked paid');
    end if;

    if v_order.payment_status = 'refunded' then
        return jsonb_build_object('success', true, 'order_id', p_order_id, 'message', 'Order already refunded');
    end if;

    if v_order.status <> 'pending' or v_order.payment_status <> 'pending' then
        return jsonb_build_object('success', false, 'error', 'Order is not awaiting payment');
    end if;

    for v_item in
        select oi.product_id, oi.quantity
        from public.order_items oi
        where oi.order_id = p_order_id
    loop
        v_validation := public.validate_orderable_product(v_item.product_id, v_item.quantity, true);

        if not coalesce((v_validation ->> 'success')::boolean, false) then
            v_customer_wallet := public.ensure_actor_wallet(v_order.customer_id, 'customer');

            insert into public.refunds (
                order_id,
                amount_kobo,
                reason,
                status,
                processed_at
            )
            values (
                p_order_id,
                v_order.total_amount,
                'Auto refund after direct payment could not be fulfilled',
                'processed',
                now()
            )
            returning id into v_refund_id;

            update public.wallets
            set balance = balance + v_order.total_amount
            where id = v_customer_wallet;

            insert into public.ledger_entries (wallet_id, amount, description, reference_id)
            values (v_customer_wallet, v_order.total_amount, 'Auto refund for unfulfillable direct payment order', p_order_id);

            update public.orders
            set payment_status = 'refunded',
                status = 'refunded',
                payment_ref = coalesce(p_payment_reference, v_order.payment_ref)
            where id = p_order_id;

            update public.order_financials
            set settlement_status = 'refunded',
                updated_at = now()
            where order_id = p_order_id;

            perform public.write_audit_log(
                null,
                'mark_direct_payment_success_auto_refund',
                'order',
                p_order_id,
                jsonb_build_object('payment_reference', coalesce(p_payment_reference, v_order.payment_ref), 'refund_id', v_refund_id)
            );

            return jsonb_build_object('success', true, 'order_id', p_order_id, 'auto_refunded', true);
        end if;
    end loop;

    for v_item in
        select oi.product_id, oi.quantity
        from public.order_items oi
        where oi.order_id = p_order_id
    loop
        perform public.consume_orderable_product_stock(v_item.product_id, v_item.quantity);
    end loop;

    update public.orders
    set payment_status = 'paid',
        status = 'awaiting_agent_acceptance',
        payment_ref = coalesce(p_payment_reference, v_order.payment_ref)
    where id = p_order_id;

    update public.reward_point_redemptions
    set status = 'applied',
        updated_at = now()
    where order_id = p_order_id
      and status = 'reserved';

    perform public.refresh_order_financials(p_order_id);

    v_assigned_agent_id := public.assign_best_agent(
        p_order_id,
        null,
        'auto',
        'System auto assignment after direct payment confirmation'
    );

    if v_assigned_agent_id is null then
        v_customer_wallet := public.ensure_actor_wallet(v_order.customer_id, 'customer');

        insert into public.refunds (
            order_id,
            amount_kobo,
            reason,
            status,
            processed_at
        )
        values (
            p_order_id,
            v_order.total_amount,
            'Auto refund after direct payment because no approved agent was available',
            'processed',
            now()
        )
        returning id into v_refund_id;

        update public.wallets
        set balance = balance + v_order.total_amount
        where id = v_customer_wallet;

        insert into public.ledger_entries (wallet_id, amount, description, reference_id)
        values (v_customer_wallet, v_order.total_amount, 'Auto refund for direct payment order without available agent', p_order_id);

        update public.orders
        set payment_status = 'refunded',
            status = 'refunded'
        where id = p_order_id;

        update public.order_financials
        set settlement_status = 'refunded',
            updated_at = now()
        where order_id = p_order_id;

        perform public.write_audit_log(
            null,
            'mark_direct_payment_success_auto_refund',
            'order',
            p_order_id,
            jsonb_build_object('payment_reference', coalesce(p_payment_reference, v_order.payment_ref), 'refund_id', v_refund_id, 'reason', 'no_agent_available')
        );

        return jsonb_build_object('success', true, 'order_id', p_order_id, 'auto_refunded', true);
    end if;

    perform public.write_audit_log(
        null,
        'mark_direct_payment_success',
        'order',
        p_order_id,
        jsonb_build_object('payment_reference', coalesce(p_payment_reference, v_order.payment_ref))
    );

    return jsonb_build_object('success', true, 'order_id', p_order_id);
end;
$function$;

create or replace function public.mark_direct_payment_success(
    p_order_id uuid,
    p_payment_reference text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
begin
    return public.mark_pending_order_paid(p_order_id, p_payment_reference);
end;
$function$;

alter table public.reward_point_balances enable row level security;
alter table public.reward_point_lots enable row level security;
alter table public.reward_point_redemptions enable row level security;
alter table public.reward_point_events enable row level security;

drop policy if exists "Reward balances visible to owner or admin" on public.reward_point_balances;
create policy "Reward balances visible to owner or admin"
on public.reward_point_balances
for select
to authenticated
using (
    user_id = auth.uid()
    or public.jwt_has_any_role(array['admin', 'sub_admin', 'supa_admin'])
);

drop policy if exists "Reward lots visible to owner or admin" on public.reward_point_lots;
create policy "Reward lots visible to owner or admin"
on public.reward_point_lots
for select
to authenticated
using (
    user_id = auth.uid()
    or public.jwt_has_any_role(array['admin', 'sub_admin', 'supa_admin'])
);

drop policy if exists "Reward redemptions visible to owner or admin" on public.reward_point_redemptions;
create policy "Reward redemptions visible to owner or admin"
on public.reward_point_redemptions
for select
to authenticated
using (
    user_id = auth.uid()
    or public.jwt_has_any_role(array['admin', 'sub_admin', 'supa_admin'])
);

drop policy if exists "Reward events visible to owner or admin" on public.reward_point_events;
create policy "Reward events visible to owner or admin"
on public.reward_point_events
for select
to authenticated
using (
    user_id = auth.uid()
    or public.jwt_has_any_role(array['admin', 'sub_admin', 'supa_admin'])
);

grant select on public.reward_point_balances to authenticated, service_role;
grant select on public.reward_point_lots to authenticated, service_role;
grant select on public.reward_point_redemptions to authenticated, service_role;
grant select on public.reward_point_events to authenticated, service_role;

grant execute on function public.process_reward_point_expiries(uuid) to authenticated, service_role;
grant execute on function public.get_reward_checkout_summary(bigint) to authenticated, service_role;
grant execute on function public.cancel_unpaid_order(uuid) to authenticated, service_role;
grant execute on function public.create_paid_order(uuid, jsonb, jsonb, bigint, jsonb, text, integer) to authenticated, service_role;
grant execute on function public.create_paid_order_with_gift_card(uuid, jsonb, jsonb, bigint, jsonb, text, integer) to authenticated, service_role;
grant execute on function public.create_pending_order(uuid, jsonb, jsonb, bigint, jsonb, text, integer) to authenticated, service_role;
grant execute on function public.mark_pending_order_paid(uuid, text) to authenticated, service_role;
grant execute on function public.mark_direct_payment_success(uuid, text) to authenticated, service_role;
