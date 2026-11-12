create function public.fetch_rider_delivery_offers(p_lat double precision, p_lng double precision)
returns table (
    id uuid,
    merchant_name text,
    merchant_address text,
    rider_payout_kobo bigint
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
    rider uuid := auth.uid();
    rider_location public.geography;
begin
    if rider is null or not coalesce(public.jwt_has_role('rider'), false)
        or not exists (select 1 from public.rider_profiles rp where rp.id = rider and rp.status = 'approved')
        or not coalesce(p_lat between -90 and 90 and p_lng between -180 and 180, false) then
        return;
    end if;

    rider_location := public.st_setsrid(public.st_makepoint(p_lng, p_lat), 4326)::public.geography;
    return query
    select orders.id, coalesce(shop.store_name, profile.full_name, 'Merchant')::text,
        coalesce(shop.business_address, profile.address)::text, financials.rider_share_kobo
    from public.orders orders
    join public.profiles profile on profile.id = orders.merchant_id
    left join public.merchants shop on shop.id = orders.merchant_id
    left join public.order_financials financials on financials.order_id = orders.id
    where orders.rider_id is null and orders.status = 'ready_for_pickup' and orders.payment_status = 'paid'
      and public.st_dwithin(coalesce(shop.location, profile.location), rider_location, 5000)
    order by orders.rider_requested_at desc nulls last, orders.created_at desc, orders.id
    limit 50;
end;
$function$;

revoke all on function public.fetch_rider_delivery_offers(double precision,double precision) from public, anon, authenticated, service_role;
grant execute on function public.fetch_rider_delivery_offers(double precision,double precision) to authenticated;
