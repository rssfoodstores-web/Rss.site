-- Internal SECURITY DEFINER helpers must not be callable through the Data API.
revoke execute on function public.assign_best_agent(uuid, uuid, public.assignment_method, text) from public, anon, authenticated;
revoke execute on function public.refresh_order_financials(uuid) from public, anon, authenticated;
revoke execute on function public.ensure_actor_wallet(uuid, public.wallet_type) from public, anon, authenticated;
revoke execute on function public.write_audit_log(uuid, text, text, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.create_paid_order_unchecked(uuid, jsonb, jsonb, bigint, jsonb, text, integer) from public, anon, authenticated;
revoke execute on function public.create_paid_order_with_gift_card_unchecked(uuid, jsonb, jsonb, bigint, jsonb, text, integer) from public, anon, authenticated;
revoke execute on function public.create_pending_order_unchecked(uuid, jsonb, jsonb, bigint, jsonb, text, integer) from public, anon, authenticated;
revoke execute on function public.mark_withdrawal_success(text) from public, anon, authenticated;
revoke execute on function public.refund_failed_withdrawal(text, text) from public, anon, authenticated;

grant execute on function public.assign_best_agent(uuid, uuid, public.assignment_method, text) to service_role;
grant execute on function public.refresh_order_financials(uuid) to service_role;
grant execute on function public.ensure_actor_wallet(uuid, public.wallet_type) to service_role;
grant execute on function public.write_audit_log(uuid, text, text, uuid, jsonb) to service_role;
grant execute on function public.create_paid_order_unchecked(uuid, jsonb, jsonb, bigint, jsonb, text, integer) to service_role;
grant execute on function public.create_paid_order_with_gift_card_unchecked(uuid, jsonb, jsonb, bigint, jsonb, text, integer) to service_role;
grant execute on function public.create_pending_order_unchecked(uuid, jsonb, jsonb, bigint, jsonb, text, integer) to service_role;
grant execute on function public.mark_withdrawal_success(text) to service_role;
grant execute on function public.refund_failed_withdrawal(text, text) to service_role;

-- New functions are private until a migration grants the intended role.
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon, authenticated;

create or replace function public.claim_ready_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
    v_order public.orders;
    v_actor uuid := auth.uid();
    v_pickup_code text;
    v_delivery_code text;
begin
    if v_actor is null or not public.jwt_has_role('rider') then
        return jsonb_build_object('success', false, 'error', 'Rider access required');
    end if;

    if not exists (
        select 1
        from public.rider_profiles rp
        where rp.id = v_actor
          and rp.status = 'approved'
    ) then
        return jsonb_build_object('success', false, 'error', 'Approved rider access required');
    end if;

    -- Serialize claims made by the same rider so two simultaneous requests
    -- cannot both pass the active-delivery check.
    perform pg_advisory_xact_lock(hashtextextended(v_actor::text, 0));

    if exists (
        select 1
        from public.orders active_order
        where active_order.rider_id = v_actor
          and active_order.status in ('ready_for_pickup', 'out_for_delivery')
    ) then
        return jsonb_build_object('success', false, 'error', 'Complete or release your active delivery first');
    end if;

    select *
    into v_order
    from public.orders
    where id = p_order_id
    for update;

    if not found then
        return jsonb_build_object('success', false, 'error', 'Order not found');
    end if;

    if v_order.status <> 'ready_for_pickup'
       or v_order.payment_status <> 'paid'
       or v_order.rider_id is not null then
        return jsonb_build_object('success', false, 'error', 'Order is no longer available');
    end if;

    v_pickup_code := coalesce(v_order.pickup_code, lpad((floor(random() * 10000))::text, 4, '0'));
    v_delivery_code := lpad((floor(random() * 10000))::text, 4, '0');

    update public.orders
    set rider_id = v_actor,
        rider_assigned_at = now(),
        assignment_method = coalesce(v_order.assignment_method, 'claim'),
        pickup_code = v_pickup_code,
        delivery_code = v_delivery_code
    where id = p_order_id;

    update public.order_assignments
    set is_active = false,
        updated_at = now()
    where order_id = p_order_id
      and assignment_role = 'rider'
      and is_active = true;

    insert into public.order_assignments (
        order_id, assignment_role, assignee_id, assigned_by,
        method, reason, is_active
    ) values (
        p_order_id, 'rider', v_actor, v_actor,
        'claim', 'Rider claimed ready order', true
    );

    perform public.write_audit_log(v_actor, 'claim_ready_order', 'order', p_order_id, '{}'::jsonb);
    return jsonb_build_object('success', true, 'order_id', p_order_id);
end;
$function$;

revoke execute on function public.claim_ready_order(uuid) from public, anon;
grant execute on function public.claim_ready_order(uuid) to authenticated, service_role;

create table if not exists public.late_order_payments (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references public.orders(id) on delete restrict,
    customer_id uuid not null references public.profiles(id) on delete restrict,
    payment_reference text not null unique,
    amount_kobo bigint not null check (amount_kobo > 0),
    resolution text not null default 'customer_wallet_credit',
    created_at timestamptz not null default now()
);

alter table public.late_order_payments enable row level security;
revoke all on public.late_order_payments from public, anon, authenticated;

create or replace function public.handle_late_order_payment(
    p_order_id uuid,
    p_payment_reference text,
    p_amount_kobo bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
    v_order public.orders;
    v_wallet_id uuid;
    v_late_payment_id uuid;
begin
    select * into v_order
    from public.orders
    where id = p_order_id
    for update;

    if not found then
        return jsonb_build_object('success', false, 'error', 'Order not found');
    end if;

    if v_order.payment_ref is distinct from p_payment_reference
       or v_order.total_amount is distinct from p_amount_kobo then
        return jsonb_build_object('success', false, 'error', 'Late payment does not match order');
    end if;

    if v_order.status not in ('cancelled', 'refunded')
       and v_order.payment_status not in ('failed', 'refunded') then
        return jsonb_build_object('success', false, 'error', 'Order is not cancelled');
    end if;

    insert into public.late_order_payments (
        order_id, customer_id, payment_reference, amount_kobo
    ) values (
        v_order.id, v_order.customer_id, p_payment_reference, p_amount_kobo
    )
    on conflict (payment_reference) do nothing
    returning id into v_late_payment_id;

    if v_late_payment_id is null then
        return jsonb_build_object('success', true, 'message', 'Late payment already credited');
    end if;

    v_wallet_id := public.ensure_actor_wallet(v_order.customer_id, 'customer');

    update public.wallets
    set balance = balance + p_amount_kobo
    where id = v_wallet_id;

    insert into public.wallet_transactions (
        wallet_id, amount, type, status, reference, description
    ) values (
        v_wallet_id,
        p_amount_kobo,
        'credit',
        'success',
        'LATE-' || p_payment_reference,
        'Wallet credit for payment received after order cancellation'
    );

    insert into public.ledger_entries (wallet_id, amount, description, reference_id)
    values (
        v_wallet_id,
        p_amount_kobo,
        'Wallet credit for payment received after order cancellation',
        v_order.id
    );

    insert into public.refunds (
        order_id, amount_kobo, reason, status, processed_at, metadata
    ) values (
        v_order.id,
        p_amount_kobo,
        'Payment received after customer cancelled the order',
        'processed',
        now(),
        jsonb_build_object(
            'resolution', 'customer_wallet_credit',
            'payment_reference', p_payment_reference,
            'late_payment_id', v_late_payment_id
        )
    );

    update public.orders
    set status = 'refunded',
        payment_status = 'refunded'
    where id = v_order.id;

    perform public.write_audit_log(
        null,
        'handle_late_order_payment',
        'order',
        v_order.id,
        jsonb_build_object(
            'payment_reference', p_payment_reference,
            'amount_kobo', p_amount_kobo,
            'resolution', 'customer_wallet_credit'
        )
    );

    return jsonb_build_object(
        'success', true,
        'order_id', v_order.id,
        'resolution', 'customer_wallet_credit'
    );
end;
$function$;

revoke execute on function public.handle_late_order_payment(uuid, text, bigint) from public, anon, authenticated;
grant execute on function public.handle_late_order_payment(uuid, text, bigint) to service_role;
