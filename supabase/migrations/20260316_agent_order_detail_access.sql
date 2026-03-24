drop policy if exists "Agents can view assigned order items" on public.order_items;
create policy "Agents can view assigned order items"
on public.order_items
for select
to public
using (
    exists (
        select 1
        from public.orders o
        where o.id = order_items.order_id
          and o.assigned_agent_id = auth.uid()
    )
);

drop policy if exists "Agents can view assigned order disputes" on public.order_disputes;
create policy "Agents can view assigned order disputes"
on public.order_disputes
for select
to public
using (
    exists (
        select 1
        from public.orders o
        where o.id = order_disputes.order_id
          and o.assigned_agent_id = auth.uid()
    )
);

drop policy if exists "Agents can view assigned order refunds" on public.refunds;
create policy "Agents can view assigned order refunds"
on public.refunds
for select
to public
using (
    exists (
        select 1
        from public.orders o
        where o.id = refunds.order_id
          and o.assigned_agent_id = auth.uid()
    )
);
