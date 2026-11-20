create or replace function public.promotion_event_ticket_state(p_campaign uuid,p_issue boolean default false)
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
  if not exists(select 1 from auth.users u where u.id=auth.uid() and coalesce(u.is_anonymous,false)=false and nullif(u.email,'') is not null) then raise exception 'Sign in with your email or Google account to claim a ticket.'; end if;
  insert into public.promotion_event_tickets(campaign_id,user_id) values(p_campaign,auth.uid()) on conflict(campaign_id,user_id) do nothing;
  select * into t from public.promotion_event_tickets where campaign_id=p_campaign and user_id=auth.uid();
 end if;
 select u.email,coalesce(nullif(p.full_name,''),u.email) into email,customer from auth.users u left join public.profiles p on p.id=u.id where u.id=auth.uid();
 return jsonb_build_object('signedIn',true,'active',live,'email',email,'name',customer,'ticket',
  case when t.id is null then null else jsonb_build_object('id',t.id,'issuedAt',t.issued_at,'usedAt',t.used_at) end);
end;
$$;
