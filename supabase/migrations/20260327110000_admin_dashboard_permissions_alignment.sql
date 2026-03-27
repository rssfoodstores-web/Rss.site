create table if not exists public.admin_dashboard_permissions (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    permission_key text not null,
    granted_by uuid null references public.profiles(id) on delete set null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    unique (user_id, permission_key)
);

create index if not exists admin_dashboard_permissions_user_id_idx
    on public.admin_dashboard_permissions (user_id);

create index if not exists admin_dashboard_permissions_permission_key_idx
    on public.admin_dashboard_permissions (permission_key);

create or replace function public.touch_admin_dashboard_permissions_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := timezone('utc', now());
    return new;
end;
$$;

drop trigger if exists admin_dashboard_permissions_set_updated_at on public.admin_dashboard_permissions;
create trigger admin_dashboard_permissions_set_updated_at
before update on public.admin_dashboard_permissions
for each row
execute function public.touch_admin_dashboard_permissions_updated_at();

alter table public.admin_dashboard_permissions enable row level security;

drop policy if exists "Admins manage dashboard permissions" on public.admin_dashboard_permissions;
drop policy if exists "Users can view own dashboard permissions" on public.admin_dashboard_permissions;

create policy "Users can view own dashboard permissions"
on public.admin_dashboard_permissions
for select
using (
    auth.uid() = user_id
    or public.jwt_has_any_role(array['admin', 'supa_admin'])
);

create policy "Admins manage dashboard permissions"
on public.admin_dashboard_permissions
for all
using (public.jwt_has_any_role(array['admin', 'supa_admin']))
with check (public.jwt_has_any_role(array['admin', 'supa_admin']));

grant select, insert, update, delete on public.admin_dashboard_permissions to authenticated, service_role;

do $$
declare
    v_constraint_name text;
begin
    for v_constraint_name in
        select conname
        from pg_constraint
        where conrelid = 'public.admin_dashboard_permissions'::regclass
          and contype = 'c'
          and pg_get_constraintdef(oid) ilike '%permission_key%'
    loop
        execute format(
            'alter table public.admin_dashboard_permissions drop constraint %I',
            v_constraint_name
        );
    end loop;
end;
$$;

alter table public.admin_dashboard_permissions
add constraint admin_dashboard_permissions_permission_key_check
check (
    permission_key in (
        'dashboard',
        'approvals',
        'orders',
        'notifications',
        'messages',
        'reports',
        'delivery_settings',
        'location_access',
        'ads',
        'referrals',
        'rewards',
        'cook_off',
        'discount_bundles',
        'contact',
        'faqs',
        'terms',
        'privacy',
        'support',
        'accounts'
    )
);
