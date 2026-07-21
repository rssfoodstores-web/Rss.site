create or replace function public.update_reward_system_settings(p_settings jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
    v_actor uuid := auth.uid();
    v_role public.app_role;
    v_settings jsonb := coalesce(p_settings, '{}'::jsonb);
    v_normalized jsonb;
begin
    if v_actor is null then
        return jsonb_build_object('success', false, 'error', 'Authentication required');
    end if;

    select ur.role
    into v_role
    from public.user_roles ur
    where ur.user_id = v_actor
      and ur.role in ('admin', 'sub_admin', 'supa_admin')
    order by case ur.role
        when 'supa_admin' then 1
        when 'admin' then 2
        else 3
    end
    limit 1;

    if v_role is null then
        return jsonb_build_object('success', false, 'error', 'Admin access required');
    end if;

    v_normalized := jsonb_build_object(
        'enabled', coalesce((v_settings ->> 'enabled')::boolean, true),
        'point_value_naira', greatest(coalesce((v_settings ->> 'point_value_naira')::numeric, 1), 1),
        'purchase_points_per_spend_unit', greatest(coalesce((v_settings ->> 'purchase_points_per_spend_unit')::integer, 1), 0),
        'purchase_spend_unit_naira', greatest(coalesce((v_settings ->> 'purchase_spend_unit_naira')::integer, 100), 1),
        'expiration_days', greatest(coalesce((v_settings ->> 'expiration_days')::integer, 365), 1),
        'cook_off_approved_points', greatest(coalesce((v_settings ->> 'cook_off_approved_points')::integer, 50), 0),
        'cook_off_featured_bonus_points', greatest(coalesce((v_settings ->> 'cook_off_featured_bonus_points')::integer, 75), 0),
        'cook_off_winner_bonus_points', greatest(coalesce((v_settings ->> 'cook_off_winner_bonus_points')::integer, 200), 0),
        'referral_welcome_bonus_points', greatest(coalesce((v_settings ->> 'referral_welcome_bonus_points')::integer, 150), 0),
        'points_cover_delivery_fee', false
    );

    insert into public.app_settings (key, value, description)
    values (
        'reward_system_settings',
        v_normalized,
        'Reward points system settings as JSON. Controls earning, redemption, and expiration behavior.'
    )
    on conflict (key) do update
    set value = excluded.value,
        description = excluded.description;

    perform public.write_audit_log(
        v_actor,
        'update_reward_system_settings',
        'app_setting',
        null,
        jsonb_build_object('key', 'reward_system_settings', 'settings', v_normalized)
    );

    return jsonb_build_object('success', true, 'settings', v_normalized);
exception
    when invalid_text_representation or invalid_parameter_value then
        return jsonb_build_object('success', false, 'error', 'Invalid reward settings payload');
end;
$function$;

revoke execute on function public.update_reward_system_settings(jsonb) from public, anon;
grant execute on function public.update_reward_system_settings(jsonb) to authenticated, service_role;
