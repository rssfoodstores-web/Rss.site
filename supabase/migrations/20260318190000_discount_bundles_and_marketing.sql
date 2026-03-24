drop policy if exists "Admins can insert products" on public.products;
create policy "Admins can insert products"
on public.products
for insert
with check (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']));

drop policy if exists "Admins can delete products" on public.products;
create policy "Admins can delete products"
on public.products
for delete
using (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']));

create table if not exists public.discount_bundle_page_content (
    slug text primary key default 'home-essential-bundles',
    eyebrow_text text not null default 'Save more with our',
    title text not null default 'Home Essential Bundles',
    highlight_text text null default 'Value packs for everyday shopping',
    description text null default 'Buy household staples in ready-made bundles and pay one discounted price.',
    primary_cta_text text not null default 'View all bundles',
    primary_cta_url text not null default '/discount-bundles',
    secondary_heading text not null default 'Most Popular Bundles',
    secondary_description text null default 'Pick from featured essentials curated for recurring purchases.',
    closing_title text not null default 'Ready to start saving?',
    closing_body text null default 'Bundle more items together and stretch your household budget further.',
    closing_cta_text text not null default 'View all bundles',
    closing_cta_url text not null default '/discount-bundles',
    feature_points jsonb not null default '[
        {"title":"Best Prices Guaranteed","body":"Bundle discounts are applied on top of approved catalog pricing."},
        {"title":"Carefully Curated","body":"Each bundle groups products customers already buy together."},
        {"title":"Quality Assured","body":"Only approved store items can be included in a bundle campaign."}
    ]'::jsonb,
    hero_media_type text not null default 'image',
    hero_media_url text null,
    hero_media_public_id text null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    updated_by uuid null references public.profiles(id) on delete set null,
    constraint discount_bundle_page_content_media_type_chk check (hero_media_type in ('image', 'video')),
    constraint discount_bundle_page_content_features_chk check (jsonb_typeof(feature_points) = 'array')
);

insert into public.discount_bundle_page_content (slug)
values ('home-essential-bundles')
on conflict (slug) do nothing;

create table if not exists public.discount_bundles (
    id uuid primary key default uuid_generate_v4(),
    product_id uuid not null unique references public.products(id) on delete restrict,
    slug text not null unique,
    title text not null,
    summary text null,
    description text null,
    badge_text text null,
    button_text text not null default 'View bundle',
    status text not null default 'draft',
    is_featured boolean not null default false,
    sort_order integer not null default 0,
    discount_mode text not null default 'fixed_price',
    discount_percent integer null,
    fixed_price_kobo bigint null,
    bundle_price_kobo bigint not null default 0,
    compare_at_price_kobo bigint not null default 0,
    card_media_type text not null default 'image',
    card_media_url text not null,
    card_media_public_id text not null,
    campaign_starts_at timestamptz null,
    campaign_ends_at timestamptz null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    created_by uuid null references public.profiles(id) on delete set null,
    updated_by uuid null references public.profiles(id) on delete set null,
    constraint discount_bundles_status_chk check (status in ('draft', 'active', 'archived')),
    constraint discount_bundles_mode_chk check (discount_mode in ('percent', 'fixed_price')),
    constraint discount_bundles_media_type_chk check (card_media_type in ('image', 'video')),
    constraint discount_bundles_campaign_window_chk check (campaign_ends_at is null or campaign_starts_at is null or campaign_ends_at > campaign_starts_at),
    constraint discount_bundles_discount_percent_chk check (discount_percent is null or (discount_percent between 1 and 95)),
    constraint discount_bundles_fixed_price_chk check (fixed_price_kobo is null or fixed_price_kobo > 0),
    constraint discount_bundles_mode_price_chk check (
        (discount_mode = 'percent' and discount_percent is not null)
        or (discount_mode = 'fixed_price' and fixed_price_kobo is not null)
    )
);

create table if not exists public.discount_bundle_items (
    id uuid primary key default uuid_generate_v4(),
    bundle_id uuid not null references public.discount_bundles(id) on delete cascade,
    product_id uuid not null references public.products(id) on delete restrict,
    quantity integer not null,
    sort_order integer not null default 0,
    created_at timestamptz not null default now(),
    constraint discount_bundle_items_quantity_chk check (quantity > 0),
    constraint discount_bundle_items_unique_product unique (bundle_id, product_id)
);

create index if not exists discount_bundles_status_idx
    on public.discount_bundles (status, is_featured, sort_order, created_at desc);

create index if not exists discount_bundles_campaign_idx
    on public.discount_bundles (campaign_starts_at, campaign_ends_at);

create index if not exists discount_bundle_items_bundle_idx
    on public.discount_bundle_items (bundle_id, sort_order, created_at);

create index if not exists discount_bundle_items_product_idx
    on public.discount_bundle_items (product_id);

drop trigger if exists discount_bundle_page_content_set_updated_at on public.discount_bundle_page_content;
create trigger discount_bundle_page_content_set_updated_at
before update on public.discount_bundle_page_content
for each row
execute function public.set_updated_at();

drop trigger if exists discount_bundles_set_updated_at on public.discount_bundles;
create trigger discount_bundles_set_updated_at
before update on public.discount_bundles
for each row
execute function public.set_updated_at();

create or replace function public.discount_bundle_is_live(
    p_status text,
    p_campaign_starts_at timestamptz,
    p_campaign_ends_at timestamptz
)
returns boolean
language sql
stable
as $function$
    select
        p_status = 'active'
        and (p_campaign_starts_at is null or p_campaign_starts_at <= now())
        and (p_campaign_ends_at is null or p_campaign_ends_at >= now());
$function$;

create or replace function public.get_discount_bundle_compare_at_kobo(p_bundle_id uuid)
returns bigint
language sql
stable
as $function$
    select coalesce(sum(p.price * i.quantity), 0)::bigint
    from public.discount_bundle_items i
    join public.products p on p.id = i.product_id
    where i.bundle_id = p_bundle_id;
$function$;

create or replace function public.get_discount_bundle_available_stock(p_bundle_id uuid)
returns integer
language plpgsql
stable
as $function$
declare
    v_available integer;
begin
    select coalesce(min(floor(coalesce(p.stock_level, 0)::numeric / i.quantity)), 0)::integer
    into v_available
    from public.discount_bundle_items i
    join public.products p on p.id = i.product_id
    where i.bundle_id = p_bundle_id;

    return coalesce(v_available, 0);
end;
$function$;

create or replace function public.sync_discount_bundle_product_snapshot(p_bundle_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
    v_bundle public.discount_bundles%rowtype;
    v_compare_at_kobo bigint := 0;
    v_bundle_price_kobo bigint := 0;
    v_available_stock integer := 0;
    v_is_live boolean := false;
begin
    select *
    into v_bundle
    from public.discount_bundles
    where id = p_bundle_id;

    if not found then
        return;
    end if;

    v_compare_at_kobo := public.get_discount_bundle_compare_at_kobo(v_bundle.id);
    v_available_stock := public.get_discount_bundle_available_stock(v_bundle.id);
    v_is_live := public.discount_bundle_is_live(v_bundle.status, v_bundle.campaign_starts_at, v_bundle.campaign_ends_at);

    if v_bundle.discount_mode = 'percent' then
        v_bundle_price_kobo := round((v_compare_at_kobo * (100 - coalesce(v_bundle.discount_percent, 0)))::numeric / 100.0)::bigint;
    else
        v_bundle_price_kobo := coalesce(v_bundle.fixed_price_kobo, 0);
    end if;

    update public.discount_bundles
    set bundle_price_kobo = greatest(v_bundle_price_kobo, 0),
        compare_at_price_kobo = greatest(v_compare_at_kobo, 0)
    where id = v_bundle.id;

    update public.products
    set price = greatest(v_bundle_price_kobo, 0),
        stock_level = greatest(v_available_stock, 0),
        image_url = v_bundle.card_media_url,
        is_available = v_is_live and greatest(v_available_stock, 0) > 0
    where id = v_bundle.product_id;
end;
$function$;

create or replace function public.sync_discount_bundles_for_child_product(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
    v_bundle_id uuid;
begin
    for v_bundle_id in
        select distinct i.bundle_id
        from public.discount_bundle_items i
        where i.product_id = p_product_id
    loop
        perform public.sync_discount_bundle_product_snapshot(v_bundle_id);
    end loop;
end;
$function$;

create or replace function public.validate_discount_bundle_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
    v_bundle_product_id uuid;
    v_bundle_merchant_id uuid;
    v_child_merchant_id uuid;
    v_child_status text;
begin
    select b.product_id, p.merchant_id
    into v_bundle_product_id, v_bundle_merchant_id
    from public.discount_bundles b
    join public.products p on p.id = b.product_id
    where b.id = new.bundle_id;

    if v_bundle_product_id is null then
        raise exception 'Discount bundle was not found.';
    end if;

    if new.product_id = v_bundle_product_id then
        raise exception 'Bundle products cannot include themselves.';
    end if;

    if exists (
        select 1
        from public.discount_bundles nested_bundle
        where nested_bundle.product_id = new.product_id
    ) then
        raise exception 'Bundle products cannot be nested inside another bundle.';
    end if;

    select p.merchant_id, p.status::text
    into v_child_merchant_id, v_child_status
    from public.products p
    where p.id = new.product_id;

    if v_child_merchant_id is null then
        raise exception 'Selected bundle item product was not found.';
    end if;

    if v_child_status <> 'approved' then
        raise exception 'Only approved products can be added to a discount bundle.';
    end if;

    if v_child_merchant_id <> v_bundle_merchant_id then
        raise exception 'Bundle items must all belong to the same merchant.';
    end if;

    return new;
end;
$function$;

drop trigger if exists discount_bundle_items_validate on public.discount_bundle_items;
create trigger discount_bundle_items_validate
before insert or update on public.discount_bundle_items
for each row
execute function public.validate_discount_bundle_item();

create or replace function public.handle_discount_bundle_item_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
    if tg_op = 'DELETE' then
        perform public.sync_discount_bundle_product_snapshot(old.bundle_id);
        return old;
    end if;

    perform public.sync_discount_bundle_product_snapshot(new.bundle_id);

    if tg_op = 'UPDATE' and new.bundle_id is distinct from old.bundle_id then
        perform public.sync_discount_bundle_product_snapshot(old.bundle_id);
    end if;

    return new;
end;
$function$;

drop trigger if exists discount_bundle_items_after_change on public.discount_bundle_items;
create trigger discount_bundle_items_after_change
after insert or update or delete on public.discount_bundle_items
for each row
execute function public.handle_discount_bundle_item_change();

create or replace function public.handle_discount_bundle_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
    perform public.sync_discount_bundle_product_snapshot(new.id);
    return new;
end;
$function$;

drop trigger if exists discount_bundles_after_change on public.discount_bundles;
create trigger discount_bundles_after_change
after insert or update of status, discount_mode, discount_percent, fixed_price_kobo, card_media_url, campaign_starts_at, campaign_ends_at
on public.discount_bundles
for each row
execute function public.handle_discount_bundle_change();

create or replace function public.handle_product_bundle_dependency_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
    perform public.sync_discount_bundles_for_child_product(new.id);
    return new;
end;
$function$;

drop trigger if exists products_discount_bundle_dependency_change on public.products;
create trigger products_discount_bundle_dependency_change
after update of price, stock_level on public.products
for each row
when (old.price is distinct from new.price or old.stock_level is distinct from new.stock_level)
execute function public.handle_product_bundle_dependency_change();

create or replace function public.validate_orderable_product(
    p_product_id uuid,
    p_quantity integer,
    p_lock boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
    v_product record;
    v_bundle record;
    v_component record;
begin
    if coalesce(p_quantity, 0) <= 0 then
        return jsonb_build_object('success', false, 'error', 'Invalid quantity in cart');
    end if;

    if p_lock then
        select p.id, p.name, p.price, p.stock_level, p.merchant_id, p.status::text
        into v_product
        from public.products p
        where p.id = p_product_id
        for update;
    else
        select p.id, p.name, p.price, p.stock_level, p.merchant_id, p.status::text
        into v_product
        from public.products p
        where p.id = p_product_id;
    end if;

    if v_product.id is null or v_product.status <> 'approved' then
        return jsonb_build_object('success', false, 'error', 'Product not found or not approved');
    end if;

    select b.id, b.status, b.campaign_starts_at, b.campaign_ends_at
    into v_bundle
    from public.discount_bundles b
    where b.product_id = p_product_id;

    if v_bundle.id is null then
        if coalesce(v_product.stock_level, 0) < p_quantity then
            return jsonb_build_object('success', false, 'error', 'Insufficient stock for ' || v_product.name);
        end if;

        return jsonb_build_object(
            'success', true,
            'merchant_id', v_product.merchant_id,
            'price_kobo', v_product.price,
            'name', v_product.name,
            'is_bundle', false
        );
    end if;

    if v_bundle.status <> 'active' then
        return jsonb_build_object('success', false, 'error', 'This discount bundle is not currently active');
    end if;

    if v_bundle.campaign_starts_at is not null and v_bundle.campaign_starts_at > now() then
        return jsonb_build_object('success', false, 'error', 'This discount bundle campaign has not started yet');
    end if;

    if v_bundle.campaign_ends_at is not null and v_bundle.campaign_ends_at < now() then
        return jsonb_build_object('success', false, 'error', 'This discount bundle campaign has ended');
    end if;

    if not exists (
        select 1
        from public.discount_bundle_items i
        where i.bundle_id = v_bundle.id
    ) then
        return jsonb_build_object('success', false, 'error', 'This discount bundle has no products configured');
    end if;

    if p_lock then
        for v_component in
            select p.name, coalesce(p.stock_level, 0) as stock_level, i.quantity
            from public.discount_bundle_items i
            join public.products p on p.id = i.product_id
            where i.bundle_id = v_bundle.id
            for update of p
        loop
            if v_component.stock_level < (v_component.quantity * p_quantity) then
                return jsonb_build_object('success', false, 'error', 'Insufficient stock for bundle item ' || v_component.name);
            end if;
        end loop;
    else
        for v_component in
            select p.name, coalesce(p.stock_level, 0) as stock_level, i.quantity
            from public.discount_bundle_items i
            join public.products p on p.id = i.product_id
            where i.bundle_id = v_bundle.id
        loop
            if v_component.stock_level < (v_component.quantity * p_quantity) then
                return jsonb_build_object('success', false, 'error', 'Insufficient stock for bundle item ' || v_component.name);
            end if;
        end loop;
    end if;

    return jsonb_build_object(
        'success', true,
        'merchant_id', v_product.merchant_id,
        'price_kobo', v_product.price,
        'name', v_product.name,
        'is_bundle', true,
        'bundle_id', v_bundle.id
    );
end;
$function$;

create or replace function public.consume_orderable_product_stock(
    p_product_id uuid,
    p_quantity integer
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
    v_bundle_id uuid;
    v_component record;
begin
    if coalesce(p_quantity, 0) <= 0 then
        return;
    end if;

    select b.id
    into v_bundle_id
    from public.discount_bundles b
    where b.product_id = p_product_id;

    if v_bundle_id is null then
        update public.products
        set stock_level = greatest(coalesce(stock_level, 0) - p_quantity, 0)
        where id = p_product_id;

        return;
    end if;

    for v_component in
        select i.product_id, i.quantity
        from public.discount_bundle_items i
        where i.bundle_id = v_bundle_id
    loop
        update public.products
        set stock_level = greatest(coalesce(stock_level, 0) - (v_component.quantity * p_quantity), 0)
        where id = v_component.product_id;
    end loop;

    perform public.sync_discount_bundle_product_snapshot(v_bundle_id);
end;
$function$;

drop policy if exists "Public can view discount bundle page content" on public.discount_bundle_page_content;
create policy "Public can view discount bundle page content"
on public.discount_bundle_page_content
for select
using (true);

drop policy if exists "Admins can manage discount bundle page content" on public.discount_bundle_page_content;
create policy "Admins can manage discount bundle page content"
on public.discount_bundle_page_content
for all
using (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']))
with check (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']));

drop policy if exists "Public can view live discount bundles" on public.discount_bundles;
create policy "Public can view live discount bundles"
on public.discount_bundles
for select
using (
    public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin'])
    or public.discount_bundle_is_live(status, campaign_starts_at, campaign_ends_at)
);

drop policy if exists "Admins can manage discount bundles" on public.discount_bundles;
create policy "Admins can manage discount bundles"
on public.discount_bundles
for all
using (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']))
with check (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']));

drop policy if exists "Public can view live discount bundle items" on public.discount_bundle_items;
create policy "Public can view live discount bundle items"
on public.discount_bundle_items
for select
using (
    public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin'])
    or exists (
        select 1
        from public.discount_bundles b
        where b.id = discount_bundle_items.bundle_id
          and public.discount_bundle_is_live(b.status, b.campaign_starts_at, b.campaign_ends_at)
    )
);

drop policy if exists "Admins can manage discount bundle items" on public.discount_bundle_items;
create policy "Admins can manage discount bundle items"
on public.discount_bundle_items
for all
using (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']))
with check (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']));

alter table public.discount_bundle_page_content enable row level security;
alter table public.discount_bundles enable row level security;
alter table public.discount_bundle_items enable row level security;

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
set search_path = public
as $function$
declare
    v_actor uuid := auth.uid();
    v_wallet_id uuid;
    v_wallet_balance bigint;
    v_order_id uuid;
    v_item record;
    v_product record;
    v_validation jsonb;
    v_merchant_id uuid;
    v_total_kobo bigint := 0;
    v_payment_reference text := coalesce(p_payment_reference, 'WAL-' || encode(gen_random_bytes(8), 'hex'));
    v_assigned_agent_id uuid;
begin
    if v_actor is null then
        return jsonb_build_object('success', false, 'error', 'Authentication required');
    end if;

    if p_user_id is distinct from v_actor then
        return jsonb_build_object('success', false, 'error', 'You can only place orders for your own account');
    end if;

    if not exists (
        select 1
        from public.agent_profiles ap
        where ap.status = 'approved'
    ) then
        return jsonb_build_object('success', false, 'error', 'No approved agents are currently available');
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
        v_validation := public.validate_orderable_product(v_item.product_id, v_item.quantity, true);

        if not coalesce((v_validation ->> 'success')::boolean, false) then
            return jsonb_build_object('success', false, 'error', coalesce(v_validation ->> 'error', 'Product validation failed'));
        end if;

        if v_merchant_id is null then
            v_merchant_id := (v_validation ->> 'merchant_id')::uuid;
        elsif v_merchant_id <> (v_validation ->> 'merchant_id')::uuid then
            return jsonb_build_object('success', false, 'error', 'Mixed merchant carts are not allowed');
        end if;

        v_total_kobo := v_total_kobo + (((v_validation ->> 'price_kobo')::bigint) * v_item.quantity);
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
        where p.id = v_item.product_id;

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

        perform public.consume_orderable_product_stock(v_item.product_id, v_item.quantity);
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

    v_assigned_agent_id := public.assign_best_agent(
        v_order_id,
        p_user_id,
        'auto',
        'System auto assignment after paid order creation'
    );

    if v_assigned_agent_id is null then
        raise exception 'No approved agents are currently available';
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
$function$;

create or replace function public.create_paid_order_with_gift_card(
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
set search_path = public
as $function$
declare
    v_actor uuid := auth.uid();
    v_order_id uuid;
    v_item record;
    v_product record;
    v_validation jsonb;
    v_merchant_id uuid;
    v_total_kobo bigint := 0;
    v_payment_reference text := coalesce(p_payment_reference, 'GFTPAY-' || encode(gen_random_bytes(8), 'hex'));
    v_assigned_agent_id uuid;
    v_available_kobo bigint := 0;
    v_remaining_to_apply bigint;
    v_debit_kobo bigint;
    v_gift_card record;
begin
    if v_actor is null then
        return jsonb_build_object('success', false, 'error', 'Authentication required');
    end if;

    if p_user_id is distinct from v_actor then
        return jsonb_build_object('success', false, 'error', 'You can only place orders for your own account');
    end if;

    if not exists (
        select 1
        from public.agent_profiles ap
        where ap.status = 'approved'
    ) then
        return jsonb_build_object('success', false, 'error', 'No approved agents are currently available');
    end if;

    if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
        return jsonb_build_object('success', false, 'error', 'Cart is empty');
    end if;

    for v_item in
        select *
        from jsonb_to_recordset(p_items) as item(product_id uuid, quantity integer)
    loop
        v_validation := public.validate_orderable_product(v_item.product_id, v_item.quantity, true);

        if not coalesce((v_validation ->> 'success')::boolean, false) then
            return jsonb_build_object('success', false, 'error', coalesce(v_validation ->> 'error', 'Product validation failed'));
        end if;

        if v_merchant_id is null then
            v_merchant_id := (v_validation ->> 'merchant_id')::uuid;
        elsif v_merchant_id <> (v_validation ->> 'merchant_id')::uuid then
            return jsonb_build_object('success', false, 'error', 'Mixed merchant carts are not allowed');
        end if;

        v_total_kobo := v_total_kobo + (((v_validation ->> 'price_kobo')::bigint) * v_item.quantity);
    end loop;

    v_total_kobo := v_total_kobo + greatest(coalesce(p_delivery_fee_kobo, 0), 0);
    v_remaining_to_apply := v_total_kobo;

    for v_gift_card in
        select id, code, remaining_amount_kobo
        from public.gift_cards
        where recipient_id = p_user_id
          and status = 'active'
          and remaining_amount_kobo > 0
          and (expires_at is null or expires_at > now())
        order by expires_at asc nulls last, created_at asc
        for update
    loop
        v_available_kobo := v_available_kobo + v_gift_card.remaining_amount_kobo;
    end loop;

    if v_available_kobo < v_total_kobo then
        return jsonb_build_object('success', false, 'error', 'Insufficient gift card balance');
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
        where p.id = v_item.product_id;

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

        perform public.consume_orderable_product_stock(v_item.product_id, v_item.quantity);
    end loop;

    for v_gift_card in
        select id, code, remaining_amount_kobo
        from public.gift_cards
        where recipient_id = p_user_id
          and status = 'active'
          and remaining_amount_kobo > 0
          and (expires_at is null or expires_at > now())
        order by expires_at asc nulls last, created_at asc
        for update
    loop
        exit when v_remaining_to_apply <= 0;

        v_debit_kobo := least(v_gift_card.remaining_amount_kobo, v_remaining_to_apply);

        update public.gift_cards
        set remaining_amount_kobo = remaining_amount_kobo - v_debit_kobo,
            status = case
                when remaining_amount_kobo - v_debit_kobo <= 0 then 'depleted'
                else 'active'
            end,
            last_used_at = now(),
            updated_at = now()
        where id = v_gift_card.id;

        insert into public.gift_card_transactions (
            gift_card_id,
            actor_id,
            transaction_type,
            amount_kobo,
            reference,
            description,
            metadata
        )
        values (
            v_gift_card.id,
            v_actor,
            'debit',
            v_debit_kobo,
            v_payment_reference,
            'Gift card applied to order ' || upper(substr(v_order_id::text, 1, 8)),
            jsonb_build_object('order_id', v_order_id, 'gift_card_code', v_gift_card.code)
        );

        v_remaining_to_apply := v_remaining_to_apply - v_debit_kobo;
    end loop;

    if v_remaining_to_apply > 0 then
        raise exception 'Gift card balance became unavailable during checkout';
    end if;

    perform public.refresh_order_financials(v_order_id);

    v_assigned_agent_id := public.assign_best_agent(
        v_order_id,
        p_user_id,
        'auto',
        'System auto assignment after gift card payment'
    );

    if v_assigned_agent_id is null then
        raise exception 'No approved agents are currently available';
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
        v_order_id,
        'merchant',
        v_merchant_id,
        p_user_id,
        'auto',
        'Merchant linked from ordered products',
        true
    );

    perform public.create_notification(
        p_user_id,
        'Gift card applied',
        'Your gift card balance paid for order #' || upper(substr(v_order_id::text, 1, 8)) || '. Amount: ' || public.format_kobo_amount(v_total_kobo) || '.',
        'gift_card_debit',
        '/account/gift-card',
        jsonb_build_object('order_id', v_order_id, 'amount_kobo', v_total_kobo)
    );

    perform public.write_audit_log(
        p_user_id,
        'create_paid_order_with_gift_card',
        'order',
        v_order_id,
        jsonb_build_object('payment_reference', v_payment_reference, 'merchant_id', v_merchant_id, 'amount_kobo', v_total_kobo)
    );

    return jsonb_build_object('success', true, 'order_id', v_order_id, 'payment_reference', v_payment_reference);
end;
$function$;

create or replace function public.create_pending_order(
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
set search_path = public
as $function$
declare
    v_actor uuid := auth.uid();
    v_order_id uuid;
    v_item record;
    v_product record;
    v_validation jsonb;
    v_merchant_id uuid;
    v_total_kobo bigint := 0;
    v_payment_reference text := coalesce(p_payment_reference, 'ORD-' || encode(gen_random_bytes(8), 'hex'));
begin
    if v_actor is null then
        return jsonb_build_object('success', false, 'error', 'Authentication required');
    end if;

    if p_user_id is distinct from v_actor then
        return jsonb_build_object('success', false, 'error', 'You can only place orders for your own account');
    end if;

    if not exists (
        select 1
        from public.agent_profiles ap
        where ap.status = 'approved'
    ) then
        return jsonb_build_object('success', false, 'error', 'No approved agents are currently available');
    end if;

    if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
        return jsonb_build_object('success', false, 'error', 'Cart is empty');
    end if;

    for v_item in
        select *
        from jsonb_to_recordset(p_items) as item(product_id uuid, quantity integer)
    loop
        v_validation := public.validate_orderable_product(v_item.product_id, v_item.quantity, false);

        if not coalesce((v_validation ->> 'success')::boolean, false) then
            return jsonb_build_object('success', false, 'error', coalesce(v_validation ->> 'error', 'Product validation failed'));
        end if;

        if v_merchant_id is null then
            v_merchant_id := (v_validation ->> 'merchant_id')::uuid;
        elsif v_merchant_id <> (v_validation ->> 'merchant_id')::uuid then
            return jsonb_build_object('success', false, 'error', 'Mixed merchant carts are not allowed');
        end if;

        v_total_kobo := v_total_kobo + (((v_validation ->> 'price_kobo')::bigint) * v_item.quantity);
    end loop;

    v_total_kobo := v_total_kobo + greatest(coalesce(p_delivery_fee_kobo, 0), 0);

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
        'pending',
        'pending',
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
        where p.id = v_item.product_id;

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
    end loop;

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
        'create_pending_order',
        'order',
        v_order_id,
        jsonb_build_object('payment_reference', v_payment_reference, 'merchant_id', v_merchant_id)
    );

    return jsonb_build_object(
        'success',
        true,
        'order_id',
        v_order_id,
        'payment_reference',
        v_payment_reference
    );
end;
$function$;

create or replace function public.mark_pending_order_paid(
    p_order_id uuid,
    p_payment_reference text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
    v_order record;
    v_item record;
    v_validation jsonb;
    v_customer_wallet uuid;
    v_refund_id uuid;
    v_assigned_agent_id uuid;
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
        return jsonb_build_object('success', true, 'order_id', p_order_id);
    end if;

    if v_order.status <> 'pending' or v_order.payment_status <> 'pending' then
        return jsonb_build_object('success', false, 'error', 'Order is not awaiting payment');
    end if;

    if not exists (
        select 1
        from public.agent_profiles ap
        where ap.status = 'approved'
    ) then
        return jsonb_build_object('success', false, 'error', 'No approved agents are currently available');
    end if;

    for v_item in
        select oi.product_id, oi.quantity
        from public.order_items oi
        where oi.order_id = p_order_id
    loop
        v_validation := public.validate_orderable_product(v_item.product_id, v_item.quantity, true);

        if not coalesce((v_validation ->> 'success')::boolean, false) then
            v_customer_wallet := public.ensure_actor_wallet(v_order.customer_id, 'customer');

            insert into public.refunds (
                order_id,
                amount_kobo,
                reason,
                status,
                processed_at
            )
            values (
                p_order_id,
                v_order.total_amount,
                'Auto refund after direct payment could not be fulfilled',
                'processed',
                now()
            )
            returning id into v_refund_id;

            update public.wallets
            set balance = balance + v_order.total_amount
            where id = v_customer_wallet;

            insert into public.ledger_entries (wallet_id, amount, description, reference_id)
            values (v_customer_wallet, v_order.total_amount, 'Auto refund for unfulfillable direct payment order', p_order_id);

            update public.orders
            set payment_status = 'refunded',
                status = 'refunded',
                payment_ref = coalesce(p_payment_reference, v_order.payment_ref)
            where id = p_order_id;

            update public.order_financials
            set settlement_status = 'refunded',
                updated_at = now()
            where order_id = p_order_id;

            perform public.write_audit_log(
                null,
                'mark_direct_payment_success_auto_refund',
                'order',
                p_order_id,
                jsonb_build_object('payment_reference', coalesce(p_payment_reference, v_order.payment_ref), 'refund_id', v_refund_id)
            );

            return jsonb_build_object('success', true, 'order_id', p_order_id, 'auto_refunded', true);
        end if;
    end loop;

    for v_item in
        select oi.product_id, oi.quantity
        from public.order_items oi
        where oi.order_id = p_order_id
    loop
        perform public.consume_orderable_product_stock(v_item.product_id, v_item.quantity);
    end loop;

    update public.orders
    set payment_status = 'paid',
        status = 'awaiting_agent_acceptance',
        payment_ref = coalesce(p_payment_reference, v_order.payment_ref)
    where id = p_order_id;

    perform public.refresh_order_financials(p_order_id);

    v_assigned_agent_id := public.assign_best_agent(
        p_order_id,
        null,
        'auto',
        'System auto assignment after direct payment confirmation'
    );

    if v_assigned_agent_id is null then
        v_customer_wallet := public.ensure_actor_wallet(v_order.customer_id, 'customer');

        insert into public.refunds (
            order_id,
            amount_kobo,
            reason,
            status,
            processed_at
        )
        values (
            p_order_id,
            v_order.total_amount,
            'Auto refund after direct payment because no approved agent was available',
            'processed',
            now()
        )
        returning id into v_refund_id;

        update public.wallets
        set balance = balance + v_order.total_amount
        where id = v_customer_wallet;

        insert into public.ledger_entries (wallet_id, amount, description, reference_id)
        values (v_customer_wallet, v_order.total_amount, 'Auto refund for direct payment order without available agent', p_order_id);

        update public.orders
        set payment_status = 'refunded',
            status = 'refunded'
        where id = p_order_id;

        update public.order_financials
        set settlement_status = 'refunded',
            updated_at = now()
        where order_id = p_order_id;

        perform public.write_audit_log(
            null,
            'mark_direct_payment_success_auto_refund',
            'order',
            p_order_id,
            jsonb_build_object('payment_reference', coalesce(p_payment_reference, v_order.payment_ref), 'refund_id', v_refund_id, 'reason', 'no_agent_available')
        );

        return jsonb_build_object('success', true, 'order_id', p_order_id, 'auto_refunded', true);
    end if;

    perform public.write_audit_log(
        null,
        'mark_direct_payment_success',
        'order',
        p_order_id,
        jsonb_build_object('payment_reference', coalesce(p_payment_reference, v_order.payment_ref))
    );

    return jsonb_build_object('success', true, 'order_id', p_order_id);
end;
$function$;
