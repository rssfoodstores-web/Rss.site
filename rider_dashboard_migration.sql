-- Add rider tracking and security fields to orders table
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS rider_id uuid REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS pickup_code text,
ADD COLUMN IF NOT EXISTS delivery_code text,
ADD COLUMN IF NOT EXISTS pickup_verified_at timestamptz,
ADD COLUMN IF NOT EXISTS delivery_verified_at timestamptz;

-- Add comment for documentation
COMMENT ON COLUMN public.orders.rider_id IS 'The rider assigned to this order';
COMMENT ON COLUMN public.orders.pickup_code IS 'OTP for Rider to show Merchant (generated on accept)';
COMMENT ON COLUMN public.orders.delivery_code IS 'OTP for Customer to show Rider (generated on creation/pickup)';
