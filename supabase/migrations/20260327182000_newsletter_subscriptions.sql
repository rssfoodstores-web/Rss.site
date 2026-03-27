create table if not exists public.newsletter_subscriptions (
    id uuid primary key default gen_random_uuid(),
    email text not null,
    source text null,
    created_at timestamptz not null default now()
);

create unique index if not exists newsletter_subscriptions_email_unique
    on public.newsletter_subscriptions (lower(email));

alter table public.newsletter_subscriptions enable row level security;

drop policy if exists "Anyone can subscribe to newsletter" on public.newsletter_subscriptions;
create policy "Anyone can subscribe to newsletter"
on public.newsletter_subscriptions
for insert
to anon, authenticated
with check (true);

drop policy if exists "Admins can view newsletter subscriptions" on public.newsletter_subscriptions;
create policy "Admins can view newsletter subscriptions"
on public.newsletter_subscriptions
for select
to authenticated
using (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']));
