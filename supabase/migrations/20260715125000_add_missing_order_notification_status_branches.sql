do $$
declare
    v_definition text;
begin
    select pg_get_functiondef(p.oid)
    into v_definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'notify_order_parties';

    v_definition := replace(
        v_definition,
        'case new.status
            when ''awaiting_agent_acceptance'' then',
        'case new.status
            when ''pending'' then
                null;
            when ''awaiting_agent_acceptance'' then'
    );

    v_definition := replace(
        v_definition,
        'when ''completed'' then
                perform public.create_notification(',
        'when ''delivered'' then
                null;
            when ''completed'' then
                perform public.create_notification('
    );

    v_definition := replace(
        v_definition,
        'when ''refunded'' then
                perform public.create_notification(',
        'when ''cancelled'' then
                null;
            when ''refunded'' then
                perform public.create_notification('
    );

    execute v_definition;
end $$;
