-- Add missing columns to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS seo_title text,
ADD COLUMN IF NOT EXISTS seo_description text,
ADD COLUMN IF NOT EXISTS state text,
ADD COLUMN IF NOT EXISTS weight text,
ADD COLUMN IF NOT EXISTS is_perishable boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS discount_price numeric,
ADD COLUMN IF NOT EXISTS add_tax boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS has_options boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS sales_type text DEFAULT 'retail',
ADD COLUMN IF NOT EXISTS description text;
