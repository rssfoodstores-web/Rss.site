-- Restrict rider application data to its owner and authorized admins.
-- The former self-update policy was too broad: it allowed riders to update
-- protected fields such as application status on any of their applications.

alter table public.rider_profiles enable row level security;

-- Rider applications are private. The API should only expose reads/writes to
-- signed-in users; admins use the same authenticated client and policy checks.
revoke all on table public.rider_profiles from anon;
revoke all on table public.rider_profiles from authenticated;
grant select, insert, update on table public.rider_profiles to authenticated;

drop policy if exists "Admins can view all rider profiles" on public.rider_profiles;
create policy "Admins can view all rider profiles"
on public.rider_profiles
for select
to authenticated
using (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']));

drop policy if exists "Admins can manage rider profiles" on public.rider_profiles;
create policy "Admins can manage rider profiles"
on public.rider_profiles
for update
to authenticated
using (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']))
with check (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']));

drop policy if exists "Users can insert their own rider profile" on public.rider_profiles;
create policy "Users can insert their own rider profile"
on public.rider_profiles
for insert
to authenticated
with check (auth.uid() = id and status = 'pending');

drop policy if exists "Users can view their own rider profile" on public.rider_profiles;
create policy "Users can view their own rider profile"
on public.rider_profiles
for select
to authenticated
using (auth.uid() = id);

-- Permit corrections/retries only while the application is pending. Requiring
-- pending both before and after the update prevents users changing approval
-- state while allowing the existing form's upsert to recover from a partial
-- first submission.
drop policy if exists "Users can update their own rider profile" on public.rider_profiles;
create policy "Users can update their own pending rider profile"
on public.rider_profiles
for update
to authenticated
using (auth.uid() = id and status = 'pending')
with check (auth.uid() = id and status = 'pending');