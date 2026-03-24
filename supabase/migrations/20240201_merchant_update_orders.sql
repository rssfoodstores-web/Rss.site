-- Allow Merchants to update order status to 'out_for_delivery' during verification
-- They must own the items in the order.
CREATE POLICY "Merchants can update order status for verification"
ON orders
FOR UPDATE
TO authenticated
USING (merchant_owns_order_items(id))
WITH CHECK (
    status IN ('out_for_delivery', 'delivered') 
    AND merchant_owns_order_items(id)
);
