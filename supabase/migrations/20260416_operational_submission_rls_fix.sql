drop policy if exists "Users can update their own agent profile" on public.agent_profiles;
create policy "Users can update their own agent profile"
on public.agent_profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Users can insert their own rider profile" on public.rider_profiles;
create policy "Users can insert their own rider profile"
on public.rider_profiles
for insert
with check (auth.uid() = id);

drop policy if exists "Users can view their own rider profile" on public.rider_profiles;
create policy "Users can view their own rider profile"
on public.rider_profiles
for select
using (auth.uid() = id);

drop policy if exists "Users can update their own rider profile" on public.rider_profiles;
create policy "Users can update their own rider profile"
on public.rider_profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);
