alter table public.orders add column payment_last_checked_at timestamptz;

select vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'rss_checkout_reconciliation_token')
where not exists (select 1 from vault.secrets where name = 'rss_checkout_reconciliation_token');

create function public.claim_unpaid_checkout_checks(p_worker_token text)
returns table (order_id uuid, checkout_group_id uuid, payment_reference text, expected_kobo bigint)
language plpgsql
set search_path = ''
as $$
begin
    if p_worker_token is null or not exists (
        select 1 from vault.decrypted_secrets
        where name = 'rss_checkout_reconciliation_token' and decrypted_secret = p_worker_token
    ) then
        raise insufficient_privilege using message = 'Invalid checkout worker credential';
    end if;

    return query
    with candidates as (
        select o.id, g.id as group_id, o.payment_ref, coalesce(g.total_kobo, o.total_amount) as amount
        from public.orders o
        left join public.delivery_checkout_groups g on g.order_ids @> array[o.id]
        where o.status = 'pending' and o.payment_status = 'pending'
          and o.payment_ref like 'ORD-%'
          and o.created_at < now() - interval '5 minutes'
          and (o.payment_last_checked_at is null or o.payment_last_checked_at < now() - interval '5 minutes')
          and (g.id is null or (g.method = 'direct' and not g.payment_processed
              and g.order_ids[1] = o.id and g.payment_reference = o.payment_ref))
        order by o.payment_last_checked_at nulls first, o.created_at, o.id
        limit 12
        for update of o skip locked
    )
    update public.orders o set payment_last_checked_at = now()
    from candidates c where o.id = c.id
    returning o.id, c.group_id, c.payment_ref, c.amount;
end;
$$;
-- Only the service worker can enter, and it must also present the cron credential.
alter function public.claim_unpaid_checkout_checks(text) security definer;
revoke all on function public.claim_unpaid_checkout_checks(text) from public, anon, authenticated;
grant execute on function public.claim_unpaid_checkout_checks(text) to service_role;

create function public.close_verified_unpaid_checkout(p_order_id uuid, p_group_id uuid, p_reference text, p_gateway_status text)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
    v_group public.delivery_checkout_groups;
    v_ids uuid[] := array[p_order_id];
    v_order public.orders;
begin
    if p_reference is null or p_gateway_status is null or p_gateway_status not in ('FAILED', 'EXPIRED') then
        return false;
    end if;

    -- Match the payment webhook's group-then-order lock order.
    if p_group_id is not null then
        select * into v_group from public.delivery_checkout_groups where id = p_group_id for update;
        if not found or v_group.payment_processed or v_group.method <> 'direct'
            or v_group.payment_reference is distinct from p_reference
            or v_group.order_ids[1] is distinct from p_order_id then
            return false;
        end if;
        v_ids := v_group.order_ids;
    elsif exists (select 1 from public.delivery_checkout_groups where order_ids @> array[p_order_id]) then
        return false;
    end if;

    perform id from public.orders where id = any(v_ids) order by id for update;
    if not exists (select 1 from public.orders where id = p_order_id and payment_ref = p_reference) or
        (select count(*) from public.orders where id = any(v_ids)
            and status = 'pending' and payment_status = 'pending') <> cardinality(v_ids) then
        return false;
    end if;

    for v_order in
        update public.orders set status = 'cancelled', payment_status = 'failed'
        where id = any(v_ids) returning *
    loop
        perform public.restore_order_reward_point_redemption(v_order.id);
        perform public.write_audit_log(v_order.customer_id, 'close_unpaid_checkout', 'order',
            v_order.id, jsonb_build_object('gateway_status', p_gateway_status));
    end loop;
    return true;
end;
$$;
revoke all on function public.close_verified_unpaid_checkout(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.close_verified_unpaid_checkout(uuid, uuid, text, text) to service_role;

select cron.schedule('rss-reconcile-unpaid-checkouts', '*/5 * * * *', $job$
    select net.http_post(
        url := 'https://anwsrfzhjbhgskdzxolr.supabase.co/functions/v1/reconcile-unpaid-checkouts',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-checkout-worker-token',
            (select decrypted_secret from vault.decrypted_secrets where name = 'rss_checkout_reconciliation_token')),
        timeout_milliseconds := 55000
    );
$job$);
