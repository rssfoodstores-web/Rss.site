create table public.delivery_addresses (
    id uuid primary key default gen_random_uuid(),
    customer_id uuid not null references auth.users(id) on delete cascade,
    label text not null check (char_length(trim(label)) between 1 and 60),
    address text not null check (char_length(trim(address)) between 1 and 500),
    location geography(Point, 4326) not null,
    created_at timestamptz not null default now()
);
create index delivery_addresses_customer_created_idx on public.delivery_addresses (customer_id, created_at, id);
alter table public.delivery_addresses enable row level security;
revoke all on public.delivery_addresses from anon, authenticated;
grant select, delete on public.delivery_addresses to authenticated;
grant insert (customer_id, label, address, location), update (label, address, location)
    on public.delivery_addresses to authenticated;

create policy delivery_addresses_owner on public.delivery_addresses
    for all to authenticated
    using (customer_id = (select auth.uid()))
    with check (customer_id = (select auth.uid()));

insert into public.delivery_addresses (customer_id, label, address, location)
select p.id, 'Saved address', left(details.address, 500), p.location
from public.profiles p
join auth.users u on u.id = p.id
cross join lateral (
    select coalesce(nullif(concat_ws(', ', nullif(trim(p.house_number), ''),
        nullif(trim(p.street_address), ''), nullif(trim(p.state), ''), nullif(trim(p.zip_code), '')), ''),
        nullif(trim(p.address), '')) as address
) details
where p.location is not null
  and details.address is not null
  and exists (select 1 from public.user_roles r where r.user_id = p.id and r.role = 'customer');

create function public.nearby_catalog(
    p_lat double precision, p_lng double precision, p_category text,
    p_sales_type text, p_search text, p_states text[], p_offset integer
) returns table (
    id uuid, name text, image_url text, category text, stock_level integer,
    merchant_id uuid, price bigint, distance_km double precision, total_count bigint
)
language sql stable security invoker
set search_path = public, extensions
as $function$
    select p.id, p.name::text, p.image_url::text, p.category::text, p.stock_level::integer,
        p.merchant_id, p.price::bigint,
        st_distance(m.location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, false) / 1000,
        count(*) over ()
    from public.products p
    left join public.merchants m on m.id = p.merchant_id
    where p_lat between -90 and 90 and p_lng between -180 and 180
      and p.status = 'approved' and p.active_pricing_id is not null
      and (p_category is null or p.category::text = p_category)
      and (p_sales_type is null or p.sales_type = p_sales_type)
      and (p_search is null or p.name ilike '%' || p_search || '%'
          or p.description ilike '%' || p_search || '%' or p.seo_title ilike '%' || p_search || '%')
      and (p_states is null or p.state = any(p_states))
    order by 8 nulls last, p.created_at desc, p.id
    limit 20 offset greatest(p_offset, 0);
$function$;
revoke execute on function public.nearby_catalog(double precision,double precision,text,text,text,text[],integer) from public;
grant execute on function public.nearby_catalog(double precision,double precision,text,text,text,text[],integer) to anon, authenticated;

create or replace function public.capture_order_delivery_address_snapshot()
returns trigger
language plpgsql security definer
set search_path = public, extensions
as $function$
declare
    v_profile public.profiles;
    v_address_label text;
    v_selected_address text;
begin
    if tg_op = 'UPDATE' then
        new.delivery_address_snapshot := old.delivery_address_snapshot;
        return new;
    end if;
    if new.delivery_address_snapshot is not null then
        return new;
    end if;

    v_selected_address := nullif(current_setting('rss.delivery_address_label', true), '');
    if v_selected_address is not null then
        new.delivery_address_snapshot := jsonb_build_object('address_label', v_selected_address, 'captured_at', now());
        return new;
    end if;

    select * into v_profile from public.profiles where id = new.customer_id;
    v_address_label := nullif(trim(concat_ws(', ',
        nullif(trim(v_profile.house_number), ''), nullif(trim(v_profile.street_address), ''),
        nullif(trim(v_profile.state), ''), nullif(trim(v_profile.zip_code), '')
    )), '');
    new.delivery_address_snapshot := jsonb_strip_nulls(jsonb_build_object(
        'address_label', coalesce(v_address_label, nullif(trim(v_profile.address), '')),
        'house_number', nullif(trim(v_profile.house_number), ''),
        'street_address', nullif(trim(v_profile.street_address), ''),
        'state', nullif(trim(v_profile.state), ''),
        'zip_code', nullif(trim(v_profile.zip_code), ''),
        'captured_at', now()
    ));
    return new;
end;
$function$;

create table public.delivery_checkout_groups (
    id uuid primary key,
    customer_id uuid not null references auth.users(id) on delete cascade,
    method text not null check (method in ('wallet', 'gift', 'direct')),
    payment_reference text unique,
    order_ids uuid[] not null,
    total_kobo bigint not null,
    payment_processed boolean not null default false,
    created_at timestamptz not null default now()
);
create index delivery_checkout_groups_orders_idx on public.delivery_checkout_groups using gin (order_ids);
alter table public.delivery_checkout_groups enable row level security;
revoke all on public.delivery_checkout_groups from anon, authenticated;
grant select on public.delivery_checkout_groups to authenticated, service_role;
create policy delivery_checkout_groups_owner on public.delivery_checkout_groups
    for select to authenticated using (customer_id = (select auth.uid()));

create function public.delivery_checkout_plan(p_address_id uuid, p_items jsonb)
returns table (merchant_id uuid, store_name text, items jsonb, fee bigint, subtotal bigint)
language plpgsql stable security definer
set search_path = public, extensions
as $function$
declare
    v_address public.delivery_addresses;
    v_point jsonb;
begin
    select * into v_address from public.delivery_addresses
    where id = p_address_id and customer_id = auth.uid();
    if not found then
        raise exception 'Choose a saved delivery address.';
    end if;
    if p_items is null or jsonb_typeof(p_items) is distinct from 'array' then
        raise exception 'Cart is empty.';
    end if;
    if jsonb_array_length(p_items) not between 1 and 100 then
        raise exception 'Your cart must have between 1 and 100 different items.';
    end if;
    if exists (
        select 1 from jsonb_to_recordset(p_items) as line(product_id uuid, quantity integer)
        left join public.products p on p.id = line.product_id
        where p.id is null or p.merchant_id is null or p.status is distinct from 'approved'
            or p.active_pricing_id is null or line.quantity is null or line.quantity <= 0
    ) or (select count(distinct line.product_id)
          from jsonb_to_recordset(p_items) as line(product_id uuid)) <> jsonb_array_length(p_items) then
        raise exception 'One or more cart items are unavailable. Check your cart and try again.';
    end if;

    v_point := st_asgeojson(v_address.location::geometry, 15)::jsonb;
    return query
    with stores as (
        select p.merchant_id, max(m.store_name)::text as name,
            jsonb_agg(jsonb_build_object('product_id', p.id, 'quantity', line.quantity, 'price', p.price) order by p.id) as lines,
            sum(p.price::bigint * line.quantity)::bigint as amount
        from jsonb_to_recordset(p_items) as line(product_id uuid, quantity integer)
        join public.products p on p.id = line.product_id
        left join public.merchants m on m.id = p.merchant_id
        group by p.merchant_id
    )
    select stores.merchant_id, coalesce(nullif(trim(stores.name), ''), 'Store'), stores.lines,
        public.calculate_order_delivery_fee_from_items(stores.lines, v_point), stores.amount
    from stores order by stores.merchant_id;
end;
$function$;
revoke execute on function public.delivery_checkout_plan(uuid,jsonb) from public, anon;
grant execute on function public.delivery_checkout_plan(uuid,jsonb) to authenticated;

create function public.checkout_delivery_address(
    p_address_id uuid, p_items jsonb, p_quoted_fee bigint, p_quoted_subtotal bigint,
    p_contacts jsonb, p_points integer, p_method text, p_attempt_id uuid
) returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $function$
declare
    v_user uuid := auth.uid();
    v_address public.delivery_addresses;
    v_point jsonb;
    v_result jsonb;
    v_plan jsonb;
    v_group record;
    v_existing public.delivery_checkout_groups;
    v_fee bigint;
    v_subtotal bigint;
    v_total bigint;
    v_ids uuid[] := '{}';
    v_order_id uuid;
    v_reference text;
begin
    if v_user is null or p_attempt_id is null or p_method is null or p_method not in ('wallet','gift','direct') then
        return jsonb_build_object('success', false, 'error', 'Sign in and choose a payment method.');
    end if;

    perform pg_advisory_xact_lock(hashtextextended('rss-checkout:' || v_user::text || ':' || p_attempt_id::text, 0));
    select * into v_existing from public.delivery_checkout_groups where id = p_attempt_id and customer_id = v_user;
    if found then
        if v_existing.method <> p_method then
            return jsonb_build_object('success', false, 'error', 'This checkout already used a different payment method.');
        end if;
        return jsonb_build_object('success', true, 'order_id', v_existing.order_ids[1],
            'group_id', v_existing.id, 'payment_reference', v_existing.payment_reference, 'total_kobo', v_existing.total_kobo);
    end if;

    select * into v_address from public.delivery_addresses where id = p_address_id and customer_id = v_user for share;
    if not found then
        return jsonb_build_object('success', false, 'error', 'Choose a saved delivery address and try again.');
    end if;

    -- Prevent price or stock changes between checking the quote and creating its orders.
    perform p.id from public.products p
    join jsonb_to_recordset(p_items) as line(product_id uuid) on p.id = line.product_id
    order by p.id for update of p;

    select jsonb_agg(to_jsonb(g) order by g.merchant_id), sum(g.fee), sum(g.subtotal)
    into v_plan, v_fee, v_subtotal
    from public.delivery_checkout_plan(p_address_id, p_items) g;
    if v_fee is distinct from p_quoted_fee or v_subtotal is distinct from p_quoted_subtotal then
        return jsonb_build_object('success', false, 'error', 'Your cart total changed. Review the updated prices before paying.');
    end if;
    if jsonb_array_length(v_plan) > 1 and coalesce(p_points, 0) > 0 then
        return jsonb_build_object('success', false, 'error', 'Reward points can be used on orders from one store.');
    end if;

    v_point := st_asgeojson(v_address.location::geometry, 15)::jsonb;
    perform set_config('rss.delivery_address_label', v_address.address, true);
    v_reference := case when p_method = 'direct' then 'ORD-' || p_attempt_id::text end;

    for v_group in select * from jsonb_to_recordset(v_plan) as g(merchant_id uuid, items jsonb, fee bigint)
    loop
        case p_method
            when 'wallet' then
                v_result := public.create_paid_order(v_user, v_group.items, v_point, v_group.fee, p_contacts, null, p_points);
            when 'gift' then
                v_result := public.create_paid_order_with_gift_card(v_user, v_group.items, v_point, v_group.fee, p_contacts, null, p_points);
            when 'direct' then
                v_result := public.create_pending_order(v_user, v_group.items, v_point, v_group.fee, p_contacts,
                    case when cardinality(v_ids) = 0 then v_reference
                        else v_reference || '-' || (cardinality(v_ids) + 1)::text end, p_points);
        end case;
        if not coalesce((v_result->>'success')::boolean, false) then
            -- An exception rolls back every merchant order and any wallet or stock changes.
            raise exception using errcode = 'P0001', message = coalesce(v_result->>'error', 'Checkout could not be completed.');
        end if;
        v_order_id := (v_result->>'order_id')::uuid;
        v_ids := array_append(v_ids, v_order_id);
    end loop;

    perform set_config('rss.delivery_address_label', '', true);
    select sum(total_amount)::bigint into v_total from public.orders where id = any(v_ids);
    insert into public.delivery_checkout_groups (id, customer_id, method, payment_reference, order_ids, total_kobo, payment_processed)
    values (p_attempt_id, v_user, p_method, v_reference, v_ids, v_total, p_method <> 'direct');
    return jsonb_build_object('success', true, 'order_id', v_ids[1], 'group_id', p_attempt_id,
        'payment_reference', v_reference, 'total_kobo', v_total);
exception when raise_exception then
    return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$function$;
revoke execute on function public.checkout_delivery_address(uuid,jsonb,bigint,bigint,jsonb,integer,text,uuid) from public, anon;
grant execute on function public.checkout_delivery_address(uuid,jsonb,bigint,bigint,jsonb,integer,text,uuid) to authenticated;

alter function public.cancel_unpaid_order(uuid) rename to cancel_unpaid_order_single;
revoke execute on function public.cancel_unpaid_order_single(uuid) from public, anon, authenticated, service_role;
create function public.cancel_unpaid_order(p_order_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $function$
declare
    v_group public.delivery_checkout_groups;
    v_id uuid;
    v_result jsonb;
begin
    select * into v_group from public.delivery_checkout_groups
    where order_ids @> array[p_order_id] for update;
    if not found then
        return public.cancel_unpaid_order_single(p_order_id);
    end if;
    if auth.uid() is distinct from v_group.customer_id
       and not public.jwt_has_any_role(array['admin','sub_admin','supa_admin']) then
        return jsonb_build_object('success', false, 'error', 'You cannot cancel this order.');
    end if;
    if v_group.method <> 'direct' or v_group.payment_processed then
        return jsonb_build_object('success', false, 'error', 'Only unpaid checkouts can be cancelled.');
    end if;

    foreach v_id in array v_group.order_ids loop
        if exists (select 1 from public.orders where id = v_id and status = 'cancelled' and payment_status = 'failed') then
            continue;
        end if;
        v_result := public.cancel_unpaid_order_single(v_id);
        if not coalesce((v_result->>'success')::boolean, false) then
            raise exception using errcode = 'P0001', message = coalesce(v_result->>'error', 'Could not cancel checkout.');
        end if;
    end loop;
    return jsonb_build_object('success', true, 'order_id', p_order_id);
exception when raise_exception then
    return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$function$;
revoke execute on function public.cancel_unpaid_order(uuid) from public, anon;
grant execute on function public.cancel_unpaid_order(uuid) to authenticated, service_role;

create function public.confirm_delivery_checkout_payment(p_group_id uuid, p_reference text, p_amount_kobo bigint)
returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $function$
declare
    v_group public.delivery_checkout_groups;
    v_order public.orders;
    v_id uuid;
    v_result jsonb;
begin
    select * into v_group from public.delivery_checkout_groups where id = p_group_id for update;
    if not found or v_group.method <> 'direct' or v_group.payment_reference is distinct from p_reference
       or v_group.total_kobo is distinct from p_amount_kobo then
        return jsonb_build_object('success', false, 'error', 'Checkout payment did not match.');
    end if;
    if v_group.payment_processed then
        return jsonb_build_object('success', true);
    end if;

    foreach v_id in array v_group.order_ids loop
        select * into strict v_order from public.orders where id = v_id for update;
        if v_order.status = 'cancelled' or v_order.payment_status = 'failed' then
            v_result := public.handle_late_order_payment(v_id, v_order.payment_ref, v_order.total_amount);
        else
            v_result := public.mark_direct_payment_success(v_id, v_order.payment_ref);
        end if;
        if not coalesce((v_result->>'success')::boolean, false) then
            raise exception using errcode = 'P0001', message = coalesce(v_result->>'error', 'Could not confirm checkout.');
        end if;
    end loop;
    update public.delivery_checkout_groups set payment_processed = true where id = p_group_id;
    return jsonb_build_object('success', true);
exception when raise_exception then
    return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$function$;
revoke execute on function public.confirm_delivery_checkout_payment(uuid,text,bigint) from public, anon, authenticated;
grant execute on function public.confirm_delivery_checkout_payment(uuid,text,bigint) to service_role;
