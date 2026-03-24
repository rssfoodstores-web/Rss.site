create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

create table if not exists public.hero_carousel_slides (
    id uuid primary key default uuid_generate_v4(),
    placement text not null default 'storefront',
    marketing_mode text not null default 'standard',
    eyebrow_text text,
    title text not null,
    highlight_text text,
    body_text text,
    button_text text,
    button_url text,
    media_type text not null check (media_type in ('image', 'video')),
    media_url text not null,
    media_public_id text not null,
    thumbnail_url text,
    thumbnail_public_id text,
    sort_order integer not null default 0,
    is_active boolean not null default true,
    created_by uuid references public.profiles(id) on delete set null,
    updated_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.cook_off_sessions (
    id uuid primary key default uuid_generate_v4(),
    slug text not null unique,
    month_label text not null,
    title text not null,
    theme text not null,
    summary text,
    description text,
    rules text,
    prizes text,
    cta_text text not null default 'Submit your entry',
    hero_media_type text check (hero_media_type in ('image', 'video')),
    hero_media_url text,
    hero_media_public_id text,
    hero_media_thumbnail_url text,
    hero_media_thumbnail_public_id text,
    status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
    created_by uuid references public.profiles(id) on delete set null,
    updated_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists cook_off_sessions_one_active_idx
    on public.cook_off_sessions ((status))
    where status = 'active';

create table if not exists public.cook_off_entries (
    id uuid primary key default uuid_generate_v4(),
    session_id uuid not null references public.cook_off_sessions(id) on delete cascade,
    user_id uuid not null references public.profiles(id) on delete cascade,
    entry_code text not null unique,
    recipe_name text not null,
    ingredients text not null,
    cooking_process_video_url text not null,
    cooking_process_video_public_id text not null,
    presentation_video_url text not null,
    presentation_video_public_id text not null,
    submitter_name text not null,
    submitter_email text not null,
    submitter_phone text,
    status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
    admin_feedback text,
    admin_creativity_score integer check (admin_creativity_score between 0 and 100),
    admin_presentation_score integer check (admin_presentation_score between 0 and 100),
    is_featured boolean not null default false,
    winner_position integer check (winner_position is null or winner_position > 0),
    reviewed_by uuid references public.profiles(id) on delete set null,
    reviewed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.cook_off_votes (
    id uuid primary key default uuid_generate_v4(),
    session_id uuid not null references public.cook_off_sessions(id) on delete cascade,
    entry_id uuid not null references public.cook_off_entries(id) on delete cascade,
    voter_id uuid not null references public.profiles(id) on delete cascade,
    created_at timestamptz not null default now(),
    unique (session_id, voter_id)
);

create index if not exists hero_carousel_slides_placement_order_idx
    on public.hero_carousel_slides (placement, is_active, sort_order, created_at desc);

create index if not exists cook_off_entries_session_status_idx
    on public.cook_off_entries (session_id, status, created_at desc);

create index if not exists cook_off_entries_user_created_idx
    on public.cook_off_entries (user_id, created_at desc);

create index if not exists cook_off_entries_session_featured_idx
    on public.cook_off_entries (session_id, is_featured, winner_position, created_at desc);

create index if not exists cook_off_votes_entry_idx
    on public.cook_off_votes (entry_id);

create or replace function public.assign_cook_off_entry_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_code text;
begin
    if new.entry_code is not null and btrim(new.entry_code) <> '' then
        return new;
    end if;

    loop
        v_code := 'COF-' || to_char(now(), 'YYMM') || '-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
        exit when not exists (
            select 1
            from public.cook_off_entries
            where entry_code = v_code
        );
    end loop;

    new.entry_code := v_code;
    return new;
end;
$$;

drop trigger if exists hero_carousel_slides_set_updated_at on public.hero_carousel_slides;
create trigger hero_carousel_slides_set_updated_at
before update on public.hero_carousel_slides
for each row
execute function public.set_updated_at();

drop trigger if exists cook_off_sessions_set_updated_at on public.cook_off_sessions;
create trigger cook_off_sessions_set_updated_at
before update on public.cook_off_sessions
for each row
execute function public.set_updated_at();

drop trigger if exists cook_off_entries_set_updated_at on public.cook_off_entries;
create trigger cook_off_entries_set_updated_at
before update on public.cook_off_entries
for each row
execute function public.set_updated_at();

drop trigger if exists cook_off_entries_assign_code on public.cook_off_entries;
create trigger cook_off_entries_assign_code
before insert on public.cook_off_entries
for each row
execute function public.assign_cook_off_entry_code();

create or replace view public.cook_off_vote_totals as
select
    session_id,
    entry_id,
    count(*)::bigint as vote_count
from public.cook_off_votes
group by session_id, entry_id;

create or replace view public.cook_off_entry_scoreboard as
with vote_totals as (
    select
        session_id,
        entry_id,
        vote_count
    from public.cook_off_vote_totals
),
approved_entries as (
    select
        e.id as entry_id,
        e.session_id,
        e.user_id,
        e.entry_code,
        e.recipe_name,
        e.submitter_name,
        e.submitter_email,
        e.submitter_phone,
        e.cooking_process_video_url,
        e.cooking_process_video_public_id,
        e.presentation_video_url,
        e.presentation_video_public_id,
        e.is_featured,
        e.winner_position,
        e.admin_feedback,
        e.admin_creativity_score,
        e.admin_presentation_score,
        e.created_at
    from public.cook_off_entries e
    where e.status = 'approved'
)
select
    e.entry_id,
    e.session_id,
    e.user_id,
    e.entry_code,
    e.recipe_name,
    e.submitter_name,
    e.submitter_email,
    e.submitter_phone,
    e.cooking_process_video_url,
    e.cooking_process_video_public_id,
    e.presentation_video_url,
    e.presentation_video_public_id,
    e.is_featured,
    e.winner_position,
    e.admin_feedback,
    e.admin_creativity_score,
    e.admin_presentation_score,
    case
        when e.admin_creativity_score is null and e.admin_presentation_score is null then null
        when e.admin_creativity_score is not null and e.admin_presentation_score is not null then round(((e.admin_creativity_score + e.admin_presentation_score)::numeric / 2.0), 2)
        else coalesce(e.admin_creativity_score, e.admin_presentation_score)::numeric
    end as admin_score,
    coalesce(v.vote_count, 0)::bigint as vote_count,
    e.created_at
from approved_entries e
left join vote_totals v
    on v.entry_id = e.entry_id
   and v.session_id = e.session_id;

grant select on public.cook_off_vote_totals to anon, authenticated, service_role;
grant select on public.cook_off_entry_scoreboard to anon, authenticated, service_role;

create or replace function public.cast_cook_off_vote(p_entry_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_voter_id uuid := auth.uid();
    v_entry record;
begin
    if v_voter_id is null then
        return jsonb_build_object('success', false, 'error', 'Authentication required');
    end if;

    select
        e.id,
        e.session_id,
        e.user_id,
        e.status,
        s.status as session_status
    into v_entry
    from public.cook_off_entries e
    join public.cook_off_sessions s
        on s.id = e.session_id
    where e.id = p_entry_id
    limit 1;

    if not found then
        return jsonb_build_object('success', false, 'error', 'Cook-Off entry not found');
    end if;

    if v_entry.status <> 'approved' then
        return jsonb_build_object('success', false, 'error', 'Only approved entries can receive votes');
    end if;

    if v_entry.session_status <> 'active' then
        return jsonb_build_object('success', false, 'error', 'Voting is closed for this Cook-Off session');
    end if;

    if v_entry.user_id = v_voter_id then
        return jsonb_build_object('success', false, 'error', 'You cannot vote for your own entry');
    end if;

    if exists (
        select 1
        from public.cook_off_votes
        where session_id = v_entry.session_id
          and voter_id = v_voter_id
    ) then
        return jsonb_build_object('success', false, 'error', 'You have already voted in this Cook-Off session');
    end if;

    insert into public.cook_off_votes (
        session_id,
        entry_id,
        voter_id
    )
    values (
        v_entry.session_id,
        v_entry.id,
        v_voter_id
    );

    return jsonb_build_object('success', true, 'entry_id', v_entry.id, 'session_id', v_entry.session_id);
end;
$$;

drop policy if exists "Public can view active hero slides" on public.hero_carousel_slides;
create policy "Public can view active hero slides"
on public.hero_carousel_slides
for select
using (is_active = true);

drop policy if exists "Admins can manage hero slides" on public.hero_carousel_slides;
create policy "Admins can manage hero slides"
on public.hero_carousel_slides
for all
using (public.jwt_has_any_role(array['admin', 'sub_admin', 'supa_admin']))
with check (public.jwt_has_any_role(array['admin', 'sub_admin', 'supa_admin']));

drop policy if exists "Public can view live cook off sessions" on public.cook_off_sessions;
create policy "Public can view live cook off sessions"
on public.cook_off_sessions
for select
using (status <> 'draft');

drop policy if exists "Admins can manage cook off sessions" on public.cook_off_sessions;
create policy "Admins can manage cook off sessions"
on public.cook_off_sessions
for all
using (public.jwt_has_any_role(array['admin', 'sub_admin', 'supa_admin']))
with check (public.jwt_has_any_role(array['admin', 'sub_admin', 'supa_admin']));

drop policy if exists "Public can view approved cook off entries" on public.cook_off_entries;
create policy "Public can view approved cook off entries"
on public.cook_off_entries
for select
using (status = 'approved');

drop policy if exists "Users can view own cook off entries" on public.cook_off_entries;
create policy "Users can view own cook off entries"
on public.cook_off_entries
for select
using (auth.uid() = user_id);

drop policy if exists "Users can submit own cook off entries" on public.cook_off_entries;
create policy "Users can submit own cook off entries"
on public.cook_off_entries
for insert
with check (
    auth.uid() = user_id
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and admin_feedback is null
    and admin_creativity_score is null
    and admin_presentation_score is null
    and is_featured = false
    and winner_position is null
);

drop policy if exists "Users can edit own pending cook off entries" on public.cook_off_entries;
create policy "Users can edit own pending cook off entries"
on public.cook_off_entries
for update
using (
    auth.uid() = user_id
    and status = 'pending'
)
with check (
    auth.uid() = user_id
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and admin_feedback is null
    and admin_creativity_score is null
    and admin_presentation_score is null
    and is_featured = false
    and winner_position is null
);

drop policy if exists "Users can delete own pending cook off entries" on public.cook_off_entries;
create policy "Users can delete own pending cook off entries"
on public.cook_off_entries
for delete
using (
    auth.uid() = user_id
    and status = 'pending'
);

drop policy if exists "Admins can manage cook off entries" on public.cook_off_entries;
create policy "Admins can manage cook off entries"
on public.cook_off_entries
for all
using (public.jwt_has_any_role(array['admin', 'sub_admin', 'supa_admin']))
with check (public.jwt_has_any_role(array['admin', 'sub_admin', 'supa_admin']));

drop policy if exists "Users can view own cook off votes" on public.cook_off_votes;
create policy "Users can view own cook off votes"
on public.cook_off_votes
for select
using (auth.uid() = voter_id);

drop policy if exists "Admins can view cook off votes" on public.cook_off_votes;
create policy "Admins can view cook off votes"
on public.cook_off_votes
for select
using (public.jwt_has_any_role(array['admin', 'sub_admin', 'supa_admin']));

alter table public.hero_carousel_slides enable row level security;
alter table public.cook_off_sessions enable row level security;
alter table public.cook_off_entries enable row level security;
alter table public.cook_off_votes enable row level security;
