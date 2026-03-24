insert into public.app_settings (key, value, description)
values (
    'referral_commission_bps',
    to_jsonb(100),
    'Referral commission rate in basis points. 100 = 1%.'
)
on conflict (key) do update
set description = excluded.description;

create or replace function public.get_referral_commission_bps()
returns integer
language sql
stable
as $$
    select greatest(
        0,
        least(
            10000,
            coalesce(
                (select (value #>> '{}')::integer from public.app_settings where key = 'referral_commission_bps'),
                100
            )
        )
    );
$$;

create or replace function public.generate_referral_code(p_seed text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    v_prefix text;
    v_candidate text;
begin
    v_prefix := upper(regexp_replace(coalesce(left(p_seed, 3), 'RSS'), '[^A-Z0-9]+', '', 'g'));

    if coalesce(length(v_prefix), 0) < 3 then
        v_prefix := rpad(coalesce(v_prefix, 'RSS'), 3, 'X');
    end if;

    loop
        v_candidate := v_prefix || '-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
        exit when not exists (
            select 1
            from public.profiles
            where referral_code = v_candidate
        );
    end loop;

    return v_candidate;
end;
$$;

do $$
declare
    v_profile record;
begin
    for v_profile in
        select id, full_name
        from public.profiles
        where referral_code is null
           or btrim(referral_code) = ''
    loop
        update public.profiles
        set referral_code = public.generate_referral_code(coalesce(v_profile.full_name, v_profile.id::text))
        where id = v_profile.id;
    end loop;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_full_name text := coalesce(new.raw_user_meta_data ->> 'full_name', new.email);
    v_referred_by_code text := nullif(upper(btrim(new.raw_user_meta_data ->> 'referred_by_code')), '');
    v_referrer_id uuid;
begin
    if v_referred_by_code is not null then
        select id
        into v_referrer_id
        from public.profiles
        where upper(referral_code) = v_referred_by_code
        limit 1;
    end if;

    insert into public.profiles (
        id,
        full_name,
        avatar_url,
        referral_code,
        referred_by
    )
    values (
        new.id,
        v_full_name,
        new.raw_user_meta_data ->> 'avatar_url',
        public.generate_referral_code(v_full_name),
        case
            when v_referrer_id is distinct from new.id then v_referrer_id
            else null
        end
    );

    return new;
end;
$$;

create table if not exists public.referral_commissions (
    id uuid primary key default uuid_generate_v4(),
    referrer_id uuid not null references public.profiles(id) on delete cascade,
    referred_user_id uuid not null references public.profiles(id) on delete cascade,
    source_ledger_entry_id uuid not null references public.ledger_entries(id) on delete cascade,
    source_reference_id uuid,
    source_kind text not null check (source_kind in ('merchant_payout', 'agent_commission', 'rider_earnings')),
    source_amount_kobo bigint not null check (source_amount_kobo > 0),
    commission_bps integer not null check (commission_bps >= 0 and commission_bps <= 10000),
    commission_amount_kobo bigint not null check (commission_amount_kobo >= 0),
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    unique (source_ledger_entry_id)
);

create index if not exists profiles_referred_by_idx
    on public.profiles (referred_by);

create index if not exists referral_commissions_referrer_created_idx
    on public.referral_commissions (referrer_id, created_at desc);

create index if not exists referral_commissions_referred_created_idx
    on public.referral_commissions (referred_user_id, created_at desc);

create or replace function public.process_referral_commission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_referred_user_id uuid;
    v_referrer_id uuid;
    v_referrer_wallet_id uuid;
    v_source_kind text;
    v_commission_bps integer;
    v_commission_amount_kobo bigint;
begin
    if new.amount <= 0 then
        return new;
    end if;

    if new.description ilike 'Merchant payout for order%' then
        v_source_kind := 'merchant_payout';
    elsif new.description ilike 'Agent payout for order%' then
        v_source_kind := 'agent_commission';
    elsif new.description ilike 'Rider payout for order%' then
        v_source_kind := 'rider_earnings';
    else
        return new;
    end if;

    select owner_id
    into v_referred_user_id
    from public.wallets
    where id = new.wallet_id;

    if v_referred_user_id is null then
        return new;
    end if;

    select referred_by
    into v_referrer_id
    from public.profiles
    where id = v_referred_user_id;

    if v_referrer_id is null or v_referrer_id = v_referred_user_id then
        return new;
    end if;

    v_commission_bps := public.get_referral_commission_bps();

    if v_commission_bps <= 0 then
        return new;
    end if;

    v_commission_amount_kobo := round((new.amount * v_commission_bps)::numeric / 10000.0)::bigint;

    if v_commission_amount_kobo <= 0 then
        return new;
    end if;

    insert into public.referral_commissions (
        referrer_id,
        referred_user_id,
        source_ledger_entry_id,
        source_reference_id,
        source_kind,
        source_amount_kobo,
        commission_bps,
        commission_amount_kobo,
        metadata
    )
    values (
        v_referrer_id,
        v_referred_user_id,
        new.id,
        new.reference_id,
        v_source_kind,
        new.amount,
        v_commission_bps,
        v_commission_amount_kobo,
        jsonb_build_object(
            'wallet_id', new.wallet_id,
            'ledger_description', new.description
        )
    )
    on conflict (source_ledger_entry_id) do nothing;

    if not found then
        return new;
    end if;

    v_referrer_wallet_id := public.ensure_actor_wallet(v_referrer_id, 'customer');

    update public.wallets
    set balance = balance + v_commission_amount_kobo
    where id = v_referrer_wallet_id;

    insert into public.ledger_entries (
        wallet_id,
        amount,
        description,
        reference_id
    )
    values (
        v_referrer_wallet_id,
        v_commission_amount_kobo,
        'Referral reward from referred user payout',
        new.reference_id
    );

    return new;
end;
$$;

drop trigger if exists process_referral_commission_on_ledger_entry on public.ledger_entries;
create trigger process_referral_commission_on_ledger_entry
after insert on public.ledger_entries
for each row
execute function public.process_referral_commission();

create or replace function public.get_my_referral_overview()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid := auth.uid();
    v_profile record;
    v_total_referrals integer := 0;
    v_total_earnings_kobo bigint := 0;
    v_month_earnings_kobo bigint := 0;
    v_referrals jsonb := '[]'::jsonb;
    v_history jsonb := '[]'::jsonb;
begin
    if v_user_id is null then
        return jsonb_build_object('success', false, 'error', 'Authentication required');
    end if;

    select id, full_name, referral_code
    into v_profile
    from public.profiles
    where id = v_user_id;

    if not found then
        return jsonb_build_object('success', false, 'error', 'Profile not found');
    end if;

    if v_profile.referral_code is null or btrim(v_profile.referral_code) = '' then
        update public.profiles
        set referral_code = public.generate_referral_code(coalesce(v_profile.full_name, v_user_id::text))
        where id = v_user_id
        returning referral_code into v_profile.referral_code;
    end if;

    select count(*)
    into v_total_referrals
    from public.profiles
    where referred_by = v_user_id;

    select
        coalesce(sum(commission_amount_kobo), 0),
        coalesce(sum(commission_amount_kobo) filter (where created_at >= date_trunc('month', now())), 0)
    into v_total_earnings_kobo, v_month_earnings_kobo
    from public.referral_commissions
    where referrer_id = v_user_id;

    select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'id', p.id,
                'full_name', p.full_name,
                'total_earned_kobo', coalesce(rc.total_earned_kobo, 0),
                'reward_events', coalesce(rc.reward_events, 0)
            )
            order by coalesce(rc.total_earned_kobo, 0) desc, p.full_name
        ),
        '[]'::jsonb
    )
    into v_referrals
    from public.profiles p
    left join (
        select
            referred_user_id,
            sum(commission_amount_kobo) as total_earned_kobo,
            count(*) as reward_events
        from public.referral_commissions
        where referrer_id = v_user_id
        group by referred_user_id
    ) rc
        on rc.referred_user_id = p.id
    where p.referred_by = v_user_id;

    select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'id', h.id,
                'commission_amount_kobo', h.commission_amount_kobo,
                'source_amount_kobo', h.source_amount_kobo,
                'source_kind', h.source_kind,
                'created_at', h.created_at,
                'referred_user_id', h.referred_user_id,
                'referred_user_name', h.referred_user_name
            )
            order by h.created_at desc
        ),
        '[]'::jsonb
    )
    into v_history
    from (
        select
            rc.id,
            rc.commission_amount_kobo,
            rc.source_amount_kobo,
            rc.source_kind,
            rc.created_at,
            rc.referred_user_id,
            coalesce(p.full_name, 'RSS User') as referred_user_name
        from public.referral_commissions rc
        left join public.profiles p
            on p.id = rc.referred_user_id
        where rc.referrer_id = v_user_id
        order by rc.created_at desc
        limit 25
    ) h;

    return jsonb_build_object(
        'success', true,
        'referral_code', v_profile.referral_code,
        'commission_bps', public.get_referral_commission_bps(),
        'stats', jsonb_build_object(
            'total_referrals', v_total_referrals,
            'total_earnings_kobo', v_total_earnings_kobo,
            'month_earnings_kobo', v_month_earnings_kobo
        ),
        'referrals', v_referrals,
        'history', v_history
    );
end;
$$;

create or replace function public.get_referral_admin_dashboard(p_limit integer default 10)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_total_referrals integer := 0;
    v_active_referrers integer := 0;
    v_total_rewards_kobo bigint := 0;
    v_reward_events integer := 0;
    v_leaderboard jsonb := '[]'::jsonb;
    v_recent_rewards jsonb := '[]'::jsonb;
begin
    if not public.jwt_has_any_role(array['admin', 'sub_admin', 'supa_admin']) then
        return jsonb_build_object('success', false, 'error', 'Admin access required');
    end if;

    select count(*)
    into v_total_referrals
    from public.profiles
    where referred_by is not null;

    select count(distinct referred_by)
    into v_active_referrers
    from public.profiles
    where referred_by is not null;

    select
        coalesce(sum(commission_amount_kobo), 0),
        count(*)
    into v_total_rewards_kobo, v_reward_events
    from public.referral_commissions;

    select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'rank', lb.rank,
                'referrer_id', lb.referrer_id,
                'full_name', lb.full_name,
                'referral_code', lb.referral_code,
                'total_referrals', lb.total_referrals,
                'reward_events', lb.reward_events,
                'total_earnings_kobo', lb.total_earnings_kobo
            )
            order by lb.rank, lb.full_name
        ),
        '[]'::jsonb
    )
    into v_leaderboard
    from (
        select
            ranked.referrer_id,
            ranked.full_name,
            ranked.referral_code,
            ranked.total_referrals,
            ranked.reward_events,
            ranked.total_earnings_kobo,
            dense_rank() over (
                order by ranked.total_earnings_kobo desc, ranked.total_referrals desc, ranked.full_name
            ) as rank
        from (
            select
                p.id as referrer_id,
                p.full_name,
                p.referral_code,
                count(distinct referred.id) as total_referrals,
                count(rc.id) as reward_events,
                coalesce(sum(rc.commission_amount_kobo), 0) as total_earnings_kobo
            from public.profiles p
            join public.profiles referred
                on referred.referred_by = p.id
            left join public.referral_commissions rc
                on rc.referrer_id = p.id
            group by p.id, p.full_name, p.referral_code
        ) ranked
        order by ranked.total_earnings_kobo desc, ranked.total_referrals desc, ranked.full_name
        limit greatest(coalesce(p_limit, 10), 1)
    ) lb;

    select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'id', rr.id,
                'created_at', rr.created_at,
                'source_kind', rr.source_kind,
                'source_amount_kobo', rr.source_amount_kobo,
                'commission_amount_kobo', rr.commission_amount_kobo,
                'referrer_id', rr.referrer_id,
                'referrer_name', rr.referrer_name,
                'referred_user_id', rr.referred_user_id,
                'referred_user_name', rr.referred_user_name
            )
            order by rr.created_at desc
        ),
        '[]'::jsonb
    )
    into v_recent_rewards
    from (
        select
            rc.id,
            rc.created_at,
            rc.source_kind,
            rc.source_amount_kobo,
            rc.commission_amount_kobo,
            rc.referrer_id,
            coalesce(referrer.full_name, 'RSS User') as referrer_name,
            rc.referred_user_id,
            coalesce(referred.full_name, 'RSS User') as referred_user_name
        from public.referral_commissions rc
        left join public.profiles referrer
            on referrer.id = rc.referrer_id
        left join public.profiles referred
            on referred.id = rc.referred_user_id
        order by rc.created_at desc
        limit 20
    ) rr;

    return jsonb_build_object(
        'success', true,
        'commission_bps', public.get_referral_commission_bps(),
        'stats', jsonb_build_object(
            'total_referrals', v_total_referrals,
            'active_referrers', v_active_referrers,
            'total_rewards_kobo', v_total_rewards_kobo,
            'reward_events', v_reward_events
        ),
        'leaderboard', v_leaderboard,
        'recent_rewards', v_recent_rewards
    );
end;
$$;

drop policy if exists "Referrers can view own referral commissions" on public.referral_commissions;
create policy "Referrers can view own referral commissions"
on public.referral_commissions
for select
using (referrer_id = auth.uid());

drop policy if exists "Admins can view all referral commissions" on public.referral_commissions;
create policy "Admins can view all referral commissions"
on public.referral_commissions
for select
using (public.jwt_has_any_role(array['admin', 'sub_admin', 'supa_admin']));

alter table public.referral_commissions enable row level security;

create or replace function public.notify_ledger_entry()
returns trigger
language plpgsql
security definer
set search_path to 'public'
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
        if new.description ilike '%referral reward%' then
            v_title := 'Referral reward received';
            v_type := 'referral_reward';
        elsif new.description ilike '%merchant payout%' then
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
