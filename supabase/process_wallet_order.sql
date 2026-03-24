-- RPC to process an order using wallet funds atomically
CREATE OR REPLACE FUNCTION process_wallet_order(
    p_user_id UUID,
    p_total_kobo BIGINT,
    p_items JSONB,
    p_delivery_location JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_wallet_balance BIGINT;
    v_order_id UUID;
    v_item RECORD;
    v_current_stock INTEGER;
    v_product_name TEXT;
BEGIN
    -- 1. Check Wallet Balance
    SELECT balance INTO v_wallet_balance
    FROM wallets
    WHERE owner_id = p_user_id
    FOR UPDATE; -- Lock the wallet row

    IF v_wallet_balance IS NULL OR v_wallet_balance < p_total_kobo THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient wallet balance');
    END IF;

    -- 2. Verify Stock for all items
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity INTEGER)
    LOOP
        SELECT stock_level, name INTO v_current_stock, v_product_name
        FROM products
        WHERE id = v_item.product_id
        FOR UPDATE; -- Lock product row

        IF v_current_stock IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'Product not found');
        END IF;

        IF v_current_stock < v_item.quantity THEN
            RETURN jsonb_build_object('success', false, 'error', 'Insufficient stock for ' || v_product_name);
        END IF;
    END LOOP;

    -- 3. Deduct Wallet Balance
    UPDATE wallets
    SET balance = balance - p_total_kobo
    WHERE owner_id = p_user_id;

    -- 4. Log Wallet Transaction
    INSERT INTO wallet_transactions (
        wallet_id,
        amount,
        type,
        status,
        reference,
        description
    ) VALUES (
        p_user_id,
        p_total_kobo,
        'debit',
        'success',
        'ORD-' || encode(gen_random_bytes(6), 'hex'),
        'Order Payment'
    );

    -- 5. Create Order
    INSERT INTO orders (
        customer_id,
        total_amount,
        status,
        delivery_location,
        payment_ref
    ) VALUES (
        p_user_id,
        (p_total_kobo / 100)::DECIMAL,
        'processing',
        p_delivery_location,
        'wallet'
    )
    RETURNING id INTO v_order_id;

    -- 6. Create Order Items and Deduct Stock
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity INTEGER, price DECIMAL)
    LOOP
        -- Insert Order Item
        INSERT INTO order_items (
            order_id,
            product_id,
            quantity,
            price_per_unit,
            total_price
        ) VALUES (
            v_order_id,
            v_item.product_id,
            v_item.quantity,
            v_item.price,
            v_item.price * v_item.quantity
        );

        -- Deduct Product Stock
        UPDATE products
        SET stock_level = stock_level - v_item.quantity
        WHERE id = v_item.product_id;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'new_balance', v_wallet_balance - p_total_kobo
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
