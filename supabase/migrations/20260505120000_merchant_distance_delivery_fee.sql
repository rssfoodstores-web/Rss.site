create or replace function public.calculate_order_delivery_fee_from_items(
    p_items jsonb,
    p_delivery_location jsonb
)
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
    v_settings jsonb;
    v_base_fare_kobo bigint;
    v_distance_rate_kobo_per_km bigint;
    v_merchant_id uuid;
    v_merchant_ids uuid[];
    v_origin geography;
    v_destination geography;
    v_distance_km numeric;
begin
    if p_delivery_location is null then
        raise exception 'Delivery location is required';
    end if;

    if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
        raise exception 'Cart is empty';
    end if;

    select array_agg(distinct p.merchant_id)
    into v_merchant_ids
    from jsonb_to_recordset(p_items) as item(product_id uuid, quantity integer)
    join public.products p on p.id = item.product_id;

    if coalesce(cardinality(v_merchant_ids), 0) <> 1 then
        raise exception 'Cart must contain valid items from one merchant before delivery can be priced';
    end if;

    v_merchant_id := v_merchant_ids[1];

    select coalesce(m.location, pr.location)
    into v_origin
    from (select v_merchant_id as id) merchant
    left join public.merchants m on m.id = merchant.id
    left join public.profiles pr on pr.id = merchant.id;

    if v_origin is null then
        raise exception 'Merchant pickup location is not set, so delivery cannot be priced accurately';
    end if;

    v_destination := ST_SetSRID(ST_GeomFromGeoJSON(p_delivery_location), 4326)::geography;
    v_settings := public.get_delivery_settings();
    v_base_fare_kobo := greatest(coalesce((v_settings ->> 'base_fare_kobo')::bigint, 0), 0);
    v_distance_rate_kobo_per_km := greatest(coalesce((v_settings ->> 'distance_rate_kobo_per_km')::bigint, 0), 0);
    v_distance_km := ST_Distance(v_origin, v_destination) / 1000.0;

    return greatest(v_base_fare_kobo + round(v_distance_km * v_distance_rate_kobo_per_km)::bigint, 0);
end;
$function$;

drop function if exists public.create_paid_order_unchecked(uuid, jsonb, jsonb, bigint, jsonb, text, integer);
alter function public.create_paid_order(uuid, jsonb, jsonb, bigint, jsonb, text, integer)
rename to create_paid_order_unchecked;

create or replace function public.create_paid_order(
    p_user_id uuid,
    p_items jsonb,
    p_delivery_location jsonb,
    p_delivery_fee_kobo bigint default 0,
    p_contact_numbers jsonb default '[]'::jsonb,
    p_payment_reference text default null::text,
    p_points_to_redeem integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
    v_delivery_fee_kobo bigint;
begin
    v_delivery_fee_kobo := public.calculate_order_delivery_fee_from_items(p_items, p_delivery_location);

    return public.create_paid_order_unchecked(
        p_user_id,
        p_items,
        p_delivery_location,
        v_delivery_fee_kobo,
        p_contact_numbers,
        p_payment_reference,
        p_points_to_redeem
    );
exception
    when others then
        return jsonb_build_object('success', false, 'error', SQLERRM);
end;
$function$;

drop function if exists public.create_paid_order_with_gift_card_unchecked(uuid, jsonb, jsonb, bigint, jsonb, text, integer);
alter function public.create_paid_order_with_gift_card(uuid, jsonb, jsonb, bigint, jsonb, text, integer)
rename to create_paid_order_with_gift_card_unchecked;

create or replace function public.create_paid_order_with_gift_card(
    p_user_id uuid,
    p_items jsonb,
    p_delivery_location jsonb,
    p_delivery_fee_kobo bigint default 0,
    p_contact_numbers jsonb default '[]'::jsonb,
    p_payment_reference text default null::text,
    p_points_to_redeem integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
    v_delivery_fee_kobo bigint;
begin
    v_delivery_fee_kobo := public.calculate_order_delivery_fee_from_items(p_items, p_delivery_location);

    return public.create_paid_order_with_gift_card_unchecked(
        p_user_id,
        p_items,
        p_delivery_location,
        v_delivery_fee_kobo,
        p_contact_numbers,
        p_payment_reference,
        p_points_to_redeem
    );
exception
    when others then
        return jsonb_build_object('success', false, 'error', SQLERRM);
end;
$function$;

drop function if exists public.create_pending_order_unchecked(uuid, jsonb, jsonb, bigint, jsonb, text, integer);
alter function public.create_pending_order(uuid, jsonb, jsonb, bigint, jsonb, text, integer)
rename to create_pending_order_unchecked;

create or replace function public.create_pending_order(
    p_user_id uuid,
    p_items jsonb,
    p_delivery_location jsonb,
    p_delivery_fee_kobo bigint default 0,
    p_contact_numbers jsonb default '[]'::jsonb,
    p_payment_reference text default null::text,
    p_points_to_redeem integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
    v_delivery_fee_kobo bigint;
begin
    v_delivery_fee_kobo := public.calculate_order_delivery_fee_from_items(p_items, p_delivery_location);

    return public.create_pending_order_unchecked(
        p_user_id,
        p_items,
        p_delivery_location,
        v_delivery_fee_kobo,
        p_contact_numbers,
        p_payment_reference,
        p_points_to_redeem
    );
exception
    when others then
        return jsonb_build_object('success', false, 'error', SQLERRM);
end;
$function$;

revoke execute on function public.create_paid_order(uuid, jsonb, jsonb, bigint, jsonb, text, integer) from public, anon;
revoke execute on function public.create_paid_order_with_gift_card(uuid, jsonb, jsonb, bigint, jsonb, text, integer) from public, anon;
revoke execute on function public.create_pending_order(uuid, jsonb, jsonb, bigint, jsonb, text, integer) from public, anon;

grant execute on function public.create_paid_order(uuid, jsonb, jsonb, bigint, jsonb, text, integer) to authenticated, service_role;
grant execute on function public.create_paid_order_with_gift_card(uuid, jsonb, jsonb, bigint, jsonb, text, integer) to authenticated, service_role;
grant execute on function public.create_pending_order(uuid, jsonb, jsonb, bigint, jsonb, text, integer) to authenticated, service_role;
