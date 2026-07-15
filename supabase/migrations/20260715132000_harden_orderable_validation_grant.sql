revoke execute on function public.validate_orderable_product(uuid, integer, boolean) from public, anon, authenticated;

grant execute on function public.validate_orderable_product(uuid, integer, boolean) to service_role;
