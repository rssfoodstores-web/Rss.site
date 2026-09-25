create or replace function public.handle_wallet_credit(p_reference text, p_amount_kobo bigint)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
    v_transaction public.wallet_transactions%rowtype;
begin
    if p_reference is null
       or p_reference !~ '^WAL-'
       or p_amount_kobo is null
       or p_amount_kobo <= 0 then
        raise exception 'Invalid wallet top-up details';
    end if;

    select *
    into v_transaction
    from public.wallet_transactions
    where reference = p_reference
    for update;

    if not found then
        raise exception 'Wallet top-up transaction not found';
    end if;

    if v_transaction.type <> 'credit' then
        raise exception 'Wallet transaction is not a credit';
    end if;

    if v_transaction.amount <> p_amount_kobo then
        raise exception 'Wallet top-up amount does not match';
    end if;

    if v_transaction.status = 'success' then
        return;
    end if;

    if v_transaction.status <> 'pending' then
        raise exception 'Wallet top-up is not pending';
    end if;

    update public.wallet_transactions
    set status = 'success'
    where id = v_transaction.id;

    update public.wallets
    set balance = balance + v_transaction.amount
    where id = v_transaction.wallet_id;

    if not found then
        raise exception 'Wallet not found';
    end if;
end;
$function$;

revoke execute on function public.handle_wallet_credit(text, bigint) from public, anon, authenticated;
grant execute on function public.handle_wallet_credit(text, bigint) to service_role;

