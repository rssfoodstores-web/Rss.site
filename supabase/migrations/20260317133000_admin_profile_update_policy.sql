drop policy if exists "Admins can update profiles" on public.profiles;

create policy "Admins can update profiles"
on public.profiles
for update
using (public.jwt_has_any_role(array['admin', 'sub_admin', 'supa_admin']))
with check (public.jwt_has_any_role(array['admin', 'sub_admin', 'supa_admin']));
