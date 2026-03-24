-- 1. Fix fetch_nearby_orders ambiguity by dropping the integer variant
DROP FUNCTION IF EXISTS public.fetch_nearby_orders(double precision, double precision, integer);

-- 2. Update process_wallet_order to fix total_price generated column error and add missing params
CREATE OR REPLACE FUNCTION public.process_wallet_order(
    p_user_id uuid,
    p_total_kobo bigint,
    p_items jsonb,
    p_delivery_location jsonb,
    p_delivery_fee numeric DEFAULT 0,
    p_contact_numbers jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_wallet_balance BIGINT;
    v_order_id UUID;
    v_item RECORD;
    v_current_stock INTEGER;
    v_product_name TEXT;
    v_payment_ref TEXT;
BEGIN
    -- Generate Unique Payment Reference
    v_payment_ref := 'WAL-' || encode(gen_random_bytes(8), 'hex');

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
        v_payment_ref,
        'Order Payment'
    );

    -- 5. Create Order
    INSERT INTO orders (
        customer_id,
        total_amount,
        status,
        delivery_location,
        payment_ref,
        delivery_fee,
        contact_numbers
    ) VALUES (
        p_user_id,
        p_total_kobo, -- Storing Kobo consistently with createOrder
        'processing',
        ST_SetSRID(ST_GeomFromGeoJSON(p_delivery_location), 4326)::geography,
        v_payment_ref,
        p_delivery_fee,
        p_contact_numbers
    )
    RETURNING id INTO v_order_id;

    -- 6. Create Order Items and Deduct Stock
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity INTEGER, price DECIMAL)
    LOOP
        -- Insert Order Item (Removed total_price as it is generated)
        INSERT INTO order_items (
            order_id,
            product_id,
            quantity,
            price_per_unit
        ) VALUES (
            v_order_id,
            v_item.product_id,
            v_item.quantity,
            v_item.price
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
$function$;
