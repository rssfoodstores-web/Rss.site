alter table public.orders
    add column if not exists delivery_address_snapshot jsonb;

comment on column public.orders.delivery_address_snapshot is
    'Immutable customer delivery address copied from the profile when the order is created.';

create or replace function public.capture_order_delivery_address_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
    v_profile public.profiles;
    v_address_label text;
begin
    if tg_op = 'UPDATE' then
        new.delivery_address_snapshot := old.delivery_address_snapshot;
        return new;
    end if;

    if new.delivery_address_snapshot is not null then
        return new;
    end if;

    select * into v_profile
    from public.profiles
    where id = new.customer_id;

    v_address_label := nullif(trim(concat_ws(', ',
        nullif(trim(v_profile.house_number), ''),
        nullif(trim(v_profile.street_address), ''),
        nullif(trim(v_profile.state), ''),
        nullif(trim(v_profile.zip_code), '')
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

revoke execute on function public.capture_order_delivery_address_snapshot() from public, anon, authenticated;

drop trigger if exists capture_order_delivery_address_snapshot_before_insert on public.orders;
create trigger capture_order_delivery_address_snapshot_before_insert
before insert on public.orders
for each row execute function public.capture_order_delivery_address_snapshot();

drop trigger if exists protect_order_delivery_address_snapshot_before_update on public.orders;

update public.orders o
set delivery_address_snapshot = jsonb_strip_nulls(jsonb_build_object(
    'address_label', coalesce(
        nullif(trim(concat_ws(', ',
            nullif(trim(p.house_number), ''),
            nullif(trim(p.street_address), ''),
            nullif(trim(p.state), ''),
            nullif(trim(p.zip_code), '')
        )), ''),
        nullif(trim(p.address), '')
    ),
    'house_number', nullif(trim(p.house_number), ''),
    'street_address', nullif(trim(p.street_address), ''),
    'state', nullif(trim(p.state), ''),
    'zip_code', nullif(trim(p.zip_code), ''),
    'captured_at', coalesce(o.created_at, now())
))
from public.profiles p
where p.id = o.customer_id
  and o.delivery_address_snapshot is null;

create trigger protect_order_delivery_address_snapshot_before_update
before update of delivery_address_snapshot on public.orders
for each row execute function public.capture_order_delivery_address_snapshot();

