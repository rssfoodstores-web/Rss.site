create table public.promotion_event_tickets (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references public.promotion_campaigns(id),
 user_id uuid not null references auth.users(id),
 issued_at timestamptz not null default now(),
 used_at timestamptz,
 used_by uuid references auth.users(id),
 unique(campaign_id,user_id),
 check ((used_at is null) = (used_by is null))
);
create index promotion_event_tickets_user_idx on public.promotion_event_tickets(user_id);
create index promotion_event_tickets_staff_idx on public.promotion_event_tickets(used_by) where used_by is not null;
alter table public.promotion_event_tickets enable row level security;
revoke all on public.promotion_event_tickets from public,anon,authenticated;
grant select on public.promotion_event_tickets to authenticated;
grant all on public.promotion_event_tickets to service_role;
create policy "Read own event ticket or staff" on public.promotion_event_tickets for select to authenticated
 using (user_id=(select auth.uid()) or (select public.can_manage_promotions()));

create function public.promotion_event_ticket_state(p_campaign uuid,p_issue boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.promotion_campaigns; t public.promotion_event_tickets; live boolean; email text; customer text;
begin
 select * into c from public.promotion_campaigns where id=p_campaign for share;
 if not found or not exists(select 1 from public.promotion_modules where campaign_id=p_campaign and package->'settings'->>'eventTickets'='true') then raise exception 'This ticket promotion is unavailable.'; end if;
 live:=c.status='running' and (c.starts_at is null or c.starts_at<=now()) and (c.ends_at is null or c.ends_at>now());
 if auth.uid() is null then
  if p_issue then raise insufficient_privilege; end if;
  return jsonb_build_object('signedIn',false,'active',live,'ticket',null);
 end if;
 select * into t from public.promotion_event_tickets where campaign_id=p_campaign and user_id=auth.uid();
 if p_issue and t.id is null then
  if not live then raise exception 'Ticket claims are currently closed.'; end if;
  if not exists(select 1 from auth.users where id=auth.uid() and coalesce(is_anonymous,false)=false and nullif(email,'') is not null) then raise exception 'Sign in with your email or Google account to claim a ticket.'; end if;
  insert into public.promotion_event_tickets(campaign_id,user_id) values(p_campaign,auth.uid()) on conflict(campaign_id,user_id) do nothing;
  select * into t from public.promotion_event_tickets where campaign_id=p_campaign and user_id=auth.uid();
 end if;
 select u.email,coalesce(nullif(p.full_name,''),u.email) into email,customer from auth.users u left join public.profiles p on p.id=u.id where u.id=auth.uid();
 return jsonb_build_object('signedIn',true,'active',live,'email',email,'name',customer,'ticket',
  case when t.id is null then null else jsonb_build_object('id',t.id,'issuedAt',t.issued_at,'usedAt',t.used_at) end);
end;
$$;
revoke all on function public.promotion_event_ticket_state(uuid,boolean) from public;
grant execute on function public.promotion_event_ticket_state(uuid,boolean) to anon,authenticated;

create function public.search_promotion_event_tickets(p_campaign uuid,p_search text default '',p_status text default 'all',p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not public.can_manage_promotions() then raise insufficient_privilege; end if;
 if length(coalesce(p_search,''))>200 or p_status not in ('all','unused','used') or p_offset<0 then raise exception 'Invalid search.'; end if;
 with matches as (
  select t.id,t.issued_at,t.used_at,u.email,coalesce(nullif(p.full_name,''),u.email) as name,
   coalesce(nullif(staff.full_name,''),su.email) as used_by
  from public.promotion_event_tickets t join auth.users u on u.id=t.user_id left join public.profiles p on p.id=u.id
  left join auth.users su on su.id=t.used_by left join public.profiles staff on staff.id=t.used_by
  where t.campaign_id=p_campaign and (p_status='all' or p_status='used' and t.used_at is not null or p_status='unused' and t.used_at is null)
   and (coalesce(p_search,'')='' or position(lower(p_search) in lower(coalesce(u.email,'')||' '||coalesce(p.full_name,'')||' '||t.id::text))>0)
 ), page as (select * from matches order by issued_at desc,id limit 50 offset p_offset)
 select jsonb_build_object('total',(select count(*) from matches),'tickets',coalesce((select jsonb_agg(to_jsonb(page) order by issued_at desc,id) from page),'[]'::jsonb),
  'issued',(select count(*) from public.promotion_event_tickets where campaign_id=p_campaign),
  'used',(select count(*) from public.promotion_event_tickets where campaign_id=p_campaign and used_at is not null)) into result;
 return result;
end;
$$;
revoke all on function public.search_promotion_event_tickets(uuid,text,text,integer) from public,anon;
grant execute on function public.search_promotion_event_tickets(uuid,text,text,integer) to authenticated;

create function public.redeem_promotion_event_ticket(p_campaign uuid,p_ticket uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.promotion_event_tickets;
begin
 if auth.uid() is null or not public.can_manage_promotions() then raise insufficient_privilege; end if;
 select * into t from public.promotion_event_tickets where id=p_ticket and campaign_id=p_campaign for update;
 if not found then raise exception 'Ticket not found. Refresh the list.'; end if;
 if t.used_at is not null then raise exception 'This ticket has already been used. Do not allow another spin.'; end if;
 update public.promotion_event_tickets set used_at=now(),used_by=auth.uid() where id=t.id returning * into t;
 perform public.write_audit_log(auth.uid(),'redeem_event_ticket','promotion',p_campaign,jsonb_build_object('ticket',t.id));
 return to_jsonb(t);
end;
$$;
revoke all on function public.redeem_promotion_event_ticket(uuid,uuid) from public,anon;
grant execute on function public.redeem_promotion_event_ticket(uuid,uuid) to authenticated;

create or replace function public.public_promotion_module(p_campaign uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('campaignId',c.id,'name',c.name,'status',c.status,'startsAt',c.starts_at,'endsAt',c.ends_at,
  'package',m.package-'admin','revision',m.revision)
 from public.promotion_modules m join public.promotion_campaigns c on c.id=m.campaign_id where c.id=p_campaign and (
  (c.status='running' and (c.starts_at is null or c.starts_at<=now()) and (c.ends_at is null or c.ends_at>now()))
  or exists(select 1 from public.promotion_tickets t where t.campaign_id=c.id and t.user_id=auth.uid())
  or exists(select 1 from public.promotion_event_tickets t where t.campaign_id=c.id and t.user_id=auth.uid())
  or (auth.uid() is not null and public.can_manage_promotions()));
$$;
