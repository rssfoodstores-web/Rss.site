alter table public.hero_carousel_slides
    add column if not exists display_duration_seconds integer;

update public.hero_carousel_slides
set display_duration_seconds = 7
where display_duration_seconds is null;

alter table public.hero_carousel_slides
    alter column display_duration_seconds set default 7;

alter table public.hero_carousel_slides
    alter column display_duration_seconds set not null;

alter table public.hero_carousel_slides
    drop constraint if exists hero_carousel_slides_display_duration_seconds_chk;

alter table public.hero_carousel_slides
    add constraint hero_carousel_slides_display_duration_seconds_chk
    check (display_duration_seconds between 2 and 60);
