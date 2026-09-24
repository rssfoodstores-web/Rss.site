-- Keep customer delivery verification secrets out of rider-readable order rows.
create table if not exists public.order_delivery_secrets (
    order_id uuid primary key references public.orders(id) on delete cascade,
    customer_id uuid not null references public.profiles(id) on delete cascade,
    delivery_code text not null check (delivery_code ~ '^[0-9]{4}$'),
    failed_attempts integer not null default 0 check (failed_attempts >= 0),
    locked_until timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.order_delivery_secrets enable row level security;
revoke all on public.order_delivery_secrets from public, anon, authenticated;
grant select on public.order_delivery_secrets to authenticated;

drop policy if exists "Customers can view own delivery secret" on public.order_delivery_secrets;
create policy "Customers can view own delivery secret"
on public.order_delivery_secrets
for select
to authenticated
using (customer_id = auth.uid());

insert into public.order_delivery_secrets (order_id, customer_id, delivery_code)
select id, customer_id, delivery_code
from public.orders
where delivery_code ~ '^[0-9]{4}$'
on conflict (order_id) do update
set customer_id = excluded.customer_id,
    delivery_code = excluded.delivery_code,
    failed_attempts = 0,
    locked_until = null,
    updated_at = now();

update public.orders set delivery_code = null where delivery_code is not null;

create or replace function public.protect_order_delivery_secret()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
    if new.rider_id is null then
        delete from public.order_delivery_secrets where order_id = new.id;
    elsif new.delivery_code is not null then
        insert into public.order_delivery_secrets (order_id, customer_id, delivery_code)
        values (new.id, new.customer_id, new.delivery_code)
        on conflict (order_id) do update
        set customer_id = excluded.customer_id,
            delivery_code = excluded.delivery_code,
            failed_attempts = 0,
            locked_until = null,
            updated_at = now();
    elsif new.rider_id is distinct from old.rider_id then
        insert into public.order_delivery_secrets (order_id, customer_id, delivery_code)
        values (new.id, new.customer_id, lpad((floor(random() * 10000))::text, 4, '0'))
        on conflict (order_id) do update
        set customer_id = excluded.customer_id,
            delivery_code = excluded.delivery_code,
            failed_attempts = 0,
            locked_until = null,
            updated_at = now();
    end if;

    new.delivery_code := null;
    return new;
end;
$function$;

revoke execute on function public.protect_order_delivery_secret() from public, anon, authenticated;

drop trigger if exists protect_order_delivery_secret_before_write on public.orders;
create trigger protect_order_delivery_secret_before_write
before update of rider_id, delivery_code on public.orders
for each row execute function public.protect_order_delivery_secret();


create or replace function public.settle_completed_order(p_order_id uuid, p_delivery_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_order record;
    v_financials record;
    v_actor uuid := auth.uid();
    v_merchant_wallet uuid;
    v_agent_wallet uuid;
    v_rider_wallet uuid;
    v_corporate_wallet record;
    v_corporate_revenue_kobo bigint;
    v_vat_kobo bigint;
begin
    select *
    into v_order
    from public.orders
    where id = p_order_id
    for update;

    if not found then
        return jsonb_build_object('success', false, 'error', 'Order not found');
    end if;

    if v_order.rider_id is distinct from v_actor then
        return jsonb_build_object('success', false, 'error', 'You are not assigned to this order');
    end if;

    if v_order.status not in ('out_for_delivery', 'delivered', 'completed') then
        return jsonb_build_object('success', false, 'error', 'Order is not ready for completion');
    end if;

    if not exists (
        select 1 from public.order_delivery_secrets ods
        where ods.order_id = p_order_id
          and ods.delivery_code = p_delivery_code
          and (ods.locked_until is null or ods.locked_until <= now())
    ) then
        update public.order_delivery_secrets
        set failed_attempts = case
                when locked_until is not null and locked_until <= now() then 1
                else failed_attempts + 1
            end,
            locked_until = case
                when (case when locked_until is not null and locked_until <= now() then 1 else failed_attempts + 1 end) >= 5
                    then now() + interval '15 minutes'
                else null
            end,
            updated_at = now()
        where order_id = p_order_id;
        return jsonb_build_object('success', false, 'error', 'Invalid delivery code');
    end if;

    perform public.refresh_order_financials(p_order_id);

    select *
    into v_financials
    from public.order_financials
    where order_id = p_order_id
    for update;

    if v_financials.settlement_status = 'completed' or v_order.status = 'completed' then
        return jsonb_build_object('success', true, 'message', 'Order already settled');
    end if;

    v_merchant_wallet := public.ensure_actor_wallet(v_order.merchant_id, 'merchant');
    if v_order.assigned_agent_id is not null then
        v_agent_wallet := public.ensure_actor_wallet(v_order.assigned_agent_id, 'agent');
    end if;
    if v_order.rider_id is not null then
        v_rider_wallet := public.ensure_actor_wallet(v_order.rider_id, 'rider');
    end if;

    select *
    into v_corporate_wallet
    from public.corporate_wallets
    where wallet_key = 'rss_primary'
    for update;

    if v_financials.merchant_base_total_kobo > 0 then
        update public.wallets
        set balance = balance + v_financials.merchant_base_total_kobo
        where id = v_merchant_wallet;

        insert into public.ledger_entries (wallet_id, amount, description, reference_id)
        values (v_merchant_wallet, v_financials.merchant_base_total_kobo, 'Merchant payout for order', p_order_id);
    end if;

    if v_agent_wallet is not null and v_financials.agent_fee_total_kobo > 0 then
        update public.wallets
        set balance = balance + v_financials.agent_fee_total_kobo
        where id = v_agent_wallet;

        insert into public.ledger_entries (wallet_id, amount, description, reference_id)
        values (v_agent_wallet, v_financials.agent_fee_total_kobo, 'Agent payout for order', p_order_id);
    end if;

    if v_rider_wallet is not null and v_financials.rider_share_kobo > 0 then
        update public.wallets
        set balance = balance + v_financials.rider_share_kobo
        where id = v_rider_wallet;

        insert into public.ledger_entries (wallet_id, amount, description, reference_id)
        values (v_rider_wallet, v_financials.rider_share_kobo, 'Rider payout for order', p_order_id);
    end if;

    v_corporate_revenue_kobo :=
        v_financials.app_fee_total_kobo
        + v_financials.ops_fee_total_kobo
        + v_financials.insurance_total_kobo
        + v_financials.corporate_delivery_share_kobo;
    v_vat_kobo := v_financials.vat_total_kobo;

    update public.corporate_wallets
    set available_balance_kobo = available_balance_kobo + v_corporate_revenue_kobo,
        locked_balance_kobo = locked_balance_kobo + v_vat_kobo,
        updated_at = now()
    where id = v_corporate_wallet.id;

    insert into public.corporate_ledger_entries (
        corporate_wallet_id,
        category,
        amount_kobo,
        reference_type,
        reference_id,
        description,
        metadata
    ) values
        (
            v_corporate_wallet.id,
            'corporate_revenue',
            v_corporate_revenue_kobo,
            'order',
            p_order_id,
            'Corporate revenue capture for settled order',
            jsonb_build_object('app_fee_kobo', v_financials.app_fee_total_kobo, 'ops_fee_kobo', v_financials.ops_fee_total_kobo, 'insurance_kobo', v_financials.insurance_total_kobo, 'delivery_commission_kobo', v_financials.corporate_delivery_share_kobo)
        ),
        (
            v_corporate_wallet.id,
            'vat_liability',
            v_vat_kobo,
            'order',
            p_order_id,
            'VAT locked for settled order',
            '{}'::jsonb
        );

    insert into public.tax_liabilities (
        order_id,
        taxable_base_kobo,
        vat_amount_kobo,
        vat_bps,
        status,
        metadata
    )
    values (
        p_order_id,
        v_financials.merchant_base_total_kobo,
        v_vat_kobo,
        coalesce((public.get_platform_financial_settings() ->> 'vat_bps')::integer, 750),
        'logged',
        '{}'::jsonb
    )
    on conflict (order_id) do nothing;

    update public.order_financials
    set settlement_status = 'completed',
        settled_at = now(),
        updated_at = now()
    where order_id = p_order_id;

    delete from public.order_delivery_secrets where order_id = p_order_id;

    update public.orders
    set status = 'completed',
        delivery_verified_at = now()
    where id = p_order_id;

    perform public.write_audit_log(v_actor, 'settle_completed_order', 'order', p_order_id, jsonb_build_object('corporate_revenue_kobo', v_corporate_revenue_kobo, 'vat_kobo', v_vat_kobo));

    return jsonb_build_object('success', true, 'order_id', p_order_id);
end;
$$;

revoke execute on function public.settle_completed_order(uuid, text) from public, anon;
grant execute on function public.settle_completed_order(uuid, text) to authenticated, service_role;
