alter table public.profiles
    add column if not exists location_update_requested_at timestamptz,
    add column if not exists location_last_verified_at timestamptz;

create index if not exists idx_profiles_update_requested
    on public.profiles (location_update_requested_at desc)
    where update_requested = true;

insert into public.app_settings (key, value, description)
values (
    'merchant_location_policy',
    jsonb_build_object(
        'request_cooldown_enabled', true,
        'request_cooldown_hours', 168
    ),
    'Controls how often merchants can request store-location edit access.'
)
on conflict (key) do nothing;

create or replace function public.fetch_nearby_orders(
    lat double precision,
    long double precision,
    radius_meters double precision
)
returns table(
    id uuid,
    total_amount bigint,
    status text,
    created_at timestamptz,
    merchant_name text,
    merchant_address text,
    merchant_location geography,
    delivery_location jsonb
)
language plpgsql
security definer
as $function$
declare
    v_actor uuid := auth.uid();
begin
    if v_actor is null or not public.jwt_has_role('rider') then
        return;
    end if;

    if not exists (
        select 1
        from public.rider_profiles rp
        where rp.id = v_actor
          and rp.status = 'approved'
    ) then
        return;
    end if;

    if lat is null or long is null or radius_meters is null or radius_meters <= 0 then
        return;
    end if;

    return query
    select
        o.id,
        o.total_amount,
        o.status::text,
        o.created_at,
        coalesce(m.store_name, p.full_name, 'RSS Fulfillment')::text,
        coalesce(m.business_address, p.address, 'Location hidden')::text,
        coalesce(m.location, p.location) as merchant_location,
        null::jsonb as delivery_location
    from public.orders o
    join public.profiles p on p.id = o.merchant_id
    left join public.merchants m on m.id = o.merchant_id
    where o.status = 'ready_for_pickup'
      and o.rider_id is null
      and coalesce(m.location, p.location) is not null
      and ST_DWithin(
          coalesce(m.location, p.location),
          ST_SetSRID(ST_MakePoint(long, lat), 4326)::geography,
          radius_meters
      )
    order by o.rider_requested_at desc nulls last, o.created_at desc;
end;
$function$;
