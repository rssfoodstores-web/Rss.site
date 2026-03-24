-- Drop policies if they exist to allow re-running without error
DROP POLICY IF EXISTS "Merchants can view orders with their products" ON orders;
DROP POLICY IF EXISTS "Merchants can view order items for their products" ON order_items;

-- Allow merchants to see orders that contain their products
CREATE POLICY "Merchants can view orders with their products"
ON orders
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = orders.id
    AND p.merchant_id = auth.uid()
  )
);

-- Allow merchants to see the items inside those orders
CREATE POLICY "Merchants can view order items for their products"
ON order_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM products p
    WHERE p.id = order_items.product_id
    AND p.merchant_id = auth.uid()
  )
);
