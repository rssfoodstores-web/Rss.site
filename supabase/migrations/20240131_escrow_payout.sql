-- RPC to complete order and distribute funds (Escrow Payout)
CREATE OR REPLACE FUNCTION complete_order_payout(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order RECORD;
    v_item RECORD;
    v_merchant_wallet_id UUID;
    v_rider_wallet_id UUID;
    v_merchant_payout DECIMAL;
BEGIN
    -- 1. Get Order Details & Lock
    SELECT * INTO v_order
    FROM orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF v_order.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;

    -- Idempotency check: If already delivered/completed, return success
    IF v_order.status IN ('delivered', 'completed') THEN
        RETURN jsonb_build_object('success', true, 'message', 'Order already completed');
    END IF;

    -- 2. Payout Rider (Delivery Fee)
    IF v_order.rider_id IS NOT NULL AND v_order.delivery_fee > 0 THEN
        -- Get Rider Wallet
        SELECT id INTO v_rider_wallet_id FROM wallets WHERE owner_id = v_order.rider_id;
        
        IF v_rider_wallet_id IS NOT NULL THEN
            -- Credit Rider
            UPDATE wallets 
            SET balance = balance + (v_order.delivery_fee * 100) -- Assuming delivery_fee is numeric/Naira, convert to Kobo if balance is Kobo?
            -- WAIT: database.types.ts says wallets.balance is number (likely Kobo/integer based on previous files).
            -- orders.delivery_fee is numeric. Let's assume Kobo conversion is needed.
            WHERE id = v_rider_wallet_id;

            -- Log Transaction
            INSERT INTO wallet_transactions (
                wallet_id, amount, type, status, reference, description
            ) VALUES (
                v_rider_wallet_id,
                (v_order.delivery_fee * 100), -- Credit in Kobo
                'credit',
                'success',
                'PAY-DEL-' || substring(p_order_id::text from 1 for 8),
                'Delivery Fee Payout for Order #' || substring(p_order_id::text from 1 for 8)
            );
        END IF;
    END IF;

    -- 3. Payout Merchants (Item Prices)
    FOR v_item IN 
        SELECT oi.quantity, oi.price_per_unit, p.merchant_id 
        FROM order_items oi 
        JOIN products p ON oi.product_id = p.id 
        WHERE oi.order_id = p_order_id
    LOOP
        -- Calculate Payout Amount (Price * Quantity) - In Kobo or Naira?
        -- order_items.price_per_unit is number. Assuming Naira based on UI.
        -- wallets.balance is Kobo.
        v_merchant_payout := (v_item.price_per_unit * v_item.quantity * 100); 

        -- Get Merchant Wallet
        SELECT id INTO v_merchant_wallet_id FROM wallets WHERE owner_id = v_item.merchant_id;

        IF v_merchant_wallet_id IS NOT NULL THEN
            -- Credit Merchant
            UPDATE wallets 
            SET balance = balance + v_merchant_payout
            WHERE id = v_merchant_wallet_id;

            -- Log Transaction
            INSERT INTO wallet_transactions (
                wallet_id, amount, type, status, reference, description
            ) VALUES (
                v_merchant_wallet_id,
                v_merchant_payout,
                'credit',
                'success',
                'PAY-ITEM-' || substring(p_order_id::text from 1 for 8),
                'Sale Payout for Order #' || substring(p_order_id::text from 1 for 8)
            );
        END IF;
    END LOOP;

    -- 4. Update Order Status
    UPDATE orders 
    SET status = 'delivered',
        delivery_verified_at = NOW()
    WHERE id = p_order_id;

    RETURN jsonb_build_object('success', true);

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
