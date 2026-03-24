drop policy if exists "Users can insert own operational roles" on public.user_roles;

create policy "Users can insert own operational roles"
on public.user_roles
for insert
to public
with check (
  auth.uid() = user_id
  and role in ('merchant'::public.app_role, 'agent'::public.app_role, 'rider'::public.app_role)
);

insert into public.user_roles (user_id, role)
select m.id, 'merchant'::public.app_role
from public.merchants m
where not exists (
  select 1
  from public.user_roles ur
  where ur.user_id = m.id
    and ur.role = 'merchant'::public.app_role
);

insert into public.user_roles (user_id, role)
select ap.id, 'agent'::public.app_role
from public.agent_profiles ap
where not exists (
  select 1
  from public.user_roles ur
  where ur.user_id = ap.id
    and ur.role = 'agent'::public.app_role
);

insert into public.user_roles (user_id, role)
select rp.id, 'rider'::public.app_role
from public.rider_profiles rp
where not exists (
  select 1
  from public.user_roles ur
  where ur.user_id = rp.id
    and ur.role = 'rider'::public.app_role
);
