-- Addendum foundation: pricing, assignments, settlement, corporate finance, and audit trail.

-- Enums
alter type public.order_status add value if not exists 'awaiting_agent_acceptance';
alter type public.order_status add value if not exists 'awaiting_merchant_confirmation';
alter type public.order_status add value if not exists 'cancelled';
alter type public.order_status add value if not exists 'disputed';
alter type public.order_status add value if not exists 'refunded';

do $$
begin
    if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'payment_status') then
        create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');
    end if;
end $$;

do $$
begin
    if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'assignment_method') then
        create type public.assignment_method as enum ('auto', 'manual', 'override', 'claim');
    end if;
end $$;

do $$
begin
    if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'settlement_status') then
        create type public.settlement_status as enum ('pending', 'completed', 'failed', 'refunded', 'disputed');
    end if;
end $$;

do $$
begin
    if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'price_input_source') then
        create type public.price_input_source as enum ('merchant', 'agent', 'admin');
    end if;
end $$;

do $$
begin
    if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'dispute_status') then
        create type public.dispute_status as enum ('open', 'investigating', 'resolved', 'rejected', 'refunded');
    end if;
end $$;

do $$
begin
    if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'refund_status') then
        create type public.refund_status as enum ('pending', 'approved', 'processed', 'rejected');
    end if;
end $$;

alter type public.wallet_type add value if not exists 'agent';

-- Helper functions
create or replace function public.jwt_roles()
returns text[]
language sql
stable
as $$
    select coalesce(
        array(
            select jsonb_array_elements_text(
                coalesce(auth.jwt() -> 'app_metadata' -> 'roles', '[]'::jsonb)
            )
        ),
        array[]::text[]
    );
$$;

create or replace function public.jwt_has_role(p_role text)
returns boolean
language sql
stable
as $$
    select p_role = any(public.jwt_roles());
$$;

create or replace function public.jwt_has_any_role(p_roles text[])
returns boolean
language sql
stable
as $$
    select exists (
        select 1
        from unnest(public.jwt_roles()) as role_name
        where role_name = any(p_roles)
    );
$$;

create or replace function public.get_my_role()
returns public.app_role
language sql
stable
security definer
as $$
    select
        case
            when public.jwt_has_role('supa_admin') then 'supa_admin'::public.app_role
            when public.jwt_has_role('sub_admin') then 'sub_admin'::public.app_role
            when public.jwt_has_role('admin') then 'admin'::public.app_role
            when public.jwt_has_role('agent') then 'agent'::public.app_role
            when public.jwt_has_role('merchant') then 'merchant'::public.app_role
            when public.jwt_has_role('rider') then 'rider'::public.app_role
            else 'customer'::public.app_role
        end;
$$;

create or replace function public.sync_user_roles()
returns trigger
language plpgsql
security definer
as $$
declare
    v_user_id uuid := coalesce(new.user_id, old.user_id);
    v_roles text[];
    v_primary_role text;
begin
    select coalesce(array_agg(role::text order by created_at asc), array[]::text[])
    into v_roles
    from public.user_roles
    where user_id = v_user_id;

    v_primary_role := coalesce(v_roles[1], 'customer');

    update auth.users
    set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
        || jsonb_build_object('roles', to_jsonb(v_roles))
        || jsonb_build_object('app_role', v_primary_role)
    where id = v_user_id;

    return coalesce(new, old);
end;
$$;

create or replace function public.write_audit_log(
    p_actor_id uuid,
    p_action text,
    p_entity_type text,
    p_entity_id uuid,
    p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
as $$
begin
    insert into public.audit_logs (
        actor_id,
        actor_role,
        action,
        entity_type,
        entity_id,
        metadata
    )
    values (
        p_actor_id,
        coalesce((auth.jwt() -> 'app_metadata' ->> 'app_role'), 'system'),
        p_action,
        p_entity_type,
        p_entity_id,
        coalesce(p_metadata, '{}'::jsonb)
    );
end;
$$;

create or replace function public.ensure_actor_wallet(
    p_owner_id uuid,
    p_wallet_type public.wallet_type
)
returns uuid
language plpgsql
security definer
as $$
declare
    v_wallet_id uuid;
begin
    select id
    into v_wallet_id
    from public.wallets
    where owner_id = p_owner_id
      and type = p_wallet_type
    limit 1;

    if v_wallet_id is null then
        insert into public.wallets (owner_id, type, balance)
        values (p_owner_id, p_wallet_type, 0)
        returning id into v_wallet_id;
    end if;

    return v_wallet_id;
end;
$$;

create or replace function public.compute_display_price_kobo(
    p_merchant_reference_kobo bigint,
    p_agent_fee_bps integer,
    p_app_fee_bps integer,
    p_ops_fee_bps integer,
    p_vat_bps integer,
    p_insurance_kobo bigint default 0
)
returns bigint
language sql
immutable
as $$
    select
        p_merchant_reference_kobo
        + round((p_merchant_reference_kobo * p_agent_fee_bps)::numeric / 10000.0)::bigint
        + round((p_merchant_reference_kobo * p_app_fee_bps)::numeric / 10000.0)::bigint
        + round((p_merchant_reference_kobo * p_ops_fee_bps)::numeric / 10000.0)::bigint
        + round((p_merchant_reference_kobo * p_vat_bps)::numeric / 10000.0)::bigint
        + coalesce(p_insurance_kobo, 0);
$$;

-- Tables and columns
create table if not exists public.product_price_inputs (
    id uuid primary key default uuid_generate_v4(),
    product_id uuid not null references public.products(id) on delete cascade,
    source public.price_input_source not null,
    source_user_id uuid not null references public.profiles(id) on delete cascade,
    amount_kobo bigint not null check (amount_kobo >= 0),
    notes text,
    created_at timestamptz not null default now()
);

create table if not exists public.product_pricing_snapshots (
    id uuid primary key default uuid_generate_v4(),
    product_id uuid not null references public.products(id) on delete cascade,
    merchant_reference_kobo bigint not null check (merchant_reference_kobo >= 0),
    agent_reference_kobo bigint,
    approved_price_kobo bigint not null check (approved_price_kobo >= 0),
    agent_fee_bps integer not null default 200,
    app_fee_bps integer not null default 1000,
    ops_fee_bps integer not null default 200,
    insurance_kobo bigint not null default 0,
    vat_bps integer not null default 750,
    approved_by uuid references public.profiles(id) on delete set null,
    approved_at timestamptz not null default now(),
    is_active boolean not null default true
);

alter table public.products
    add column if not exists active_pricing_id uuid,
    add column if not exists submitted_for_review_at timestamptz default now();

do $$
begin
    if not exists (
        select 1
        from information_schema.table_constraints
        where table_schema = 'public'
          and table_name = 'products'
          and constraint_name = 'products_active_pricing_id_fkey'
    ) then
        alter table public.products
            add constraint products_active_pricing_id_fkey
            foreign key (active_pricing_id) references public.product_pricing_snapshots(id) on delete set null;
    end if;
end $$;

alter table public.orders
    add column if not exists merchant_id uuid references public.profiles(id) on delete set null,
    add column if not exists assigned_agent_id uuid references public.profiles(id) on delete set null,
    add column if not exists payment_status public.payment_status not null default 'pending',
    add column if not exists assignment_method public.assignment_method,
    add column if not exists agent_assigned_at timestamptz,
    add column if not exists agent_accepted_at timestamptz,
    add column if not exists merchant_confirmed_at timestamptz,
    add column if not exists rider_requested_at timestamptz,
    add column if not exists rider_assigned_at timestamptz,
    add column if not exists delivery_fee_kobo bigint not null default 0;

create table if not exists public.order_financials (
    id uuid primary key default uuid_generate_v4(),
    order_id uuid not null unique references public.orders(id) on delete cascade,
    merchant_base_total_kobo bigint not null default 0,
    agent_fee_total_kobo bigint not null default 0,
    app_fee_total_kobo bigint not null default 0,
    ops_fee_total_kobo bigint not null default 0,
    insurance_total_kobo bigint not null default 0,
    vat_total_kobo bigint not null default 0,
    delivery_base_fare_kobo bigint not null default 0,
    delivery_distance_fee_kobo bigint not null default 0,
    delivery_total_kobo bigint not null default 0,
    rider_share_kobo bigint not null default 0,
    corporate_delivery_share_kobo bigint not null default 0,
    grand_total_kobo bigint not null default 0,
    settlement_status public.settlement_status not null default 'pending',
    settled_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.order_item_financials (
    id uuid primary key default uuid_generate_v4(),
    order_item_id uuid not null unique references public.order_items(id) on delete cascade,
    order_id uuid not null references public.orders(id) on delete cascade,
    product_id uuid not null references public.products(id) on delete cascade,
    merchant_id uuid not null references public.profiles(id) on delete cascade,
    merchant_base_unit_kobo bigint not null,
    merchant_base_line_kobo bigint not null,
    agent_fee_line_kobo bigint not null,
    app_fee_line_kobo bigint not null,
    ops_fee_line_kobo bigint not null,
    insurance_line_kobo bigint not null,
    vat_line_kobo bigint not null,
    approved_price_unit_kobo bigint not null,
    approved_price_line_kobo bigint not null,
    created_at timestamptz not null default now()
);

create table if not exists public.order_assignments (
    id uuid primary key default uuid_generate_v4(),
    order_id uuid not null references public.orders(id) on delete cascade,
    assignment_role text not null check (assignment_role in ('agent', 'merchant', 'rider')),
    assignee_id uuid references public.profiles(id) on delete cascade,
    assigned_by uuid references public.profiles(id) on delete set null,
    method public.assignment_method not null default 'auto',
    reason text,
    is_active boolean not null default true,
    accepted_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.corporate_wallets (
    id uuid primary key default uuid_generate_v4(),
    wallet_key text not null unique,
    wallet_name text not null,
    available_balance_kobo bigint not null default 0,
    locked_balance_kobo bigint not null default 0,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.corporate_ledger_entries (
    id uuid primary key default uuid_generate_v4(),
    corporate_wallet_id uuid not null references public.corporate_wallets(id) on delete cascade,
    category text not null,
    amount_kobo bigint not null,
    reference_type text not null,
    reference_id uuid,
    description text not null,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create table if not exists public.tax_liabilities (
    id uuid primary key default uuid_generate_v4(),
    order_id uuid not null unique references public.orders(id) on delete cascade,
    taxable_base_kobo bigint not null default 0,
    vat_amount_kobo bigint not null default 0,
    vat_bps integer not null default 750,
    status text not null default 'logged',
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create table if not exists public.order_disputes (
    id uuid primary key default uuid_generate_v4(),
    order_id uuid not null references public.orders(id) on delete cascade,
    raised_by uuid references public.profiles(id) on delete set null,
    status public.dispute_status not null default 'open',
    reason text not null,
    resolution_notes text,
    resolved_by uuid references public.profiles(id) on delete set null,
    resolved_at timestamptz,
    created_at timestamptz not null default now()
);

create table if not exists public.refunds (
    id uuid primary key default uuid_generate_v4(),
    order_id uuid not null references public.orders(id) on delete cascade,
    amount_kobo bigint not null check (amount_kobo >= 0),
    status public.refund_status not null default 'pending',
    reason text not null,
    processed_by uuid references public.profiles(id) on delete set null,
    processed_at timestamptz,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
    id uuid primary key default uuid_generate_v4(),
    actor_id uuid references public.profiles(id) on delete set null,
    actor_role text not null default 'system',
    action text not null,
    entity_type text not null,
    entity_id uuid,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create unique index if not exists product_pricing_snapshots_one_active_idx
    on public.product_pricing_snapshots(product_id)
    where is_active;

create index if not exists product_price_inputs_product_created_idx
    on public.product_price_inputs(product_id, created_at desc);

create index if not exists order_assignments_order_active_idx
    on public.order_assignments(order_id, is_active);

create index if not exists corporate_ledger_entries_created_category_idx
    on public.corporate_ledger_entries(created_at desc, category);

create index if not exists tax_liabilities_created_status_idx
    on public.tax_liabilities(created_at desc, status);

create index if not exists orders_status_merchant_idx
    on public.orders(status, merchant_id);

create index if not exists orders_status_agent_idx
    on public.orders(status, assigned_agent_id);

create index if not exists orders_status_rider_idx
    on public.orders(status, rider_id);

-- Seed settings
insert into public.app_settings(key, value, description)
values
    (
        'delivery_settings',
        jsonb_build_object(
            'base_fare_kobo', 100000,
            'distance_rate_kobo_per_km', 10000,
            'origin_lat', 6.5244,
            'origin_lng', 3.3792,
            'origin_state', 'Lagos',
            'rider_share_bps', 8000,
            'corporate_delivery_share_bps', 2000
        ),
        'Delivery fee and delivery revenue split settings in kobo/bps.'
    ),
    (
        'platform_financial_settings',
        jsonb_build_object(
            'agent_fee_bps', 200,
            'app_fee_bps', 1000,
            'ops_fee_bps', 200,
            'vat_bps', 750,
            'insurance_default_kobo', 0
        ),
        'Core product pricing settings in basis points and kobo.'
    ),
    (
        'assignment_settings',
        jsonb_build_object(
            'rider_radius_meters', 5000,
            'auto_assignment_strategy', 'balanced_auto'
        ),
        'Operational assignment settings.'
    )
on conflict (key) do update
set value = excluded.value,
    description = excluded.description;

insert into public.corporate_wallets (wallet_key, wallet_name, metadata)
values ('rss_primary', 'RSS Primary Corporate Wallet', jsonb_build_object('seeded_by_migration', true))
on conflict (wallet_key) do nothing;

-- Backfills
update public.orders o
set merchant_id = merchant_source.merchant_id
from (
    select oi.order_id, (array_agg(p.merchant_id))[1] as merchant_id
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    group by oi.order_id
) as merchant_source
where o.id = merchant_source.order_id
  and o.merchant_id is null;

update public.orders
set delivery_fee_kobo = greatest(0, round(coalesce(delivery_fee, 0)::numeric * 100)::bigint)
where delivery_fee_kobo = 0
  and coalesce(delivery_fee, 0) <> 0;

with existing_products as (
    select
        p.id as product_id,
        p.merchant_id,
        greatest(0, floor((p.price::numeric) / 1.215))::bigint as derived_merchant_reference_kobo,
        p.price as approved_price_kobo
    from public.products p
    where not exists (
        select 1
        from public.product_pricing_snapshots s
        where s.product_id = p.id
    )
),
inserted_inputs as (
    insert into public.product_price_inputs (
        product_id,
        source,
        source_user_id,
        amount_kobo,
        notes
    )
    select
        ep.product_id,
        'merchant'::public.price_input_source,
        ep.merchant_id,
        ep.derived_merchant_reference_kobo,
        'Backfilled from legacy product price during addendum migration.'
    from existing_products ep
    returning product_id
),
inserted_snapshots as (
    insert into public.product_pricing_snapshots (
        product_id,
        merchant_reference_kobo,
        approved_price_kobo,
        approved_by,
        approved_at,
        is_active
    )
    select
        ep.product_id,
        ep.derived_merchant_reference_kobo,
        ep.approved_price_kobo,
        null,
        now(),
        true
    from existing_products ep
    returning id, product_id
)
update public.products p
set active_pricing_id = s.id
from inserted_snapshots s
where p.id = s.product_id
  and p.active_pricing_id is null;

-- Settings accessors
create or replace function public.get_platform_financial_settings()
returns jsonb
language sql
stable
as $$
    select coalesce(
        (select value from public.app_settings where key = 'platform_financial_settings'),
        jsonb_build_object(
            'agent_fee_bps', 200,
            'app_fee_bps', 1000,
            'ops_fee_bps', 200,
            'vat_bps', 750,
            'insurance_default_kobo', 0
        )
    );
$$;

create or replace function public.get_delivery_settings()
returns jsonb
language sql
stable
as $$
    select coalesce(
        (select value from public.app_settings where key = 'delivery_settings'),
        jsonb_build_object(
            'base_fare_kobo', 100000,
            'distance_rate_kobo_per_km', 10000,
            'origin_lat', 6.5244,
            'origin_lng', 3.3792,
            'origin_state', 'Lagos',
            'rider_share_bps', 8000,
            'corporate_delivery_share_bps', 2000
        )
    );
$$;

create or replace function public.assign_best_agent(
    p_order_id uuid,
    p_assigned_by uuid default null,
    p_method public.assignment_method default 'auto',
    p_reason text default null
)
returns uuid
language plpgsql
security definer
as $$
declare
    v_agent_id uuid;
begin
    select ap.id
    into v_agent_id
    from public.agent_profiles ap
    join public.user_roles ur
      on ur.user_id = ap.id
     and ur.role = 'agent'
    left join lateral (
        select count(*)::integer as active_orders
        from public.orders o
        where o.assigned_agent_id = ap.id
          and o.status in (
              'awaiting_agent_acceptance',
              'awaiting_merchant_confirmation',
              'processing',
              'ready_for_pickup',
              'out_for_delivery'
          )
    ) load on true
    where ap.status = 'approved'
    order by coalesce(load.active_orders, 0) asc, ap.created_at asc
    limit 1;

    if v_agent_id is not null then
        update public.orders
        set assigned_agent_id = v_agent_id,
            assignment_method = p_method,
            agent_assigned_at = now()
        where id = p_order_id;

        update public.order_assignments
        set is_active = false,
            updated_at = now()
        where order_id = p_order_id
          and assignment_role = 'agent'
          and is_active = true;

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
            p_order_id,
            'agent',
            v_agent_id,
            p_assigned_by,
            p_method,
            p_reason,
            true
        );
    end if;

    return v_agent_id;
end;
$$;

create or replace function public.refresh_order_financials(p_order_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_order record;
    v_item record;
    v_delivery jsonb;
    v_platform jsonb;
    v_rider_share_bps integer;
    v_delivery_total_kobo bigint;
    v_rider_share_kobo bigint;
    v_corporate_delivery_share_kobo bigint;
    v_delivery_base_kobo bigint;
    v_delivery_distance_kobo bigint;
    v_merchant_total bigint := 0;
    v_agent_total bigint := 0;
    v_app_total bigint := 0;
    v_ops_total bigint := 0;
    v_insurance_total bigint := 0;
    v_vat_total bigint := 0;
    v_grand_total bigint := 0;
    v_snapshot record;
    v_base_unit bigint;
    v_agent_unit bigint;
    v_app_unit bigint;
    v_ops_unit bigint;
    v_insurance_unit bigint;
    v_vat_unit bigint;
    v_approved_unit bigint;
    v_delta bigint;
begin
    select *
    into v_order
    from public.orders
    where id = p_order_id
    for update;

    if not found then
        return jsonb_build_object('success', false, 'error', 'Order not found');
    end if;

    v_platform := public.get_platform_financial_settings();
    v_delivery := public.get_delivery_settings();

    delete from public.order_item_financials where order_id = p_order_id;

    for v_item in
        select
            oi.id as order_item_id,
            oi.order_id,
            oi.product_id,
            oi.quantity,
            oi.price_per_unit,
            p.merchant_id,
            p.active_pricing_id
        from public.order_items oi
        join public.products p on p.id = oi.product_id
        where oi.order_id = p_order_id
    loop
        select *
        into v_snapshot
        from public.product_pricing_snapshots
        where id = coalesce(v_item.active_pricing_id, (
            select active_pricing_id from public.products where id = v_item.product_id
        ));

        v_base_unit := coalesce(v_snapshot.merchant_reference_kobo, v_item.price_per_unit);
        v_approved_unit := greatest(v_item.price_per_unit, coalesce(v_snapshot.approved_price_kobo, v_item.price_per_unit));
        v_agent_unit := round((v_base_unit * coalesce(v_snapshot.agent_fee_bps, (v_platform ->> 'agent_fee_bps')::integer))::numeric / 10000.0)::bigint;
        v_app_unit := round((v_base_unit * coalesce(v_snapshot.app_fee_bps, (v_platform ->> 'app_fee_bps')::integer))::numeric / 10000.0)::bigint;
        v_ops_unit := round((v_base_unit * coalesce(v_snapshot.ops_fee_bps, (v_platform ->> 'ops_fee_bps')::integer))::numeric / 10000.0)::bigint;
        v_insurance_unit := coalesce(v_snapshot.insurance_kobo, (v_platform ->> 'insurance_default_kobo')::bigint, 0);
        v_vat_unit := round((v_base_unit * coalesce(v_snapshot.vat_bps, (v_platform ->> 'vat_bps')::integer))::numeric / 10000.0)::bigint;
        v_delta := v_approved_unit - (v_base_unit + v_agent_unit + v_app_unit + v_ops_unit + v_insurance_unit + v_vat_unit);
        v_app_unit := greatest(0, v_app_unit + v_delta);

        insert into public.order_item_financials (
            order_item_id,
            order_id,
            product_id,
            merchant_id,
            merchant_base_unit_kobo,
            merchant_base_line_kobo,
            agent_fee_line_kobo,
            app_fee_line_kobo,
            ops_fee_line_kobo,
            insurance_line_kobo,
            vat_line_kobo,
            approved_price_unit_kobo,
            approved_price_line_kobo
        )
        values (
            v_item.order_item_id,
            p_order_id,
            v_item.product_id,
            v_item.merchant_id,
            v_base_unit,
            v_base_unit * v_item.quantity,
            v_agent_unit * v_item.quantity,
            v_app_unit * v_item.quantity,
            v_ops_unit * v_item.quantity,
            v_insurance_unit * v_item.quantity,
            v_vat_unit * v_item.quantity,
            v_approved_unit,
            v_approved_unit * v_item.quantity
        );

        v_merchant_total := v_merchant_total + (v_base_unit * v_item.quantity);
        v_agent_total := v_agent_total + (v_agent_unit * v_item.quantity);
        v_app_total := v_app_total + (v_app_unit * v_item.quantity);
        v_ops_total := v_ops_total + (v_ops_unit * v_item.quantity);
        v_insurance_total := v_insurance_total + (v_insurance_unit * v_item.quantity);
        v_vat_total := v_vat_total + (v_vat_unit * v_item.quantity);
        v_grand_total := v_grand_total + (v_approved_unit * v_item.quantity);
    end loop;

    v_delivery_total_kobo := coalesce(v_order.delivery_fee_kobo, 0);
    v_delivery_base_kobo := least(coalesce((v_delivery ->> 'base_fare_kobo')::bigint, 0), v_delivery_total_kobo);
    v_delivery_distance_kobo := greatest(v_delivery_total_kobo - v_delivery_base_kobo, 0);
    v_rider_share_bps := coalesce((v_delivery ->> 'rider_share_bps')::integer, 8000);

    v_rider_share_kobo := round((v_delivery_total_kobo * v_rider_share_bps)::numeric / 10000.0)::bigint;
    v_corporate_delivery_share_kobo := greatest(v_delivery_total_kobo - v_rider_share_kobo, 0);
    v_grand_total := v_grand_total + v_delivery_total_kobo;

    insert into public.order_financials (
        order_id,
        merchant_base_total_kobo,
        agent_fee_total_kobo,
        app_fee_total_kobo,
        ops_fee_total_kobo,
        insurance_total_kobo,
        vat_total_kobo,
        delivery_base_fare_kobo,
        delivery_distance_fee_kobo,
        delivery_total_kobo,
        rider_share_kobo,
        corporate_delivery_share_kobo,
        grand_total_kobo,
        settlement_status,
        updated_at
    )
    values (
        p_order_id,
        v_merchant_total,
        v_agent_total,
        v_app_total,
        v_ops_total,
        v_insurance_total,
        v_vat_total,
        v_delivery_base_kobo,
        v_delivery_distance_kobo,
        v_delivery_total_kobo,
        v_rider_share_kobo,
        v_corporate_delivery_share_kobo,
        v_grand_total,
        'pending',
        now()
    )
    on conflict (order_id) do update
    set merchant_base_total_kobo = excluded.merchant_base_total_kobo,
        agent_fee_total_kobo = excluded.agent_fee_total_kobo,
        app_fee_total_kobo = excluded.app_fee_total_kobo,
        ops_fee_total_kobo = excluded.ops_fee_total_kobo,
        insurance_total_kobo = excluded.insurance_total_kobo,
        vat_total_kobo = excluded.vat_total_kobo,
        delivery_base_fare_kobo = excluded.delivery_base_fare_kobo,
        delivery_distance_fee_kobo = excluded.delivery_distance_fee_kobo,
        delivery_total_kobo = excluded.delivery_total_kobo,
        rider_share_kobo = excluded.rider_share_kobo,
        corporate_delivery_share_kobo = excluded.corporate_delivery_share_kobo,
        grand_total_kobo = excluded.grand_total_kobo,
        updated_at = now();

    return jsonb_build_object('success', true, 'order_id', p_order_id);
end;
$$;

create or replace function public.create_paid_order(
    p_user_id uuid,
    p_items jsonb,
    p_delivery_location jsonb,
    p_delivery_fee_kobo bigint default 0,
    p_contact_numbers jsonb default '[]'::jsonb,
    p_payment_reference text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_wallet_id uuid;
    v_wallet_balance bigint;
    v_order_id uuid;
    v_item record;
    v_product record;
    v_merchant_id uuid;
    v_total_kobo bigint := 0;
    v_payment_reference text := coalesce(p_payment_reference, 'WAL-' || encode(gen_random_bytes(8), 'hex'));
begin
    if p_user_id is null then
        return jsonb_build_object('success', false, 'error', 'Missing user');
    end if;

    if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
        return jsonb_build_object('success', false, 'error', 'Cart is empty');
    end if;

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
        select p.id, p.name, p.price, p.stock_level, p.merchant_id
        into v_product
        from public.products p
        where p.id = v_item.product_id
          and p.status = 'approved';

        if v_product.id is null then
            return jsonb_build_object('success', false, 'error', 'Product not found or not approved');
        end if;

        if coalesce(v_product.stock_level, 0) < v_item.quantity then
            return jsonb_build_object('success', false, 'error', 'Insufficient stock for ' || v_product.name);
        end if;

        if v_merchant_id is null then
            v_merchant_id := v_product.merchant_id;
        elsif v_merchant_id <> v_product.merchant_id then
            return jsonb_build_object('success', false, 'error', 'Mixed merchant carts are not allowed');
        end if;

        v_total_kobo := v_total_kobo + (v_product.price * v_item.quantity);
    end loop;

    v_total_kobo := v_total_kobo + greatest(coalesce(p_delivery_fee_kobo, 0), 0);

    if coalesce(v_wallet_balance, 0) < v_total_kobo then
        return jsonb_build_object('success', false, 'error', 'Insufficient wallet balance');
    end if;

    insert into public.orders (
        customer_id,
        merchant_id,
        total_amount,
        status,
        payment_status,
        delivery_location,
        payment_ref,
        delivery_fee_kobo,
        delivery_fee,
        contact_numbers
    )
    values (
        p_user_id,
        v_merchant_id,
        v_total_kobo,
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
    )
    returning id into v_order_id;

    for v_item in
        select *
        from jsonb_to_recordset(p_items) as item(product_id uuid, quantity integer)
    loop
        select p.id, p.price
        into v_product
        from public.products p
        where p.id = v_item.product_id
        for update;

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

        update public.products
        set stock_level = greatest(coalesce(stock_level, 0) - v_item.quantity, 0)
        where id = v_item.product_id;
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
    perform public.assign_best_agent(v_order_id, p_user_id, 'auto', 'System auto assignment after paid order creation');

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
        jsonb_build_object('payment_reference', v_payment_reference, 'merchant_id', v_merchant_id)
    );

    return jsonb_build_object('success', true, 'order_id', v_order_id, 'payment_reference', v_payment_reference);
end;
$$;

create or replace function public.mark_direct_payment_success(
    p_order_id uuid,
    p_payment_reference text
)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_order record;
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
        return jsonb_build_object('success', true, 'message', 'Order already marked paid');
    end if;

    update public.orders
    set payment_status = 'paid',
        status = 'awaiting_agent_acceptance',
        payment_ref = p_payment_reference
    where id = p_order_id;

    perform public.refresh_order_financials(p_order_id);
    perform public.assign_best_agent(p_order_id, null, 'auto', 'System auto assignment after direct payment confirmation');
    perform public.write_audit_log(null, 'mark_direct_payment_success', 'order', p_order_id, jsonb_build_object('payment_reference', p_payment_reference));

    return jsonb_build_object('success', true, 'order_id', p_order_id);
end;
$$;

create or replace function public.accept_agent_assignment(p_order_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_order record;
    v_actor uuid := auth.uid();
begin
    select *
    into v_order
    from public.orders
    where id = p_order_id
    for update;

    if not found then
        return jsonb_build_object('success', false, 'error', 'Order not found');
    end if;

    if v_order.assigned_agent_id is distinct from v_actor then
        return jsonb_build_object('success', false, 'error', 'You are not assigned to this order');
    end if;

    if v_order.status <> 'awaiting_agent_acceptance' then
        return jsonb_build_object('success', false, 'error', 'Order is not awaiting agent acceptance');
    end if;

    update public.orders
    set status = 'awaiting_merchant_confirmation',
        agent_accepted_at = now()
    where id = p_order_id;

    update public.order_assignments
    set accepted_at = now(),
        updated_at = now()
    where order_id = p_order_id
      and assignment_role = 'agent'
      and assignee_id = v_actor
      and is_active = true;

    perform public.write_audit_log(v_actor, 'accept_agent_assignment', 'order', p_order_id, '{}'::jsonb);

    return jsonb_build_object('success', true, 'order_id', p_order_id);
end;
$$;

create or replace function public.confirm_merchant_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_order record;
    v_actor uuid := auth.uid();
begin
    select *
    into v_order
    from public.orders
    where id = p_order_id
    for update;

    if not found then
        return jsonb_build_object('success', false, 'error', 'Order not found');
    end if;

    if v_order.merchant_id is distinct from v_actor then
        return jsonb_build_object('success', false, 'error', 'You do not own this order');
    end if;

    if v_order.status not in ('awaiting_merchant_confirmation', 'processing') then
        return jsonb_build_object('success', false, 'error', 'Order is not awaiting merchant confirmation');
    end if;

    update public.orders
    set status = 'processing',
        merchant_confirmed_at = coalesce(merchant_confirmed_at, now())
    where id = p_order_id;

    perform public.write_audit_log(v_actor, 'confirm_merchant_order', 'order', p_order_id, '{}'::jsonb);

    return jsonb_build_object('success', true, 'order_id', p_order_id);
end;
$$;

create or replace function public.request_rider_for_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_order record;
    v_actor uuid := auth.uid();
begin
    select *
    into v_order
    from public.orders
    where id = p_order_id
    for update;

    if not found then
        return jsonb_build_object('success', false, 'error', 'Order not found');
    end if;

    if not (
        v_order.merchant_id = v_actor
        or v_order.assigned_agent_id = v_actor
        or public.jwt_has_any_role(array['admin', 'sub_admin', 'supa_admin'])
    ) then
        return jsonb_build_object('success', false, 'error', 'You cannot request a rider for this order');
    end if;

    if v_order.status <> 'processing' then
        return jsonb_build_object('success', false, 'error', 'Order is not ready for rider dispatch');
    end if;

    update public.orders
    set status = 'ready_for_pickup',
        rider_requested_at = now()
    where id = p_order_id;

    perform public.write_audit_log(v_actor, 'request_rider_for_order', 'order', p_order_id, '{}'::jsonb);

    return jsonb_build_object('success', true, 'order_id', p_order_id);
end;
$$;

create or replace function public.claim_ready_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_order record;
    v_actor uuid := auth.uid();
    v_pickup_code text;
    v_delivery_code text;
begin
    select *
    into v_order
    from public.orders
    where id = p_order_id
    for update;

    if not found then
        return jsonb_build_object('success', false, 'error', 'Order not found');
    end if;

    if v_order.status <> 'ready_for_pickup' or v_order.rider_id is not null then
        return jsonb_build_object('success', false, 'error', 'Order is no longer available');
    end if;

    if not public.jwt_has_role('rider') then
        return jsonb_build_object('success', false, 'error', 'Rider access required');
    end if;

    v_pickup_code := coalesce(v_order.pickup_code, lpad((floor(random() * 10000))::text, 4, '0'));
    v_delivery_code := coalesce(v_order.delivery_code, lpad((floor(random() * 10000))::text, 4, '0'));

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
        order_id,
        assignment_role,
        assignee_id,
        assigned_by,
        method,
        reason,
        is_active
    )
    values (
        p_order_id,
        'rider',
        v_actor,
        v_actor,
        'claim',
        'Rider claimed ready order',
        true
    );

    perform public.write_audit_log(v_actor, 'claim_ready_order', 'order', p_order_id, '{}'::jsonb);

    return jsonb_build_object('success', true, 'order_id', p_order_id);
end;
$$;

create or replace function public.verify_pickup(p_order_id uuid, p_pickup_code text)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_order record;
    v_actor uuid := auth.uid();
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

    if v_order.status <> 'ready_for_pickup' then
        return jsonb_build_object('success', false, 'error', 'Order is not ready for pickup verification');
    end if;

    if v_order.pickup_code is distinct from p_pickup_code then
        return jsonb_build_object('success', false, 'error', 'Invalid pickup code');
    end if;

    update public.orders
    set status = 'out_for_delivery',
        pickup_verified_at = now()
    where id = p_order_id;

    perform public.write_audit_log(v_actor, 'verify_pickup', 'order', p_order_id, '{}'::jsonb);

    return jsonb_build_object('success', true, 'order_id', p_order_id);
end;
$$;

create or replace function public.settle_completed_order(p_order_id uuid, p_delivery_code text)
returns jsonb
language plpgsql
security definer
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

    if v_order.delivery_code is distinct from p_delivery_code then
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

    update public.orders
    set status = 'completed',
        delivery_verified_at = now()
    where id = p_order_id;

    perform public.write_audit_log(v_actor, 'settle_completed_order', 'order', p_order_id, jsonb_build_object('corporate_revenue_kobo', v_corporate_revenue_kobo, 'vat_kobo', v_vat_kobo));

    return jsonb_build_object('success', true, 'order_id', p_order_id);
end;
$$;

create or replace function public.override_order_assignment(
    p_order_id uuid,
    p_assignment_role text,
    p_new_assignee_id uuid,
    p_reason text
)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_actor uuid := auth.uid();
begin
    if not public.jwt_has_any_role(array['admin', 'sub_admin', 'supa_admin']) then
        return jsonb_build_object('success', false, 'error', 'Admin access required');
    end if;

    update public.order_assignments
    set is_active = false,
        updated_at = now()
    where order_id = p_order_id
      and assignment_role = p_assignment_role
      and is_active = true;

    if p_assignment_role = 'agent' then
        update public.orders
        set assigned_agent_id = p_new_assignee_id,
            assignment_method = 'override',
            agent_assigned_at = now(),
            agent_accepted_at = null,
            status = 'awaiting_agent_acceptance'
        where id = p_order_id;
    elsif p_assignment_role = 'rider' then
        update public.orders
        set rider_id = p_new_assignee_id,
            rider_assigned_at = now(),
            assignment_method = 'override'
        where id = p_order_id;
    elsif p_assignment_role = 'merchant' then
        update public.orders
        set merchant_id = p_new_assignee_id,
            assignment_method = 'override'
        where id = p_order_id;
    else
        return jsonb_build_object('success', false, 'error', 'Unsupported assignment role');
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
        p_order_id,
        p_assignment_role,
        p_new_assignee_id,
        v_actor,
        'override',
        p_reason,
        true
    );

    perform public.write_audit_log(v_actor, 'override_order_assignment', 'order', p_order_id, jsonb_build_object('assignment_role', p_assignment_role, 'new_assignee_id', p_new_assignee_id, 'reason', p_reason));

    return jsonb_build_object('success', true, 'order_id', p_order_id);
end;
$$;

create or replace function public.open_order_dispute(
    p_order_id uuid,
    p_reason text
)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_actor uuid := auth.uid();
    v_dispute_id uuid;
begin
    insert into public.order_disputes (order_id, raised_by, reason)
    values (p_order_id, v_actor, p_reason)
    returning id into v_dispute_id;

    update public.orders
    set status = 'disputed'
    where id = p_order_id
      and status <> 'completed';

    update public.order_financials
    set settlement_status = 'disputed',
        updated_at = now()
    where order_id = p_order_id;

    perform public.write_audit_log(v_actor, 'open_order_dispute', 'order', p_order_id, jsonb_build_object('dispute_id', v_dispute_id, 'reason', p_reason));

    return jsonb_build_object('success', true, 'dispute_id', v_dispute_id);
end;
$$;

create or replace function public.resolve_order_dispute(
    p_dispute_id uuid,
    p_status public.dispute_status,
    p_resolution_notes text
)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_actor uuid := auth.uid();
    v_dispute record;
begin
    if not public.jwt_has_any_role(array['admin', 'sub_admin', 'supa_admin']) then
        return jsonb_build_object('success', false, 'error', 'Admin access required');
    end if;

    update public.order_disputes
    set status = p_status,
        resolution_notes = p_resolution_notes,
        resolved_by = v_actor,
        resolved_at = now()
    where id = p_dispute_id
    returning * into v_dispute;

    if not found then
        return jsonb_build_object('success', false, 'error', 'Dispute not found');
    end if;

    perform public.write_audit_log(v_actor, 'resolve_order_dispute', 'order_dispute', p_dispute_id, jsonb_build_object('status', p_status, 'order_id', v_dispute.order_id));

    return jsonb_build_object('success', true, 'order_id', v_dispute.order_id);
end;
$$;

create or replace function public.create_refund(
    p_order_id uuid,
    p_amount_kobo bigint,
    p_reason text
)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_actor uuid := auth.uid();
    v_refund_id uuid;
begin
    if not public.jwt_has_any_role(array['admin', 'sub_admin', 'supa_admin']) then
        return jsonb_build_object('success', false, 'error', 'Admin access required');
    end if;

    insert into public.refunds (order_id, amount_kobo, reason, status)
    values (p_order_id, p_amount_kobo, p_reason, 'approved')
    returning id into v_refund_id;

    perform public.write_audit_log(v_actor, 'create_refund', 'refund', v_refund_id, jsonb_build_object('order_id', p_order_id, 'amount_kobo', p_amount_kobo));

    return jsonb_build_object('success', true, 'refund_id', v_refund_id);
end;
$$;

create or replace function public.process_refund(p_refund_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_actor uuid := auth.uid();
    v_refund record;
    v_order record;
    v_corporate_wallet record;
    v_customer_wallet uuid;
begin
    if not public.jwt_has_any_role(array['admin', 'sub_admin', 'supa_admin']) then
        return jsonb_build_object('success', false, 'error', 'Admin access required');
    end if;

    select *
    into v_refund
    from public.refunds
    where id = p_refund_id
    for update;

    if not found then
        return jsonb_build_object('success', false, 'error', 'Refund not found');
    end if;

    if v_refund.status = 'processed' then
        return jsonb_build_object('success', true, 'message', 'Refund already processed');
    end if;

    select *
    into v_order
    from public.orders
    where id = v_refund.order_id
    for update;

    select *
    into v_corporate_wallet
    from public.corporate_wallets
    where wallet_key = 'rss_primary'
    for update;

    if v_corporate_wallet.available_balance_kobo < v_refund.amount_kobo then
        return jsonb_build_object('success', false, 'error', 'Insufficient corporate balance');
    end if;

    v_customer_wallet := public.ensure_actor_wallet(v_order.customer_id, 'customer');

    update public.corporate_wallets
    set available_balance_kobo = available_balance_kobo - v_refund.amount_kobo,
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
    )
    values (
        v_corporate_wallet.id,
        'refund',
        -v_refund.amount_kobo,
        'refund',
        v_refund.id,
        'Corporate refund processed',
        jsonb_build_object('order_id', v_refund.order_id)
    );

    update public.wallets
    set balance = balance + v_refund.amount_kobo
    where id = v_customer_wallet;

    insert into public.ledger_entries (wallet_id, amount, description, reference_id)
    values (v_customer_wallet, v_refund.amount_kobo, 'Customer refund credit', v_refund.order_id);

    update public.refunds
    set status = 'processed',
        processed_by = v_actor,
        processed_at = now()
    where id = p_refund_id;

    update public.orders
    set status = 'refunded',
        payment_status = 'refunded'
    where id = v_refund.order_id;

    update public.order_financials
    set settlement_status = 'refunded',
        updated_at = now()
    where order_id = v_refund.order_id;

    perform public.write_audit_log(v_actor, 'process_refund', 'refund', p_refund_id, jsonb_build_object('order_id', v_refund.order_id, 'amount_kobo', v_refund.amount_kobo));

    return jsonb_build_object('success', true, 'order_id', v_refund.order_id);
end;
$$;

-- Compatibility wrappers
create or replace function public.process_wallet_order(
    p_user_id uuid,
    p_total_kobo bigint,
    p_items jsonb,
    p_delivery_location jsonb,
    p_delivery_fee numeric default 0,
    p_contact_numbers jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
as $$
begin
    return public.create_paid_order(
        p_user_id,
        p_items,
        p_delivery_location,
        greatest(round(coalesce(p_delivery_fee, 0)::numeric * 100), 0)::bigint,
        p_contact_numbers,
        null
    );
end;
$$;

create or replace function public.complete_order_payout(p_order_id uuid)
returns jsonb
language plpgsql
security definer
as $$
begin
    return jsonb_build_object('success', false, 'error', 'Use settle_completed_order with delivery OTP');
end;
$$;

create or replace function public.fetch_nearby_orders(
    lat double precision,
    long double precision,
    radius_meters double precision
)
returns table(
    id uuid,
    total_amount numeric,
    status text,
    created_at timestamptz,
    merchant_name text,
    merchant_address text,
    merchant_location geography,
    delivery_location jsonb
)
language plpgsql
security definer
as $$
begin
    return query
    select distinct
        o.id,
        (o.total_amount::numeric / 100.0) as total_amount,
        o.status::text,
        o.created_at,
        coalesce(m.store_name, p.full_name, 'RSS Fulfillment')::text,
        coalesce(m.business_address, p.address, 'Location hidden')::text,
        m.location,
        ST_AsGeoJSON(o.delivery_location)::jsonb
    from public.orders o
    join public.profiles p on p.id = o.merchant_id
    left join public.merchants m on m.id = o.merchant_id
    where o.status = 'ready_for_pickup'
      and o.rider_id is null
      and (
          m.location is null
          or ST_DWithin(
              m.location,
              ST_SetSRID(ST_MakePoint(long, lat), 4326),
              radius_meters
          )
      )
    order by o.created_at desc;
end;
$$;

-- Policies cleanup and new policies
drop policy if exists "Admins can update products" on public.products;
create policy "Admins can update products"
on public.products
for update
using (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']))
with check (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']));

drop policy if exists "Admins can view all merchants" on public.merchants;
create policy "Admins can view all merchants"
on public.merchants
for select
using (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']));

drop policy if exists "Admins can view all rider profiles" on public.rider_profiles;
create policy "Admins can view all rider profiles"
on public.rider_profiles
for select
using (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']));

drop policy if exists "Admins can view all roles" on public.user_roles;
create policy "Admins can view all roles"
on public.user_roles
for select
using (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']));

create policy "Admins can manage rider profiles"
on public.rider_profiles
for update
using (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']))
with check (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']));

create policy "Admins can view all orders"
on public.orders
for select
using (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']));

create policy "Agents can view assigned orders"
on public.orders
for select
using (assigned_agent_id = auth.uid() and public.jwt_has_role('agent'));

create policy "Admins can view product price inputs"
on public.product_price_inputs
for select
using (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']));

create policy "Merchants can view own product price inputs"
on public.product_price_inputs
for select
using (
    exists (
        select 1
        from public.products p
        where p.id = product_price_inputs.product_id
          and p.merchant_id = auth.uid()
    )
);

create policy "Agents can view own product price inputs"
on public.product_price_inputs
for select
using (source_user_id = auth.uid() and public.jwt_has_role('agent'));

create policy "Merchants can submit merchant price inputs"
on public.product_price_inputs
for insert
with check (
    source = 'merchant'
    and source_user_id = auth.uid()
    and exists (
        select 1
        from public.products p
        where p.id = product_price_inputs.product_id
          and p.merchant_id = auth.uid()
    )
);

create policy "Agents can submit agent price inputs"
on public.product_price_inputs
for insert
with check (
    source = 'agent'
    and source_user_id = auth.uid()
    and public.jwt_has_role('agent')
);

create policy "Admins can manage product price inputs"
on public.product_price_inputs
for all
using (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']))
with check (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']));

create policy "Admins can view pricing snapshots"
on public.product_pricing_snapshots
for select
using (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']));

create policy "Admins can manage pricing snapshots"
on public.product_pricing_snapshots
for all
using (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']))
with check (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']));

create policy "Participants can view order financials"
on public.order_financials
for select
using (
    public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin'])
    or exists (
        select 1
        from public.orders o
        where o.id = order_financials.order_id
          and (
              o.customer_id = auth.uid()
              or o.merchant_id = auth.uid()
              or o.assigned_agent_id = auth.uid()
              or o.rider_id = auth.uid()
          )
    )
);

create policy "Participants can view order item financials"
on public.order_item_financials
for select
using (
    public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin'])
    or exists (
        select 1
        from public.orders o
        where o.id = order_item_financials.order_id
          and (
              o.customer_id = auth.uid()
              or o.merchant_id = auth.uid()
              or o.assigned_agent_id = auth.uid()
              or o.rider_id = auth.uid()
          )
    )
);

create policy "Participants can view order assignments"
on public.order_assignments
for select
using (
    public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin'])
    or exists (
        select 1
        from public.orders o
        where o.id = order_assignments.order_id
          and (
              o.customer_id = auth.uid()
              or o.merchant_id = auth.uid()
              or o.assigned_agent_id = auth.uid()
              or o.rider_id = auth.uid()
          )
    )
);

create policy "Admins can view corporate wallets"
on public.corporate_wallets
for select
using (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']));

create policy "Admins can manage corporate wallets"
on public.corporate_wallets
for update
using (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']))
with check (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']));

create policy "Admins can view corporate ledger entries"
on public.corporate_ledger_entries
for select
using (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']));

create policy "Admins can view tax liabilities"
on public.tax_liabilities
for select
using (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']));

create policy "Admins can view disputes"
on public.order_disputes
for select
using (
    public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin'])
    or raised_by = auth.uid()
);

create policy "Customers can open disputes on own orders"
on public.order_disputes
for insert
with check (
    raised_by = auth.uid()
    and exists (
        select 1
        from public.orders o
        where o.id = order_disputes.order_id
          and o.customer_id = auth.uid()
    )
);

create policy "Admins can manage disputes"
on public.order_disputes
for update
using (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']))
with check (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']));

create policy "Admins can view refunds"
on public.refunds
for select
using (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']));

create policy "Customers can view own refunds"
on public.refunds
for select
using (
    exists (
        select 1
        from public.orders o
        where o.id = refunds.order_id
          and o.customer_id = auth.uid()
    )
);

create policy "Admins can manage refunds"
on public.refunds
for all
using (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']))
with check (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']));

create policy "Admins can view audit logs"
on public.audit_logs
for select
using (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']));

alter table public.product_price_inputs enable row level security;
alter table public.product_pricing_snapshots enable row level security;
alter table public.order_financials enable row level security;
alter table public.order_item_financials enable row level security;
alter table public.order_assignments enable row level security;
alter table public.corporate_wallets enable row level security;
alter table public.corporate_ledger_entries enable row level security;
alter table public.tax_liabilities enable row level security;
alter table public.order_disputes enable row level security;
alter table public.refunds enable row level security;
alter table public.audit_logs enable row level security;
