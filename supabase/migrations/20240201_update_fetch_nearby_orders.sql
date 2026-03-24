CREATE OR REPLACE FUNCTION public.fetch_nearby_orders(lat double precision, long double precision, radius_meters double precision)
 RETURNS TABLE(id uuid, total_amount numeric, status text, created_at timestamp with time zone, merchant_name text, merchant_address text, merchant_location geography, delivery_location jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  return query
  select distinct
    o.id,
    (o.total_amount::numeric / 100.0) as total_amount, -- Convert Kobo to Naira
    o.status::text,
    o.created_at,
    m.store_name::text,
    m.business_address::text,
    m.location,
    ST_AsGeoJSON(o.delivery_location)::jsonb
  from orders o
  join order_items oi on o.id = oi.order_id
  join products p on oi.product_id = p.id
  join merchants m on p.merchant_id = m.id
  where
    o.status = 'ready_for_pickup'  -- CHANGED from 'pending'
    and o.rider_id is null
    and ST_DWithin(
      m.location,
      ST_SetSRID(ST_MakePoint(long, lat), 4326),
      radius_meters
    )
  order by o.created_at desc;
end;
$function$;
