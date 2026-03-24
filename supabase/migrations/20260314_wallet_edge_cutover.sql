create or replace function public.mark_withdrawal_success(p_reference text)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_tx public.wallet_transactions%rowtype;
begin
    select *
    into v_tx
    from public.wallet_transactions
    where reference = p_reference
      and type = 'debit'
    order by created_at desc
    limit 1
    for update;

    if not found then
        return jsonb_build_object('success', false, 'error', 'Withdrawal transaction not found');
    end if;

    if v_tx.status = 'success' then
        return jsonb_build_object('success', true, 'idempotent', true);
    end if;

    if v_tx.status = 'failed' then
        return jsonb_build_object('success', false, 'error', 'Withdrawal transaction already failed');
    end if;

    update public.wallet_transactions
    set status = 'success'
    where id = v_tx.id;

    return jsonb_build_object('success', true);
end;
$$;

create or replace function public.refund_failed_withdrawal(p_reference text, p_reason text default null)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_tx public.wallet_transactions%rowtype;
    v_reversal_reference text := 'REV-' || p_reference;
begin
    select *
    into v_tx
    from public.wallet_transactions
    where reference = p_reference
      and type = 'debit'
    order by created_at desc
    limit 1
    for update;

    if not found then
        return jsonb_build_object('success', false, 'error', 'Withdrawal transaction not found');
    end if;

    if v_tx.status = 'failed' then
        return jsonb_build_object('success', true, 'idempotent', true);
    end if;

    if v_tx.status = 'success' then
        return jsonb_build_object('success', false, 'error', 'Successful withdrawal cannot be reversed with this function');
    end if;

    update public.wallets
    set balance = balance + v_tx.amount
    where id = v_tx.wallet_id;

    insert into public.wallet_transactions (wallet_id, amount, type, status, reference, description)
    select
        v_tx.wallet_id,
        v_tx.amount,
        'credit',
        'success',
        v_reversal_reference,
        coalesce(p_reason, 'Withdrawal reversal for ' || p_reference)
    where not exists (
        select 1
        from public.wallet_transactions
        where reference = v_reversal_reference
    );

    update public.wallet_transactions
    set status = 'failed',
        description = coalesce(v_tx.description, 'Withdrawal')
            || coalesce(' | ' || nullif(p_reason, ''), '')
    where id = v_tx.id;

    return jsonb_build_object('success', true);
end;
$$;
