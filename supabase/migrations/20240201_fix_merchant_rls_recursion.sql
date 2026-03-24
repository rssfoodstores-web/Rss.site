-- Function to check if a merchant owns any items in an order
-- SECURITY DEFINER allows it to run with privileges of the function creator, bypassing RLS on order_items
CREATE OR REPLACE FUNCTION public.merchant_owns_order_items(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM order_items oi
        JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = p_order_id
        AND p.merchant_id = auth.uid()
    );
END;
$$;

-- Drop the old policy causing recursion
DROP POLICY IF EXISTS "Merchants can view orders with their products" ON orders;

-- Create the new policy using the function
CREATE POLICY "Merchants can view orders with their products"
ON orders
FOR SELECT
USING (
  merchant_owns_order_items(id)
);
