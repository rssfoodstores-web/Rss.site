alter table public.products
    add column if not exists nutrition_content text[],
    add column if not exists health_benefits text[],
    add column if not exists manufacture_date date,
    add column if not exists expiry_date date,
    add column if not exists suggested_combos text[],
    add column if not exists return_refund_policy text,
    add column if not exists cooked_images text[];
