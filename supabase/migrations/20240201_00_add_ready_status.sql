-- Add ready_for_pickup to the order_status enum
-- We use IF NOT EXISTS logic via a DO block to avoid errors if it was manually added
DO $$
BEGIN
    ALTER TYPE "public"."order_status" ADD VALUE 'ready_for_pickup';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
