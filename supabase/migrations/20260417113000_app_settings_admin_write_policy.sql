alter table public.app_settings enable row level security;

drop policy if exists "Admins can manage app settings" on public.app_settings;
create policy "Admins can manage app settings"
on public.app_settings
for all
to authenticated
using (public.jwt_has_any_role(array['admin', 'sub_admin', 'supa_admin']))
with check (public.jwt_has_any_role(array['admin', 'sub_admin', 'supa_admin']));
