# project-spec.md - ARCHITECTURAL BLUEPRINT
> **VERSION:** 1.2.0 (Design Updated)
> **BUDGET:** ₦500,000.00 (Fixed)
> **DEPLOYMENT:** Local (Dev) -> Vercel (Test) -> VPS (Prod)

## 1.0 DATABASE SCHEMA (PostgreSQL 17)
**INSTRUCTION:** Execute these SQL blocks strictly in order using the MCP Tool.

### 1.1 Core Extensions
```sql
-- Enable required extensions
create extension if not exists "postgis";
create extension if not exists "uuid-ossp";
1.2 Identity & Roles (Source of Truth)
SQL

-- 1. Profiles Table (Public Profile Data)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null,
  phone text,
  avatar_url text,
  updated_at timestamptz default now()
);

-- 2. User Roles Enum & Table
create type public.app_role as enum ('customer', 'merchant', 'rider', 'admin', 'agent');

create table public.user_roles (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  role public.app_role not null,
  created_at timestamptz default now(),
  unique (user_id, role) -- Prevent duplicate roles
);
1.3 The "Sync" Trigger (CRITICAL)
Purpose: Syncs roles to JWT to avoid DB lookups in RLS.

SQL

-- Function to update auth.users metadata
create or replace function public.sync_user_roles()
returns trigger as $$
declare
  _roles jsonb;
begin
  select jsonb_build_object('roles', array_agg(role))
  into _roles
  from public.user_roles
  where user_id = coalesce(new.user_id, old.user_id);

  update auth.users
  set raw_app_metadata = coalesce(raw_app_metadata, '{}'::jsonb) || _roles
  where id = coalesce(new.user_id, old.user_id);

  return new;
end;
$$ language plpgsql security definer;

-- Trigger execution
create trigger on_role_change
  after insert or delete on public.user_roles
  for each row execute function public.sync_user_roles();
1.4 Financial System (Double-Entry Ledger)
SQL

-- 1. Wallets (Holds current balance in KOBO)
create type public.wallet_type as enum ('merchant', 'rider', 'commission');

create table public.wallets (
  id uuid default uuid_generate_v4() primary key,
  owner_id uuid references public.profiles(id) not null,
  balance bigint default 0 not null, -- Stored in KOBO (e.g., N100 = 10000)
  type public.wallet_type not null,
  created_at timestamptz default now(),
  unique (owner_id, type)
);

-- 2. Ledger Entries (Immutable Audit Log)
create table public.ledger_entries (
  id uuid default uuid_generate_v4() primary key,
  wallet_id uuid references public.wallets(id) not null,
  amount bigint not null, -- Positive = Credit, Negative = Debit
  description text not null,
  reference_id uuid not null, -- Links to Order ID or Payout ID
  created_at timestamptz default now()
);
1.5 Inventory & Orders
SQL

[cite_start]-- 1. Products with Legal Categories [cite: 77-108]
create type public.food_category as enum (
  'fresh_produce', 'tubers', 'grains', 'oils', 'spices', 
  'proteins', 'packaged', 'specialty'
);

create table public.products (
  id uuid default uuid_generate_v4() primary key,
  merchant_id uuid references public.profiles(id) not null,
  name text not null,
  category public.food_category not null,
  price bigint not null, -- In KOBO
  stock_level int default 0,
  image_url text,
  is_available boolean default true
);

-- 2. Orders
create type public.order_status as enum (
  'pending', 'processing', 'out_for_delivery', 'delivered', 'completed'
);

create table public.orders (
  id uuid default uuid_generate_v4() primary key,
  customer_id uuid references public.profiles(id) not null,
  total_amount bigint not null,
  status public.order_status default 'pending',
  payment_ref text unique, -- Monnify Reference
  delivery_location geography(Point, 4326), -- For distance calc
  created_at timestamptz default now()
);
1.6 Logistics
SQL

-- Rider Location Tracking
create table public.rider_locations (
  rider_id uuid references public.profiles(id) primary key,
  current_location geography(Point, 4326) not null,
  updated_at timestamptz default now()
);

-- Index for radial search performance
create index rider_geo_idx on public.rider_locations using GIST (current_location);