insert into public.app_settings (key, value, description)
values (
    'wallet_fee_settings',
    jsonb_build_object(
        'collection_fee_bps', 150,
        'collection_fee_cap_kobo', 200000,
        'fee_vat_bps', 750,
        'rss_topup_fee_bps', 0,
        'payout_below_10k_kobo', 1000,
        'payout_below_50k_kobo', 2000,
        'payout_50k_plus_kobo', 4000,
        'rss_withdrawal_fee_bps', 0
    ),
    'Editable Monnify collection and payout fee rules. Historical transactions keep their quoted values.'
)
on conflict (key) do nothing;

create table if not exists public.wallet_topup_requests (
    id uuid primary key default gen_random_uuid(),
    reference text not null unique,
    user_id uuid not null references auth.users(id) on delete restrict,
    wallet_id uuid not null references public.wallets(id) on delete restrict,
    transaction_id uuid not null unique references public.wallet_transactions(id) on delete restrict,
    wallet_credit_kobo bigint not null check (wallet_credit_kobo > 0),
    processor_fee_kobo bigint not null check (processor_fee_kobo >= 0),
    processor_fee_vat_kobo bigint not null check (processor_fee_vat_kobo >= 0),
    rss_fee_kobo bigint not null default 0 check (rss_fee_kobo >= 0),
    total_charge_kobo bigint not null check (total_charge_kobo > 0),
    actual_amount_paid_kobo bigint,
    actual_settlement_kobo bigint,
    actual_processor_fee_kobo bigint,
    monnify_transaction_reference text,
    reconciliation_status text not null default 'pending' check (reconciliation_status in ('pending','matched','fee_mismatch')),
    fee_rules jsonb not null,
    created_at timestamptz not null default now(),
    completed_at timestamptz
);

alter table public.wallet_topup_requests enable row level security;
revoke all on public.wallet_topup_requests from public, anon, authenticated;
grant select on public.wallet_topup_requests to authenticated;
drop policy if exists "Users can view own wallet topups" on public.wallet_topup_requests;
create policy "Users can view own wallet topups" on public.wallet_topup_requests
for select to authenticated using (user_id = auth.uid());

alter table public.wallet_withdrawal_requests
    add column if not exists processor_fee_kobo bigint not null default 0,
    add column if not exists processor_fee_vat_kobo bigint not null default 0,
    add column if not exists rss_fee_kobo bigint not null default 0,
    add column if not exists payout_amount_kobo bigint,
    add column if not exists fee_rules jsonb not null default '{}'::jsonb;

create or replace function public.initiate_wallet_topup(p_wallet_credit_kobo bigint, p_reference text)
returns jsonb language plpgsql security definer set search_path=public
as $function$
declare
    v_wallet public.wallets%rowtype;
    v_settings jsonb;
    v_transaction_id uuid;
    v_processor_fee bigint := 0;
    v_processor_vat bigint := 0;
    v_rss_fee bigint := 0;
    v_target bigint;
    v_total bigint;
    v_next bigint;
    v_attempt integer := 0;
begin
    if auth.uid() is null then return jsonb_build_object('success',false,'error','Authentication required'); end if;
    if p_wallet_credit_kobo is null or p_wallet_credit_kobo < 10000 then return jsonb_build_object('success',false,'error','Minimum top-up is NGN 100'); end if;
    if p_reference !~ '^WAL-[0-9a-fA-F-]{36}$' then return jsonb_build_object('success',false,'error','Invalid top-up reference'); end if;
    select * into v_wallet from public.wallets where id=auth.uid() and owner_id=auth.uid() and type='customer' for update;
    if not found then return jsonb_build_object('success',false,'error','Customer wallet not found'); end if;
    select value into v_settings from public.app_settings where key='wallet_fee_settings';
    v_settings := coalesce(v_settings,'{}'::jsonb);
    v_rss_fee := round(p_wallet_credit_kobo*coalesce((v_settings->>'rss_topup_fee_bps')::integer,0)::numeric/10000)::bigint;
    v_target := p_wallet_credit_kobo+v_rss_fee;
    v_total := v_target;
    loop
        v_processor_fee := least(round(v_total*coalesce((v_settings->>'collection_fee_bps')::integer,150)::numeric/10000)::bigint,
            coalesce((v_settings->>'collection_fee_cap_kobo')::bigint,200000));
        v_processor_vat := round(v_processor_fee*coalesce((v_settings->>'fee_vat_bps')::integer,750)::numeric/10000)::bigint;
        v_next := v_target+v_processor_fee+v_processor_vat;
        exit when v_next=v_total or v_attempt>=20;
        v_total:=v_next; v_attempt:=v_attempt+1;
    end loop;
    v_total:=v_next;
    insert into public.wallet_transactions(wallet_id,amount,type,status,reference,description)
    values(v_wallet.id,p_wallet_credit_kobo,'credit','pending',p_reference,'Wallet top-up credit') returning id into v_transaction_id;
    insert into public.wallet_topup_requests(reference,user_id,wallet_id,transaction_id,wallet_credit_kobo,
        processor_fee_kobo,processor_fee_vat_kobo,rss_fee_kobo,total_charge_kobo,fee_rules)
    values(p_reference,auth.uid(),v_wallet.id,v_transaction_id,p_wallet_credit_kobo,
        v_processor_fee,v_processor_vat,v_rss_fee,v_total,v_settings);
    return jsonb_build_object('success',true,'reference',p_reference,'wallet_credit_kobo',p_wallet_credit_kobo,
        'processor_fee_kobo',v_processor_fee,'processor_fee_vat_kobo',v_processor_vat,'rss_fee_kobo',v_rss_fee,'total_charge_kobo',v_total);
exception when unique_violation then return jsonb_build_object('success',false,'error','Top-up reference already exists');
end;
$function$;

create or replace function public.initiate_wallet_withdrawal(
    p_wallet_id uuid,
    amount_kobo bigint,
    bank_code text,
    account_number text,
    bank_name text,
    reference text,
    description text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
    v_wallet public.wallets%rowtype;
    v_transaction_id uuid;
    v_settings jsonb;
    v_processor_fee bigint;
    v_processor_vat bigint;
    v_rss_fee bigint;
    v_payout bigint;
    v_role_wallet_mode text := 'month_end_only';
    v_lagos_today date := timezone('Africa/Lagos', now())::date;
    v_lagos_month_end date := (date_trunc('month', timezone('Africa/Lagos', now())) + interval '1 month - 1 day')::date;
begin
    if auth.uid() is null then return jsonb_build_object('success', false, 'error', 'Authentication required'); end if;
    if amount_kobo is null or amount_kobo < 100000 then return jsonb_build_object('success', false, 'error', 'Minimum withdrawal is NGN 1,000'); end if;
    if coalesce(trim(bank_code), '') !~ '^[0-9]{3,10}$' then return jsonb_build_object('success', false, 'error', 'Invalid bank code'); end if;
    if coalesce(trim(account_number), '') !~ '^[0-9]{10}$' then return jsonb_build_object('success', false, 'error', 'Account number must contain 10 digits'); end if;
    if coalesce(trim(bank_name), '') = '' then return jsonb_build_object('success', false, 'error', 'Bank name is required'); end if;
    if coalesce(trim(reference), '') !~ '^WIT-[0-9a-fA-F-]{36}$' then return jsonb_build_object('success', false, 'error', 'Invalid withdrawal reference'); end if;

    select * into v_wallet from public.wallets where id=p_wallet_id and owner_id=auth.uid() for update;
    if not found then return jsonb_build_object('success', false, 'error', 'Wallet not found'); end if;
    if v_wallet.type not in ('customer','merchant','agent','rider') then return jsonb_build_object('success', false, 'error', 'This wallet does not support withdrawals'); end if;

    if v_wallet.type <> 'customer' then
        select coalesce(value ->> 'role_wallet_withdrawal_mode','month_end_only') into v_role_wallet_mode
        from public.app_settings where key='wallet_withdrawal_settings' limit 1;
        if v_role_wallet_mode='month_end_only' and v_lagos_today<>v_lagos_month_end then
            return jsonb_build_object('success', false, 'error', 'Operational wallet withdrawals are only available on the last day of the month in Africa/Lagos.');
        end if;
    end if;
    if v_wallet.balance < amount_kobo then return jsonb_build_object('success', false, 'error', 'Insufficient funds'); end if;

    select value into v_settings from public.app_settings where key='wallet_fee_settings';
    v_settings := coalesce(v_settings, '{}'::jsonb);
    v_processor_fee := case when amount_kobo < 1000000 then coalesce((v_settings->>'payout_below_10k_kobo')::bigint,1000)
        when amount_kobo < 5000000 then coalesce((v_settings->>'payout_below_50k_kobo')::bigint,2000)
        else coalesce((v_settings->>'payout_50k_plus_kobo')::bigint,4000) end;
    v_processor_vat := round(v_processor_fee * coalesce((v_settings->>'fee_vat_bps')::integer,750)::numeric / 10000)::bigint;
    v_rss_fee := round(amount_kobo * coalesce((v_settings->>'rss_withdrawal_fee_bps')::integer,0)::numeric / 10000)::bigint;
    v_payout := amount_kobo - v_processor_fee - v_processor_vat - v_rss_fee;
    if v_payout <= 0 then return jsonb_build_object('success', false, 'error', 'Withdrawal amount does not cover transfer fees'); end if;

    update public.wallets set balance=balance-amount_kobo where id=v_wallet.id;
    insert into public.wallet_transactions(wallet_id,amount,type,status,reference,description)
    values(v_wallet.id,amount_kobo,'debit','pending',reference,description) returning id into v_transaction_id;
    insert into public.wallet_withdrawal_requests(reference,user_id,wallet_id,transaction_id,amount_kobo,bank_code,account_number,bank_name,
        processor_fee_kobo,processor_fee_vat_kobo,rss_fee_kobo,payout_amount_kobo,fee_rules)
    values(reference,auth.uid(),v_wallet.id,v_transaction_id,amount_kobo,trim(bank_code),trim(account_number),trim(bank_name),
        v_processor_fee,v_processor_vat,v_rss_fee,v_payout,v_settings);
    return jsonb_build_object('success',true,'reference',reference,'payout_amount_kobo',v_payout,'processor_fee_kobo',v_processor_fee,
        'processor_fee_vat_kobo',v_processor_vat,'rss_fee_kobo',v_rss_fee);
exception when unique_violation then return jsonb_build_object('success',false,'error','Withdrawal reference already exists');
end;
$function$;

create or replace function public.handle_wallet_topup_payment(
    p_reference text,
    p_amount_paid_kobo bigint,
    p_settlement_amount_kobo bigint,
    p_monnify_transaction_reference text default null
)
returns jsonb language plpgsql security definer set search_path=public
as $function$
declare v_request public.wallet_topup_requests%rowtype; v_status text;
begin
    select * into v_request from public.wallet_topup_requests where reference=p_reference for update;
    if not found then return jsonb_build_object('success',false,'error','Wallet top-up request not found'); end if;
    select status into v_status from public.wallet_transactions where id=v_request.transaction_id for update;
    if v_status='success' then return jsonb_build_object('success',true,'idempotent',true); end if;
    if v_status<>'pending' then return jsonb_build_object('success',false,'error','Wallet top-up is not pending'); end if;
    if p_amount_paid_kobo<>v_request.total_charge_kobo then return jsonb_build_object('success',false,'error','Paid amount does not match quoted total'); end if;
    update public.wallet_transactions set status='success' where id=v_request.transaction_id;
    update public.wallets set balance=balance+v_request.wallet_credit_kobo where id=v_request.wallet_id;
    update public.wallet_topup_requests set actual_amount_paid_kobo=p_amount_paid_kobo,
        actual_settlement_kobo=p_settlement_amount_kobo,
        actual_processor_fee_kobo=greatest(p_amount_paid_kobo-p_settlement_amount_kobo,0),
        monnify_transaction_reference=p_monnify_transaction_reference,
        reconciliation_status=case when p_settlement_amount_kobo>=v_request.wallet_credit_kobo+v_request.rss_fee_kobo then 'matched' else 'fee_mismatch' end,
        completed_at=now() where id=v_request.id;
    return jsonb_build_object('success',true,'reconciliation_status',case when p_settlement_amount_kobo>=v_request.wallet_credit_kobo+v_request.rss_fee_kobo then 'matched' else 'fee_mismatch' end);
end;
$function$;

create or replace function public.cancel_pending_wallet_topup(p_reference text)
returns void language plpgsql security definer set search_path=public
as $function$
declare v_transaction_id uuid;
begin
    select transaction_id into v_transaction_id from public.wallet_topup_requests
    where reference=p_reference and user_id=auth.uid() for update;
    if v_transaction_id is null then return; end if;
    if not exists(select 1 from public.wallet_transactions where id=v_transaction_id and status='pending') then return; end if;
    delete from public.wallet_topup_requests where reference=p_reference and user_id=auth.uid();
    delete from public.wallet_transactions where id=v_transaction_id and status='pending';
end;
$function$;

revoke execute on function public.handle_wallet_topup_payment(text,bigint,bigint,text) from public,anon,authenticated;
grant execute on function public.handle_wallet_topup_payment(text,bigint,bigint,text) to service_role;
revoke execute on function public.initiate_wallet_topup(bigint,text) from public,anon;
grant execute on function public.initiate_wallet_topup(bigint,text) to authenticated,service_role;
revoke execute on function public.cancel_pending_wallet_topup(text) from public,anon;
grant execute on function public.cancel_pending_wallet_topup(text) to authenticated,service_role;

create or replace function public.get_wallet_finance_summary()
returns jsonb language plpgsql security definer set search_path=public
as $function$
declare v_result jsonb;
begin
    if not public.jwt_has_role('admin') and not public.jwt_has_role('supa_admin') then raise exception 'Admin access required'; end if;
    select jsonb_build_object(
        'quoted_wallet_credit_kobo',coalesce(sum(wallet_credit_kobo),0),
        'quoted_customer_charges_kobo',coalesce(sum(total_charge_kobo),0),
        'actual_amount_paid_kobo',coalesce(sum(actual_amount_paid_kobo),0),
        'actual_settlement_kobo',coalesce(sum(actual_settlement_kobo),0),
        'actual_provider_fees_kobo',coalesce(sum(actual_processor_fee_kobo),0),
        'fee_mismatch_count',count(*) filter(where reconciliation_status='fee_mismatch'),
        'recent',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from (
            select reference,wallet_credit_kobo,processor_fee_kobo,processor_fee_vat_kobo,rss_fee_kobo,total_charge_kobo,
                actual_amount_paid_kobo,actual_settlement_kobo,actual_processor_fee_kobo,reconciliation_status,created_at,completed_at
            from public.wallet_topup_requests order by created_at desc limit 25
        ) r),'[]'::jsonb)
    ) into v_result from public.wallet_topup_requests;
    return v_result;
end;
$function$;
revoke execute on function public.get_wallet_finance_summary() from public,anon;
grant execute on function public.get_wallet_finance_summary() to authenticated,service_role;

