do $$
begin
    if to_regprocedure('public.gen_random_bytes(integer)') is null then
        execute $function$
            create function public.gen_random_bytes(p_size integer)
            returns bytea
            language plpgsql
            volatile
            set search_path = public
            as $body$
            declare
                v_size integer := greatest(coalesce(p_size, 0), 0);
                v_hex text := '';
            begin
                if v_size = 0 then
                    return ''::bytea;
                end if;

                while char_length(v_hex) < (v_size * 2) loop
                    if to_regprocedure('extensions.gen_random_uuid()') is not null then
                        v_hex := v_hex || replace(extensions.gen_random_uuid()::text, '-', '');
                    elsif to_regprocedure('public.gen_random_uuid()') is not null then
                        v_hex := v_hex || replace(public.gen_random_uuid()::text, '-', '');
                    elsif to_regprocedure('extensions.uuid_generate_v4()') is not null then
                        v_hex := v_hex || replace(extensions.uuid_generate_v4()::text, '-', '');
                    elsif to_regprocedure('public.uuid_generate_v4()') is not null then
                        v_hex := v_hex || replace(public.uuid_generate_v4()::text, '-', '');
                    else
                        raise exception 'No UUID generator is available to emulate gen_random_bytes().';
                    end if;
                end loop;

                return decode(substr(v_hex, 1, v_size * 2), 'hex');
            end;
            $body$;
        $function$;
    end if;
end
$$;
