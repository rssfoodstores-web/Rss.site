create table if not exists public.wallet_withdrawal_requests (
    id uuid primary key default gen_random_uuid(),
    reference text not null unique,
    user_id uuid not null references auth.users(id) on delete restrict,
    wallet_id uuid not null references public.wallets(id) on delete restrict,
    transaction_id uuid not null unique references public.wallet_transactions(id) on delete restrict,
    amount_kobo bigint not null check (amount_kobo >= 100000),
    bank_code text not null,
    account_number text not null,
    bank_name text not null,
    account_name text,
    status text not null default 'pending_submission' check (status in (
        'pending_submission', 'submitting', 'submitted', 'pending_authorization',
        'submission_unknown', 'success', 'failed', 'reversed'
    )),
    monnify_reference text,
    status_message text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    completed_at timestamptz
);

alter table public.wallet_withdrawal_requests enable row level security;
revoke all on public.wallet_withdrawal_requests from public, anon, authenticated;
grant select on public.wallet_withdrawal_requests to authenticated;

drop policy if exists "Users can view own withdrawal requests" on public.wallet_withdrawal_requests;
create policy "Users can view own withdrawal requests"
on public.wallet_withdrawal_requests for select
to authenticated
using (user_id = auth.uid());

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
    v_role_wallet_mode text := 'month_end_only';
    v_lagos_now timestamp without time zone := timezone('Africa/Lagos', now());
    v_lagos_today date := timezone('Africa/Lagos', now())::date;
    v_lagos_month_end date := (date_trunc('month', timezone('Africa/Lagos', now())) + interval '1 month - 1 day')::date;
begin
    if auth.uid() is null then
        return jsonb_build_object('success', false, 'error', 'Authentication required');
    end if;
    if amount_kobo is null or amount_kobo < 100000 then
        return jsonb_build_object('success', false, 'error', 'Minimum withdrawal is NGN 1,000');
    end if;
    if coalesce(trim(bank_code), '') !~ '^[0-9]{3,10}$' then
        return jsonb_build_object('success', false, 'error', 'Invalid bank code');
    end if;
    if coalesce(trim(account_number), '') !~ '^[0-9]{10}$' then
        return jsonb_build_object('success', false, 'error', 'Account number must contain 10 digits');
    end if;
    if coalesce(trim(bank_name), '') = '' then
        return jsonb_build_object('success', false, 'error', 'Bank name is required');
    end if;
    if coalesce(trim(reference), '') !~ '^WIT-[0-9a-fA-F-]{36}$' then
        return jsonb_build_object('success', false, 'error', 'Invalid withdrawal reference');
    end if;

    select * into v_wallet
    from public.wallets
    where id = p_wallet_id and owner_id = auth.uid()
    for update;

    if not found then
        return jsonb_build_object('success', false, 'error', 'Wallet not found');
    end if;
    if v_wallet.type not in ('customer', 'merchant', 'agent', 'rider') then
        return jsonb_build_object('success', false, 'error', 'This wallet does not support withdrawals');
    end if;

    if v_wallet.type <> 'customer' then
        select coalesce(value ->> 'role_wallet_withdrawal_mode', 'month_end_only')
        into v_role_wallet_mode from public.app_settings
        where key = 'wallet_withdrawal_settings' limit 1;
        if v_role_wallet_mode not in ('anytime', 'month_end_only') then
            v_role_wallet_mode := 'month_end_only';
        end if;
        if v_role_wallet_mode = 'month_end_only' and v_lagos_today <> v_lagos_month_end then
            return jsonb_build_object('success', false, 'error', format(
                'Operational wallet withdrawals are only available on the last day of the month in Africa/Lagos. Today is %s.',
                to_char(v_lagos_now, 'FMMonth DD, YYYY')
            ));
        end if;
    end if;

    if v_wallet.balance < amount_kobo then
        return jsonb_build_object('success', false, 'error', 'Insufficient funds');
    end if;

    update public.wallets set balance = balance - amount_kobo where id = v_wallet.id;
    insert into public.wallet_transactions (wallet_id, amount, type, status, reference, description)
    values (v_wallet.id, amount_kobo, 'debit', 'pending', reference, description)
    returning id into v_transaction_id;

    insert into public.wallet_withdrawal_requests (
        reference, user_id, wallet_id, transaction_id, amount_kobo,
        bank_code, account_number, bank_name
    ) values (
        reference, auth.uid(), v_wallet.id, v_transaction_id, amount_kobo,
        trim(bank_code), trim(account_number), trim(bank_name)
    );

    return jsonb_build_object('success', true, 'reference', reference);
exception
    when unique_violation then
        return jsonb_build_object('success', false, 'error', 'Withdrawal reference already exists');
end;
$function$;

create or replace function public.update_wallet_withdrawal_status(
    p_reference text,
    p_status text,
    p_account_name text default null,
    p_monnify_reference text default null,
    p_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
    v_request public.wallet_withdrawal_requests%rowtype;
    v_final_status text := lower(coalesce(p_status, ''));
begin
    if current_user not in ('service_role', 'postgres') then
        raise exception 'Service role required';
    end if;
    if v_final_status not in ('submitting', 'submitted', 'pending_authorization', 'submission_unknown', 'success', 'failed', 'reversed') then
        raise exception 'Invalid withdrawal status';
    end if;

    select * into v_request
    from public.wallet_withdrawal_requests
    where reference = p_reference
    for update;
    if not found then
        return jsonb_build_object('success', false, 'error', 'Withdrawal request not found');
    end if;

    if v_request.status in ('success', 'failed', 'reversed') then
        return jsonb_build_object('success', true, 'idempotent', true, 'status', v_request.status);
    end if;

    if v_final_status = 'success' then
        update public.wallet_transactions set status = 'success' where id = v_request.transaction_id;
        update public.wallet_withdrawal_requests
        set status = 'success', account_name = coalesce(nullif(p_account_name, ''), account_name),
            monnify_reference = coalesce(nullif(p_monnify_reference, ''), monnify_reference),
            status_message = p_message, updated_at = now(), completed_at = now()
        where id = v_request.id;
    elsif v_final_status in ('failed', 'reversed') then
        update public.wallets set balance = balance + v_request.amount_kobo where id = v_request.wallet_id;
        update public.wallet_transactions set status = 'failed' where id = v_request.transaction_id;
        insert into public.wallet_transactions (wallet_id, amount, type, status, reference, description)
        values (v_request.wallet_id, v_request.amount_kobo, 'credit', 'success',
                'REV-' || v_request.reference, coalesce(p_message, 'Withdrawal reversal'))
        on conflict (reference) do nothing;
        update public.wallet_withdrawal_requests
        set status = v_final_status, account_name = coalesce(nullif(p_account_name, ''), account_name),
            monnify_reference = coalesce(nullif(p_monnify_reference, ''), monnify_reference),
            status_message = p_message, updated_at = now(), completed_at = now()
        where id = v_request.id;
    else
        update public.wallet_withdrawal_requests
        set status = v_final_status, account_name = coalesce(nullif(p_account_name, ''), account_name),
            monnify_reference = coalesce(nullif(p_monnify_reference, ''), monnify_reference),
            status_message = p_message, updated_at = now()
        where id = v_request.id;
    end if;

    return jsonb_build_object('success', true, 'status', v_final_status);
end;
$function$;

revoke execute on function public.initiate_wallet_withdrawal(uuid, bigint, text, text, text, text, text) from public, anon;
grant execute on function public.initiate_wallet_withdrawal(uuid, bigint, text, text, text, text, text) to authenticated, service_role;
revoke execute on function public.update_wallet_withdrawal_status(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.update_wallet_withdrawal_status(text, text, text, text, text) to service_role;

