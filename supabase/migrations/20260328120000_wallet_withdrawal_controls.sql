insert into public.app_settings (key, value, description)
values (
    'wallet_withdrawal_settings',
    jsonb_build_object('role_wallet_withdrawal_mode', 'month_end_only'),
    'Controls whether operational role wallets can be withdrawn anytime or only on the last day of the month in Africa/Lagos.'
)
on conflict (key) do update
set description = excluded.description;

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
as $$
declare
    v_wallet public.wallets%rowtype;
    v_role_wallet_mode text := 'month_end_only';
    v_lagos_now timestamp without time zone := timezone('Africa/Lagos', now());
    v_lagos_today date := timezone('Africa/Lagos', now())::date;
    v_lagos_month_end date := (date_trunc('month', timezone('Africa/Lagos', now())) + interval '1 month - 1 day')::date;
begin
    if amount_kobo <= 0 then
        return jsonb_build_object('success', false, 'error', 'Invalid amount');
    end if;

    if coalesce(trim(bank_code), '') = '' then
        return jsonb_build_object('success', false, 'error', 'Bank code is required');
    end if;

    if coalesce(trim(account_number), '') = '' then
        return jsonb_build_object('success', false, 'error', 'Account number is required');
    end if;

    if coalesce(trim(reference), '') = '' then
        return jsonb_build_object('success', false, 'error', 'Reference is required');
    end if;

    select *
    into v_wallet
    from public.wallets
    where id = p_wallet_id
      and owner_id = auth.uid()
    for update;

    if not found then
        return jsonb_build_object('success', false, 'error', 'Wallet not found');
    end if;

    if v_wallet.type not in ('customer', 'merchant', 'agent', 'rider') then
        return jsonb_build_object('success', false, 'error', 'This wallet does not support withdrawals');
    end if;

    if v_wallet.type <> 'customer' then
        select coalesce(value ->> 'role_wallet_withdrawal_mode', 'month_end_only')
        into v_role_wallet_mode
        from public.app_settings
        where key = 'wallet_withdrawal_settings'
        limit 1;

        if v_role_wallet_mode not in ('anytime', 'month_end_only') then
            v_role_wallet_mode := 'month_end_only';
        end if;

        if v_role_wallet_mode = 'month_end_only' and v_lagos_today <> v_lagos_month_end then
            return jsonb_build_object(
                'success',
                false,
                'error',
                format(
                    'Operational wallet withdrawals are only available on the last day of the month in Africa/Lagos. Today is %s.',
                    to_char(v_lagos_now, 'FMMonth DD, YYYY')
                )
            );
        end if;
    end if;

    if v_wallet.balance < amount_kobo then
        return jsonb_build_object('success', false, 'error', 'Insufficient funds');
    end if;

    update public.wallets
    set balance = balance - amount_kobo
    where id = v_wallet.id;

    insert into public.wallet_transactions (wallet_id, amount, type, status, reference, description)
    values (
        v_wallet.id,
        amount_kobo,
        'debit',
        'pending',
        reference,
        description
    );

    return jsonb_build_object(
        'success',
        true,
        'wallet_id',
        v_wallet.id,
        'wallet_type',
        v_wallet.type
    );
end;
$$;

create or replace function public.initiate_withdrawal(
    amount_kobo bigint,
    bank_code text,
    account_number text,
    bank_name text,
    reference text,
    description text
)
returns json
language plpgsql
security definer
as $$
declare
    v_customer_wallet_id uuid;
    v_result jsonb;
begin
    select id
    into v_customer_wallet_id
    from public.wallets
    where owner_id = auth.uid()
      and type = 'customer'
    order by created_at asc nulls last
    limit 1;

    if v_customer_wallet_id is null then
        return json_build_object('success', false, 'error', 'Wallet not found');
    end if;

    v_result := public.initiate_wallet_withdrawal(
        v_customer_wallet_id,
        amount_kobo,
        bank_code,
        account_number,
        bank_name,
        reference,
        description
    );

    return v_result::json;
end;
$$;
