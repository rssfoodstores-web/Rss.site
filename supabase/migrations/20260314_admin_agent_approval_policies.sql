drop policy if exists "Admins can view all agent profiles" on public.agent_profiles;
create policy "Admins can view all agent profiles"
on public.agent_profiles
for select
using (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']));

drop policy if exists "Admins can manage agent profiles" on public.agent_profiles;
create policy "Admins can manage agent profiles"
on public.agent_profiles
for update
using (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']))
with check (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']));

drop policy if exists "Admins can manage merchants" on public.merchants;
create policy "Admins can manage merchants"
on public.merchants
for update
using (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']))
with check (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']));

drop policy if exists "Admins can insert audit logs" on public.audit_logs;
create policy "Admins can insert audit logs"
on public.audit_logs
for insert
with check (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']));

drop policy if exists "Admins can insert user roles" on public.user_roles;
create policy "Admins can insert user roles"
on public.user_roles
for insert
with check (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']));

drop policy if exists "Admins can update user roles" on public.user_roles;
create policy "Admins can update user roles"
on public.user_roles
for update
using (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']))
with check (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']));

drop policy if exists "Admins can delete user roles" on public.user_roles;
create policy "Admins can delete user roles"
on public.user_roles
for delete
using (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']));
