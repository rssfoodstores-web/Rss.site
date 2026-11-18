create function public.can_manage_promotions()
returns boolean language sql stable security definer set search_path = ''
as $$
    select auth.uid() is not null and (
        public.jwt_has_any_role(array['admin','supa_admin']) or
        (public.jwt_has_any_role(array['sub_admin']) and exists (
            select 1 from public.admin_dashboard_permissions
            where user_id = auth.uid() and permission_key = 'promotions'
        ))
    );
$$;
revoke all on function public.can_manage_promotions() from public, anon;
grant execute on function public.can_manage_promotions() to authenticated;

create table public.promotion_campaigns (
    id uuid primary key default gen_random_uuid(),
    name text not null check (char_length(name) between 2 and 100),
    description text not null default '' check (char_length(description) <= 4000),
    status text not null default 'draft' check (status in ('draft','running','paused','stopped')),
    starts_at timestamptz,
    ends_at timestamptz,
    media jsonb not null default '[]'::jsonb check (jsonb_typeof(media) = 'array' and jsonb_array_length(media) <= 20),
    revision integer not null default 1,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (ends_at is null or starts_at is null or ends_at > starts_at),
    check (status <> 'running' or jsonb_array_length(media) > 0)
);
alter table public.promotion_campaigns enable row level security;
revoke all on public.promotion_campaigns from anon, authenticated;
grant select, insert, update on public.promotion_campaigns to authenticated;
grant all on public.promotion_campaigns to service_role;
create policy "Promotion staff manage campaigns" on public.promotion_campaigns
for all to authenticated using ((select public.can_manage_promotions()))
with check ((select public.can_manage_promotions()));

create function public.touch_promotion_campaign()
returns trigger language plpgsql set search_path = '' as $$
begin
    new.updated_at := now();
    new.revision := old.revision + 1;
    return new;
end;
$$;
revoke all on function public.touch_promotion_campaign() from public, anon, authenticated;
create trigger touch_promotion_campaign before update on public.promotion_campaigns
for each row execute function public.touch_promotion_campaign();

create function public.live_promotion_campaigns()
returns jsonb language sql stable security definer set search_path = '' as $$
    select coalesce(jsonb_agg(jsonb_build_object(
        'id',id,'name',name,'description',description,'status',status,
        'starts_at',starts_at,'ends_at',ends_at,'media',media,'revision',revision
    ) order by created_at desc), '[]'::jsonb)
    from public.promotion_campaigns
    where status = 'running' and (starts_at is null or starts_at <= now())
        and (ends_at is null or ends_at > now());
$$;
revoke all on function public.live_promotion_campaigns() from public;
grant execute on function public.live_promotion_campaigns() to anon, authenticated, service_role;
