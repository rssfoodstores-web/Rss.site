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
