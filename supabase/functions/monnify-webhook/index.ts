import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SECRET_KEY = Deno.env.get("MONNIFY_SECRET_KEY") ?? ""
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, monnify-signature",
}

async function computeSignature(payload: string, secret: string) {
    const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-512" },
        false,
        ["sign"]
    )

    const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))

    return Array.from(new Uint8Array(signature))
        .map((value) => value.toString(16).padStart(2, "0"))
        .join("")
}

serve(async (request) => {
    if (request.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders })
    }

    const signature = request.headers.get("monnify-signature")

    if (!signature) {
        return new Response("Missing signature", { status: 401, headers: corsHeaders })
    }

    const bodyText = await request.text()
    const computedSignature = await computeSignature(bodyText, SECRET_KEY)

    if (computedSignature !== signature) {
        return new Response("Invalid signature", { status: 401, headers: corsHeaders })
    }

    const body = JSON.parse(bodyText)
    const { eventType, eventData } = body

    if (eventType !== "SUCCESSFUL_TRANSACTION") {
        return new Response("Ignored", { status: 200, headers: corsHeaders })
    }

    const paymentReference = eventData?.paymentReference as string | undefined
    const amountPaid = Number(eventData?.amountPaid ?? 0)
    const metaData = eventData?.metaData ?? eventData?.meta_data ?? {}

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    try {
        if (paymentReference?.startsWith("WAL-") || metaData?.type === "wallet_topup") {
            const amountKobo = Math.round(amountPaid * 100)
            const { error } = await supabase.rpc("handle_wallet_credit", {
                p_reference: paymentReference,
                p_amount_kobo: amountKobo,
            })

            if (error) {
                console.error("Wallet top-up processing failed:", error)
                return new Response("Wallet top-up processing failed", { status: 500, headers: corsHeaders })
            }

            return new Response("Wallet top-up processed", { status: 200, headers: corsHeaders })
        }

        if (metaData?.type === "order_payment" && metaData?.order_id) {
            const { data, error } = await supabase.rpc("mark_direct_payment_success", {
                p_order_id: metaData.order_id,
                p_payment_reference: paymentReference,
            })

            if (error || !data?.success) {
                console.error("Order payment processing failed:", error ?? data)
                return new Response("Order payment processing failed", { status: 500, headers: corsHeaders })
            }

            return new Response("Order payment processed", { status: 200, headers: corsHeaders })
        }

        if (metaData?.type === "gift_card_purchase" && metaData?.gift_card_id) {
            const amountKobo = Math.round(amountPaid * 100)
            const { data, error } = await supabase.rpc("mark_gift_card_purchase_paid", {
                p_gift_card_id: metaData.gift_card_id,
                p_payment_reference: paymentReference,
                p_amount_kobo: amountKobo,
            })

            if (error || !data?.success) {
                console.error("Gift card payment processing failed:", error ?? data)
                return new Response("Gift card payment processing failed", { status: 500, headers: corsHeaders })
            }

            return new Response("Gift card payment processed", { status: 200, headers: corsHeaders })
        }

        return new Response("No matching workflow", { status: 200, headers: corsHeaders })
    } catch (error) {
        console.error("Monnify webhook failure:", error)
        return new Response("Webhook processing failed", { status: 500, headers: corsHeaders })
    }
})
