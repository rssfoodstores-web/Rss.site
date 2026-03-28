alter table public.ads
    add column if not exists placement text,
    add column if not exists body text,
    add column if not exists click_url text,
    add column if not exists cta_label text,
    add column if not exists sort_order integer,
    add column if not exists impression_count bigint,
    add column if not exists click_count bigint,
    add column if not exists campaign_starts_at timestamptz,
    add column if not exists campaign_ends_at timestamptz,
    add column if not exists last_impression_at timestamptz,
    add column if not exists last_click_at timestamptz;

update public.ads
set placement = coalesce(placement, 'home_inline'),
    click_url = coalesce(click_url, '/'),
    cta_label = coalesce(cta_label, 'Open campaign'),
    sort_order = coalesce(sort_order, 0),
    impression_count = coalesce(impression_count, 0),
    click_count = coalesce(click_count, 0),
    media_type = coalesce(media_type, 'image');

alter table public.ads
    alter column placement set default 'home_inline',
    alter column placement set not null,
    alter column click_url set default '/',
    alter column click_url set not null,
    alter column cta_label set default 'Open campaign',
    alter column cta_label set not null,
    alter column sort_order set default 0,
    alter column sort_order set not null,
    alter column impression_count set default 0,
    alter column impression_count set not null,
    alter column click_count set default 0,
    alter column click_count set not null,
    alter column media_type set default 'image',
    alter column media_type set not null;

drop trigger if exists ads_set_updated_at on public.ads;
create trigger ads_set_updated_at
before update on public.ads
for each row
execute function public.set_updated_at();

drop index if exists ads_live_lookup_idx;
create index ads_live_lookup_idx
    on public.ads (placement, is_active, sort_order desc, created_at desc);

alter table public.ads
    drop constraint if exists ads_media_type_chk;
alter table public.ads
    add constraint ads_media_type_chk
    check (media_type in ('image', 'video'));

alter table public.ads
    drop constraint if exists ads_click_url_chk;
alter table public.ads
    add constraint ads_click_url_chk
    check (click_url ~* '^(https?://|/)');

alter table public.ads
    drop constraint if exists ads_campaign_window_chk;
alter table public.ads
    add constraint ads_campaign_window_chk
    check (
        campaign_ends_at is null
        or campaign_starts_at is null
        or campaign_ends_at > campaign_starts_at
    );

alter table public.ads
    drop constraint if exists ads_placement_chk;
alter table public.ads
    add constraint ads_placement_chk
    check (
        placement in (
            'home_inline',
            'retail_inline',
            'wholesale_inline',
            'discount_bundles_inline',
            'contact_inline',
            'account_dashboard'
        )
    );

create or replace function public.ad_is_live(
    p_is_active boolean,
    p_campaign_starts_at timestamptz,
    p_campaign_ends_at timestamptz
)
returns boolean
language sql
stable
as $$
    select
        coalesce(p_is_active, false)
        and (p_campaign_starts_at is null or p_campaign_starts_at <= now())
        and (p_campaign_ends_at is null or p_campaign_ends_at >= now());
$$;

create or replace function public.record_ad_impression(p_ad_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_ad public.ads%rowtype;
begin
    select *
    into v_ad
    from public.ads
    where id = p_ad_id
    for update;

    if not found then
        return jsonb_build_object('success', false, 'error', 'Ad not found');
    end if;

    if not public.ad_is_live(v_ad.is_active, v_ad.campaign_starts_at, v_ad.campaign_ends_at) then
        return jsonb_build_object('success', false, 'error', 'Ad is not live');
    end if;

    update public.ads
    set impression_count = coalesce(impression_count, 0) + 1,
        last_impression_at = now(),
        updated_at = now()
    where id = v_ad.id;

    return jsonb_build_object('success', true);
end;
$$;

create or replace function public.record_ad_click(p_ad_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_ad public.ads%rowtype;
begin
    select *
    into v_ad
    from public.ads
    where id = p_ad_id
    for update;

    if not found then
        return jsonb_build_object('success', false, 'error', 'Ad not found');
    end if;

    if not public.ad_is_live(v_ad.is_active, v_ad.campaign_starts_at, v_ad.campaign_ends_at) then
        return jsonb_build_object('success', false, 'error', 'Ad is not live');
    end if;

    update public.ads
    set click_count = coalesce(click_count, 0) + 1,
        last_click_at = now(),
        updated_at = now()
    where id = v_ad.id;

    return jsonb_build_object('success', true);
end;
$$;

grant execute on function public.record_ad_impression(uuid) to anon, authenticated, service_role;
grant execute on function public.record_ad_click(uuid) to anon, authenticated, service_role;

alter table public.ads enable row level security;

drop policy if exists "Enable read access for all users" on public.ads;
drop policy if exists "Enable insert for authenticated users" on public.ads;
drop policy if exists "Enable update for authenticated users" on public.ads;
drop policy if exists "Enable delete for authenticated users" on public.ads;

create policy "Public can view live ads"
on public.ads
for select
using (public.ad_is_live(is_active, campaign_starts_at, campaign_ends_at));

create policy "Admins can view all ads"
on public.ads
for select
using (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']));

create policy "Admins can insert ads"
on public.ads
for insert
with check (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']));

create policy "Admins can update ads"
on public.ads
for update
using (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']))
with check (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']));

create policy "Admins can delete ads"
on public.ads
for delete
using (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']));
