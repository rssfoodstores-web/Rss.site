revoke execute on function public.sync_cook_off_reward_points_for_entry(uuid) from public, anon, authenticated;
revoke execute on function public.award_referral_welcome_bonus_for_order(uuid) from public, anon, authenticated;
revoke execute on function public.handle_reward_points_for_cookoff_change() from public, anon, authenticated;
revoke execute on function public.handle_reward_points_for_order_change() from public, anon, authenticated;
revoke execute on function public.cancel_unpaid_order(uuid) from public, anon;

grant execute on function public.sync_cook_off_reward_points_for_entry(uuid) to service_role;
grant execute on function public.award_referral_welcome_bonus_for_order(uuid) to service_role;
grant execute on function public.handle_reward_points_for_cookoff_change() to service_role;
grant execute on function public.handle_reward_points_for_order_change() to service_role;
grant execute on function public.cancel_unpaid_order(uuid) to authenticated, service_role;
