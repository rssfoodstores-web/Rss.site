-- Addendum RLS cutover for pricing, settlement, corporate finance, and audit tables.

drop policy if exists "Admins can update products" on public.products;
create policy "Admins can update products"
on public.products
for update
using (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']))
with check (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']));

drop policy if exists "Admins can view all merchants" on public.merchants;
create policy "Admins can view all merchants"
on public.merchants
for select
using (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']));

drop policy if exists "Admins can view all rider profiles" on public.rider_profiles;
create policy "Admins can view all rider profiles"
on public.rider_profiles
for select
using (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']));

drop policy if exists "Admins can manage rider profiles" on public.rider_profiles;
create policy "Admins can manage rider profiles"
on public.rider_profiles
for update
using (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']))
with check (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']));

drop policy if exists "Admins can view all roles" on public.user_roles;
create policy "Admins can view all roles"
on public.user_roles
for select
using (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']));

drop policy if exists "Admins can view all orders" on public.orders;
create policy "Admins can view all orders"
on public.orders
for select
using (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']));

drop policy if exists "Agents can view assigned orders" on public.orders;
create policy "Agents can view assigned orders"
on public.orders
for select
using (assigned_agent_id = auth.uid() and public.jwt_has_role('agent'));

drop policy if exists "Admins can view product price inputs" on public.product_price_inputs;
create policy "Admins can view product price inputs"
on public.product_price_inputs
for select
using (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']));

drop policy if exists "Merchants can view own product price inputs" on public.product_price_inputs;
create policy "Merchants can view own product price inputs"
on public.product_price_inputs
for select
using (
    exists (
        select 1
        from public.products p
        where p.id = product_price_inputs.product_id
          and p.merchant_id = auth.uid()
    )
);

drop policy if exists "Agents can view own product price inputs" on public.product_price_inputs;
create policy "Agents can view own product price inputs"
on public.product_price_inputs
for select
using (source_user_id = auth.uid() and public.jwt_has_role('agent'));

drop policy if exists "Merchants can submit merchant price inputs" on public.product_price_inputs;
create policy "Merchants can submit merchant price inputs"
on public.product_price_inputs
for insert
with check (
    source = 'merchant'
    and source_user_id = auth.uid()
    and exists (
        select 1
        from public.products p
        where p.id = product_price_inputs.product_id
          and p.merchant_id = auth.uid()
    )
);

drop policy if exists "Agents can submit agent price inputs" on public.product_price_inputs;
create policy "Agents can submit agent price inputs"
on public.product_price_inputs
for insert
with check (
    source = 'agent'
    and source_user_id = auth.uid()
    and public.jwt_has_role('agent')
);

drop policy if exists "Admins can manage product price inputs" on public.product_price_inputs;
create policy "Admins can manage product price inputs"
on public.product_price_inputs
for all
using (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']))
with check (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']));

drop policy if exists "Admins can view pricing snapshots" on public.product_pricing_snapshots;
create policy "Admins can view pricing snapshots"
on public.product_pricing_snapshots
for select
using (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']));

drop policy if exists "Admins can manage pricing snapshots" on public.product_pricing_snapshots;
create policy "Admins can manage pricing snapshots"
on public.product_pricing_snapshots
for all
using (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']))
with check (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']));

drop policy if exists "Participants can view order financials" on public.order_financials;
create policy "Participants can view order financials"
on public.order_financials
for select
using (
    public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin'])
    or exists (
        select 1
        from public.orders o
        where o.id = order_financials.order_id
          and (
              o.customer_id = auth.uid()
              or o.merchant_id = auth.uid()
              or o.assigned_agent_id = auth.uid()
              or o.rider_id = auth.uid()
          )
    )
);

drop policy if exists "Participants can view order item financials" on public.order_item_financials;
create policy "Participants can view order item financials"
on public.order_item_financials
for select
using (
    public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin'])
    or exists (
        select 1
        from public.orders o
        where o.id = order_item_financials.order_id
          and (
              o.customer_id = auth.uid()
              or o.merchant_id = auth.uid()
              or o.assigned_agent_id = auth.uid()
              or o.rider_id = auth.uid()
          )
    )
);

drop policy if exists "Participants can view order assignments" on public.order_assignments;
create policy "Participants can view order assignments"
on public.order_assignments
for select
using (
    public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin'])
    or exists (
        select 1
        from public.orders o
        where o.id = order_assignments.order_id
          and (
              o.customer_id = auth.uid()
              or o.merchant_id = auth.uid()
              or o.assigned_agent_id = auth.uid()
              or o.rider_id = auth.uid()
          )
    )
);

drop policy if exists "Admins can view corporate wallets" on public.corporate_wallets;
create policy "Admins can view corporate wallets"
on public.corporate_wallets
for select
using (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']));

drop policy if exists "Admins can manage corporate wallets" on public.corporate_wallets;
create policy "Admins can manage corporate wallets"
on public.corporate_wallets
for update
using (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']))
with check (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']));

drop policy if exists "Admins can view corporate ledger entries" on public.corporate_ledger_entries;
create policy "Admins can view corporate ledger entries"
on public.corporate_ledger_entries
for select
using (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']));

drop policy if exists "Admins can view tax liabilities" on public.tax_liabilities;
create policy "Admins can view tax liabilities"
on public.tax_liabilities
for select
using (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']));

drop policy if exists "Admins can view disputes" on public.order_disputes;
create policy "Admins can view disputes"
on public.order_disputes
for select
using (
    public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin'])
    or raised_by = auth.uid()
);

drop policy if exists "Customers can open disputes on own orders" on public.order_disputes;
create policy "Customers can open disputes on own orders"
on public.order_disputes
for insert
with check (
    raised_by = auth.uid()
    and exists (
        select 1
        from public.orders o
        where o.id = order_disputes.order_id
          and o.customer_id = auth.uid()
    )
);

drop policy if exists "Admins can manage disputes" on public.order_disputes;
create policy "Admins can manage disputes"
on public.order_disputes
for update
using (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']))
with check (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']));

drop policy if exists "Admins can view refunds" on public.refunds;
create policy "Admins can view refunds"
on public.refunds
for select
using (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']));

drop policy if exists "Customers can view own refunds" on public.refunds;
create policy "Customers can view own refunds"
on public.refunds
for select
using (
    exists (
        select 1
        from public.orders o
        where o.id = refunds.order_id
          and o.customer_id = auth.uid()
    )
);

drop policy if exists "Admins can manage refunds" on public.refunds;
create policy "Admins can manage refunds"
on public.refunds
for all
using (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']))
with check (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']));

drop policy if exists "Admins can view audit logs" on public.audit_logs;
create policy "Admins can view audit logs"
on public.audit_logs
for select
using (public.jwt_has_any_role(array['admin', 'supa_admin', 'sub_admin']));

alter table public.product_price_inputs enable row level security;
alter table public.product_pricing_snapshots enable row level security;
alter table public.order_financials enable row level security;
alter table public.order_item_financials enable row level security;
alter table public.order_assignments enable row level security;
alter table public.corporate_wallets enable row level security;
alter table public.corporate_ledger_entries enable row level security;
alter table public.tax_liabilities enable row level security;
alter table public.order_disputes enable row level security;
alter table public.refunds enable row level security;
alter table public.audit_logs enable row level security;
