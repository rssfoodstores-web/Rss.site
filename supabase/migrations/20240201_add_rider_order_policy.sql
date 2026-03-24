-- Allow riders to see orders that are ready for pickup and available (no rider assigned)
CREATE POLICY "Riders can view available orders"
ON orders
FOR SELECT
USING (
  (auth.jwt() ->> 'role' = 'authenticated') AND 
  status = 'ready_for_pickup' AND
  rider_id IS NULL
);

-- Allow riders to see order items for available orders (needed for the join)
CREATE POLICY "Riders can view available order items"
ON order_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_items.order_id
    AND orders.status = 'ready_for_pickup'
    AND orders.rider_id IS NULL
  )
);
