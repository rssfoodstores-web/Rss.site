create table public.promotion_modules (
    campaign_id uuid primary key references public.promotion_campaigns(id),
    package jsonb not null check (jsonb_typeof(package) = 'object'),
    revision integer not null default 1,
    created_at timestamptz not null default now(),
    opens_at timestamptz,
    updated_at timestamptz not null default now()
);
create table public.promotion_tickets (
    id uuid primary key default gen_random_uuid(),
    campaign_id uuid not null references public.promotion_modules(campaign_id),
    user_id uuid not null references auth.users(id),
    created_at timestamptz not null default now(),
    used_at timestamptz,
    unique(campaign_id,user_id)
);
create index promotion_tickets_user_idx on public.promotion_tickets(user_id);
create table public.promotion_entries (
    id uuid primary key default gen_random_uuid(),
    ticket_id uuid not null unique references public.promotion_tickets(id),
    campaign_id uuid not null references public.promotion_modules(campaign_id),
    user_id uuid not null references auth.users(id),
    prize_id text not null,
    label text not null,
    fulfillment text not null check (fulfillment in ('manual','none')),
    claim_status text not null check (claim_status in ('won','requested','fulfilled','not_required')),
    created_at timestamptz not null default now(),
    claimed_at timestamptz,
    fulfilled_at timestamptz,
    fulfilled_by uuid references auth.users(id),
    unique(campaign_id,user_id)
);
create index promotion_entries_user_idx on public.promotion_entries(user_id);
create index promotion_entries_prize_idx on public.promotion_entries(campaign_id,prize_id);
create index promotion_entries_fulfiller_idx on public.promotion_entries(fulfilled_by) where fulfilled_by is not null;

alter table public.promotion_modules enable row level security;
alter table public.promotion_tickets enable row level security;
alter table public.promotion_entries enable row level security;
revoke all on public.promotion_modules,public.promotion_tickets,public.promotion_entries from anon,authenticated;
grant select on public.promotion_modules,public.promotion_tickets,public.promotion_entries to authenticated;
grant all on public.promotion_modules,public.promotion_tickets,public.promotion_entries to service_role;
create policy "Promotion staff read module" on public.promotion_modules for select to authenticated using ((select public.can_manage_promotions()));
create policy "Ticket owner or promotion staff read" on public.promotion_tickets for select to authenticated using (user_id=(select auth.uid()) or (select public.can_manage_promotions()));
create policy "Entry owner or promotion staff read" on public.promotion_entries for select to authenticated using (user_id=(select auth.uid()) or (select public.can_manage_promotions()));

create function public.open_promotion_module()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
    if new.status='running' then
        update public.promotion_modules set opens_at=greatest(now(),coalesce(new.starts_at,now()))
        where campaign_id=new.id and opens_at is null;
    end if;
    return new;
end;
$$;
revoke all on function public.open_promotion_module() from public,anon,authenticated;
create trigger open_promotion_module after update of status on public.promotion_campaigns
for each row execute function public.open_promotion_module();

create function public.save_promotion_module(p_campaign uuid,p_package jsonb,p_revision integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c public.promotion_campaigns; m public.promotion_modules;
begin
    if auth.uid() is null or not public.can_manage_promotions() then raise insufficient_privilege; end if;
    select * into c from public.promotion_campaigns where id=p_campaign for update;
    if not found then raise exception 'Save the campaign details first.'; end if;
    select * into m from public.promotion_modules where campaign_id=p_campaign for update;
    if coalesce(m.revision,0) is distinct from p_revision then raise exception 'This module changed. Reload before saving.'; end if;
    if p_package->>'version' is distinct from '1' or jsonb_typeof(p_package->'rules') is distinct from 'object'
       or jsonb_typeof(p_package->'prizes') is distinct from 'array'
       or jsonb_array_length(p_package->'prizes') not between 1 and 20 then raise exception 'Invalid module package.'; end if;
    if exists(select 1 from public.promotion_tickets where campaign_id=p_campaign) and
        (m.package->'rules' is distinct from p_package->'rules' or m.package->'prizes' is distinct from p_package->'prizes') then
        raise exception 'Tickets already exist. Keep the original rules and prizes, or create a new promotion.';
    end if;
    insert into public.promotion_modules(campaign_id,package,opens_at)
    values(p_campaign,p_package,case when c.status='running' then greatest(now(),coalesce(c.starts_at,now())) end)
    on conflict(campaign_id) do update set package=excluded.package,revision=promotion_modules.revision+1,updated_at=now();
    perform public.write_audit_log(auth.uid(),'save_promotion_module','promotion',p_campaign,'{}'::jsonb);
    return (select to_jsonb(row) from public.promotion_modules row where campaign_id=p_campaign);
end;
$$;
revoke all on function public.save_promotion_module(uuid,jsonb,integer) from public,anon;
grant execute on function public.save_promotion_module(uuid,jsonb,integer) to authenticated;

create function public.public_promotion_module(p_campaign uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
    select jsonb_build_object('campaignId',c.id,'name',c.name,'status',c.status,'startsAt',c.starts_at,'endsAt',c.ends_at,
        'package',m.package-'admin','revision',m.revision)
    from public.promotion_modules m join public.promotion_campaigns c on c.id=m.campaign_id
    where c.id=p_campaign and (
        (c.status='running' and (c.starts_at is null or c.starts_at<=now()) and (c.ends_at is null or c.ends_at>now()))
        or exists(select 1 from public.promotion_tickets t where t.campaign_id=c.id and t.user_id=auth.uid())
        or (auth.uid() is not null and public.can_manage_promotions())
    );
$$;
-- can_manage_promotions is deliberately not publicly callable. This function is its guarded caller.
revoke all on function public.public_promotion_module(uuid) from public;
grant execute on function public.public_promotion_module(uuid) to anon,authenticated;

create function public.promotion_module_state(p_campaign uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
    actor uuid:=auth.uid(); c public.promotion_campaigns; m public.promotion_modules;
    t public.promotion_tickets; e public.promotion_entries; rules jsonb; reasons jsonb:='[]';
    active boolean; created timestamptz; verified timestamptz; email text; balance bigint;
    purchases bigint; spend bigint; stock bigint;
begin
    select * into c from public.promotion_campaigns where id=p_campaign for share;
    select * into m from public.promotion_modules where campaign_id=p_campaign for update;
    if m.campaign_id is null then raise exception 'This promotion module is unavailable.'; end if;
    active:=c.status='running' and (c.starts_at is null or c.starts_at<=now()) and (c.ends_at is null or c.ends_at>now());
    select * into t from public.promotion_tickets where campaign_id=p_campaign and user_id=actor;
    select * into e from public.promotion_entries where campaign_id=p_campaign and user_id=actor;
    if actor is null then reasons:='["Sign in to participate."]';
    elsif e.id is not null then reasons:='[]';
    elsif not active then reasons:='["This promotion is not accepting entries right now."]';
    else
        rules:=m.package->'rules';
        select created_at,email_confirmed_at,u.email into created,verified,email from auth.users u where id=actor;
        if (rules->>'newAccountsOnly')::boolean and (m.opens_at is null or created<m.opens_at) then
            reasons:=reasons||jsonb_build_array('This promotion is for accounts created after it opened.');
        end if;
        if (rules->>'verifiedEmail')::boolean and (verified is null or coalesce(email,'')='') then reasons:=reasons||jsonb_build_array('Verify your email to qualify.'); end if;
        if (rules->>'minWalletKobo')::bigint>0 then
            perform id from public.wallets where owner_id=actor and type='customer' for share;
            select coalesce(sum(w.balance),0) into balance from public.wallets w where owner_id=actor and type='customer';
            if balance<(rules->>'minWalletKobo')::bigint then reasons:=reasons||jsonb_build_array('Your available customer wallet balance is below this promotion’s minimum.'); end if;
        end if;
        if (rules->>'minCompletedOrders')::integer>0 or (rules->>'minSpendKobo')::bigint>0 or jsonb_array_length(rules->'productIds')>0 then
            select count(distinct coalesce(g.id,o.id)),coalesce(sum(greatest(coalesce(o.subtotal_amount_kobo,0)-coalesce(o.points_discount_kobo,0),0)),0)
            into purchases,spend from public.orders o
            left join public.delivery_checkout_groups g on g.order_ids @> array[o.id]
            where o.customer_id=actor and o.payment_status='paid' and o.status in ('completed','delivered')
                and (g.id is null or not exists (select 1 from public.orders sibling where sibling.id=any(g.order_ids)
                    and (sibling.payment_status is distinct from 'paid' or sibling.status not in ('completed','delivered'))))
                and (rules->>'purchaseSince' is null or o.created_at>=(rules->>'purchaseSince')::timestamptz)
                and (jsonb_array_length(rules->'productIds')=0 or exists (
                    select 1 from public.order_items oi where oi.order_id=o.id
                    and oi.product_id::text in (select jsonb_array_elements_text(rules->'productIds'))));
            if purchases<(rules->>'minCompletedOrders')::integer then reasons:=reasons||jsonb_build_array('Complete the required number of qualifying purchases.'); end if;
            if spend<(rules->>'minSpendKobo')::bigint then reasons:=reasons||jsonb_build_array('Your qualifying purchase spend is below the campaign minimum.'); end if;
            if jsonb_array_length(rules->'productIds')>0 and purchases=0 then reasons:=reasons||jsonb_build_array('Complete a purchase containing a qualifying product.'); end if;
        end if;
        select coalesce(sum((p->>'quantity')::bigint),0)-(select count(*) from public.promotion_entries where campaign_id=p_campaign)
        into stock from jsonb_array_elements(m.package->'prizes') p;
        if stock<=0 then reasons:=reasons||jsonb_build_array('All prizes in this promotion have been allocated.'); end if;
        if jsonb_array_length(reasons)=0 and t.id is null then
            insert into public.promotion_tickets(campaign_id,user_id) values(p_campaign,actor) on conflict do nothing;
            select * into t from public.promotion_tickets where campaign_id=p_campaign and user_id=actor;
        end if;
    end if;
    return jsonb_build_object('signedIn',actor is not null,'active',active,'eligible',actor is not null and jsonb_array_length(reasons)=0,
        'reasons',reasons,'ticket',case when t.id is null then null when t.used_at is null then 'available' else 'used' end,
        'prize',case when e.id is null then null else jsonb_build_object('id',e.prize_id,'label',e.label,'fulfillment',e.fulfillment,'claimStatus',e.claim_status,'reference',e.id) end,
        'settings',case when active or t.id is not null then m.package->'settings' else '{}'::jsonb end);
end;
$$;
revoke all on function public.promotion_module_state(uuid) from public;
grant execute on function public.promotion_module_state(uuid) to anon,authenticated;

create function public.enter_promotion_module(p_campaign uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s jsonb; m public.promotion_modules; p jsonb; available jsonb:='[]'; total bigint:=0;
    draw numeric; cumulative bigint:=0; bytes bytea; consumed bigint;
begin
    if auth.uid() is null then raise exception 'Sign in to use your ticket.'; end if;
    s:=public.promotion_module_state(p_campaign);
    if s->>'ticket'='used' then return s; end if;
    if not (s->>'active')::boolean or not (s->>'eligible')::boolean then raise exception '%',coalesce(s->'reasons'->>0,'You do not qualify for this entry.'); end if;
    select * into strict m from public.promotion_modules where campaign_id=p_campaign;
    for p in select jsonb_array_elements(m.package->'prizes') loop
        select count(*) into consumed from public.promotion_entries where campaign_id=p_campaign and prize_id=p->>'id';
        if consumed<(p->>'quantity')::bigint then available:=available||jsonb_build_array(p);total:=total+(p->>'weight')::bigint; end if;
    end loop;
    if total=0 then raise exception 'All prizes have been allocated.'; end if;
    bytes:=extensions.gen_random_bytes(4);
    draw:=(get_byte(bytes,0)::numeric*16777216+get_byte(bytes,1)*65536+get_byte(bytes,2)*256+get_byte(bytes,3))/4294967296*total;
    for p in select jsonb_array_elements(available) loop
        cumulative:=cumulative+(p->>'weight')::bigint;
        if draw<cumulative then
            insert into public.promotion_entries(ticket_id,campaign_id,user_id,prize_id,label,fulfillment,claim_status)
            select id,p_campaign,auth.uid(),p->>'id',p->>'label',p->>'fulfillment',case when p->>'fulfillment'='none' then 'not_required' else 'won' end
            from public.promotion_tickets where campaign_id=p_campaign and user_id=auth.uid();
            update public.promotion_tickets set used_at=now() where campaign_id=p_campaign and user_id=auth.uid();
            exit;
        end if;
    end loop;
    return public.promotion_module_state(p_campaign);
end;
$$;
revoke all on function public.enter_promotion_module(uuid) from public,anon;
grant execute on function public.enter_promotion_module(uuid) to authenticated;

create function public.claim_promotion_prize(p_campaign uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
    if auth.uid() is null then raise insufficient_privilege; end if;
    update public.promotion_entries set claim_status='requested',claimed_at=now()
    where campaign_id=p_campaign and user_id=auth.uid() and claim_status='won' and fulfillment='manual';
    if not exists(select 1 from public.promotion_entries where campaign_id=p_campaign and user_id=auth.uid()) then raise exception 'Use your ticket before claiming a prize.'; end if;
    return public.promotion_module_state(p_campaign);
end;
$$;
revoke all on function public.claim_promotion_prize(uuid) from public,anon;
grant execute on function public.claim_promotion_prize(uuid) to authenticated;

create function public.promotion_module_summary(p_campaign uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare m public.promotion_modules;
begin
    if auth.uid() is null or not public.can_manage_promotions() then raise insufficient_privilege; end if;
    select * into strict m from public.promotion_modules where campaign_id=p_campaign;
    return jsonb_build_object(
        'tickets',(select count(*) from public.promotion_tickets where campaign_id=p_campaign),
        'used',(select count(*) from public.promotion_entries where campaign_id=p_campaign),
        'claimed',(select count(*) from public.promotion_entries where campaign_id=p_campaign and claim_status in ('requested','fulfilled')),
        'fulfilled',(select count(*) from public.promotion_entries where campaign_id=p_campaign and claim_status='fulfilled'),
        'locked',exists(select 1 from public.promotion_tickets where campaign_id=p_campaign),
        'rules',m.package->'rules','settings',m.package->'settings',
        'prizes',(select jsonb_agg(p||jsonb_build_object('remaining',(p->>'quantity')::bigint-(select count(*) from public.promotion_entries e where e.campaign_id=p_campaign and e.prize_id=p->>'id'))) from jsonb_array_elements(m.package->'prizes') p),
        'entries',(select coalesce(jsonb_agg(row),'[]'::jsonb) from (
            select e.id as reference,coalesce(nullif(pr.full_name,''),'Customer') as customer,e.label,e.claim_status as "claimStatus",e.created_at as "createdAt"
            from public.promotion_entries e left join public.profiles pr on pr.id=e.user_id
            where e.campaign_id=p_campaign order by e.created_at desc limit 100
        ) row)
    );
end;
$$;
revoke all on function public.promotion_module_summary(uuid) from public,anon;
grant execute on function public.promotion_module_summary(uuid) to authenticated;

create function public.fulfill_promotion_prize(p_campaign uuid,p_reference uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
    if auth.uid() is null or not public.can_manage_promotions() then raise insufficient_privilege; end if;
    update public.promotion_entries set claim_status='fulfilled',fulfilled_at=now(),fulfilled_by=auth.uid()
    where campaign_id=p_campaign and id=p_reference and claim_status='requested';
    if not found and not exists(select 1 from public.promotion_entries where campaign_id=p_campaign and id=p_reference and claim_status='fulfilled') then raise exception 'This prize has no pending claim.'; end if;
    perform public.write_audit_log(auth.uid(),'fulfill_promotion_prize','promotion',p_campaign,jsonb_build_object('reference',p_reference));
    return public.promotion_module_summary(p_campaign);
end;
$$;
revoke all on function public.fulfill_promotion_prize(uuid,uuid) from public,anon;
grant execute on function public.fulfill_promotion_prize(uuid,uuid) to authenticated;

create function public.update_promotion_module_settings(p_campaign uuid,p_settings jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
    if auth.uid() is null or not public.can_manage_promotions() then raise insufficient_privilege; end if;
    if jsonb_typeof(p_settings) is distinct from 'object' or octet_length(p_settings::text)>70000 then raise exception 'Invalid settings.'; end if;
    update public.promotion_modules set package=jsonb_set(package,'{settings}',p_settings),revision=revision+1,updated_at=now() where campaign_id=p_campaign;
    return public.promotion_module_summary(p_campaign);
end;
$$;
revoke all on function public.update_promotion_module_settings(uuid,jsonb) from public,anon;
grant execute on function public.update_promotion_module_settings(uuid,jsonb) to authenticated;
