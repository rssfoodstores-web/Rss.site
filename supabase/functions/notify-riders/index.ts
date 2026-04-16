
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Configuration from env
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface OrderWebhookRecord {
    id: string
    status?: string | null
}

interface OrderWebhookPayload {
    record: OrderWebhookRecord
    type: string
}

interface NearbyRiderTokenRow {
    fcm_token: string | null
}

serve(async (req: Request) => {
    try {
        const payload = await req.json() as OrderWebhookPayload;
        console.log("Order Triggered Notification:", payload);

        // Payload structure for Supabase Webhook (Insert onto orders)
        const { record, type } = payload;

        // We only care about new orders that are in 'pending' or newly moved to 'processing'
        if (type !== 'INSERT' && (type !== 'UPDATE' || record.status !== 'processing')) {
            return new Response("No notification needed for this event type", { status: 200 });
        }

        const order = record;
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // 1. Get Merchant Location
        // Since 'orders' table doesn't have merchant_id directly (it has order_items -> products -> merchant)
        const { data: items, error: itemsError } = await supabase
            .from('order_items')
            .select('product_id')
            .eq('order_id', order.id)
            .limit(1);

        if (itemsError || !items?.[0]) {
            return new Response("No items found for order", { status: 400 });
        }

        const { data: product } = await supabase
            .from('products')
            .select('merchant_id')
            .eq('id', items[0].product_id)
            .single();

        if (!product) return new Response("Product not found", { status: 404 });

        const { data: merchant } = await supabase
            .from('profiles')
            .select('location, full_name')
            .eq('id', product.merchant_id)
            .single();

        if (!merchant || !merchant.location) {
            return new Response("Merchant location missing", { status: 200 });
        }

        // 2. Find Nearby Riders with FCM Tokens
        // We use a raw SQL approach for PostGIS 
        // We'll create this RPC next
        const { data: riders, error: ridersError } = await supabase.rpc('get_nearby_riders_tokens', {
            p_location: merchant.location,
            p_radius_meters: 10000 // 10km radius
        });

        if (ridersError) {
            console.error("Error fetching nearby riders:", ridersError);
            return new Response("Error querying riders", { status: 500 });
        }

        const tokens = ((riders ?? []) as NearbyRiderTokenRow[])
            .map((rider) => rider.fcm_token)
            .filter((token): token is string => Boolean(token));

        if (!tokens || tokens.length === 0) {
            console.log("No nearby riders with FCM tokens found.");
            return new Response("No nearby riders found", { status: 200 });
        }

        console.log(`Found ${tokens.length} riders to notify: ${tokens.join(', ')}`);

        // 3. Dispatch Notification
        // Note: To actually send push, we need the FIREBASE_SERVICE_ACCOUNT secret
        // For now we log and return success.

        return new Response(JSON.stringify({
            success: true,
            riders_found: tokens.length,
            message: `Notification dispatch ready for order ${order.id}`
        }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unexpected edge function error"
        console.error("Edge Function Error:", error);
        return new Response(errorMessage, { status: 500 });
    }
});
