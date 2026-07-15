alter table public.reward_point_redemptions
    drop constraint if exists reward_point_redemptions_order_id_fkey;

alter table public.reward_point_redemptions
    add constraint reward_point_redemptions_order_id_fkey
    foreign key (order_id)
    references public.orders(id)
    on delete cascade
    deferrable initially deferred;
