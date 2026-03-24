create unique index if not exists cook_off_entries_one_per_user_session_idx
    on public.cook_off_entries (session_id, user_id);
