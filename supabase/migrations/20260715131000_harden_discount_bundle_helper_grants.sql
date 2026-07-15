revoke execute on function public.sync_discount_bundle_product_snapshot(uuid) from public, anon, authenticated;
revoke execute on function public.sync_discount_bundles_for_child_product(uuid) from public, anon, authenticated;
revoke execute on function public.validate_discount_bundle_item() from public, anon, authenticated;
revoke execute on function public.handle_discount_bundle_item_change() from public, anon, authenticated;
revoke execute on function public.handle_discount_bundle_change() from public, anon, authenticated;
revoke execute on function public.handle_product_bundle_dependency_change() from public, anon, authenticated;
revoke execute on function public.consume_orderable_product_stock(uuid, integer) from public, anon, authenticated;

grant execute on function public.sync_discount_bundle_product_snapshot(uuid) to service_role;
grant execute on function public.sync_discount_bundles_for_child_product(uuid) to service_role;
grant execute on function public.validate_discount_bundle_item() to service_role;
grant execute on function public.handle_discount_bundle_item_change() to service_role;
grant execute on function public.handle_discount_bundle_change() to service_role;
grant execute on function public.handle_product_bundle_dependency_change() to service_role;
grant execute on function public.consume_orderable_product_stock(uuid, integer) to service_role;
