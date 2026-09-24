import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const MONNIFY_API_URL = Deno.env.get("MONNIFY_API_URL") ?? "https://sandbox.monnify.com"
const API_KEY = Deno.env.get("MONNIFY_API_KEY") ?? ""
const SECRET_KEY = Deno.env.get("MONNIFY_SECRET_KEY") ?? ""
const CONTRACT_CODE = Deno.env.get("MONNIFY_CONTRACT_CODE") ?? ""
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? ""

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

interface MonnifyInitRequest {
    amount: number
    customerName: string
    customerEmail?: string
    paymentReference?: string
    paymentDescription: string
    redirectPath?: string
    metadata?: Record<string, unknown>
    paymentMethods?: string[]
}

interface OrderPaymentMetadata {
    type?: string
    order_id?: string
    user_id?: string
    gift_card_id?: string
}

async function getAccessToken() {
    const encoded = btoa(`${API_KEY}:${SECRET_KEY}`)

    const response = await fetch(`${MONNIFY_API_URL}/api/v1/auth/login`, {
        method: "POST",
        headers: {
            "Authorization": `Basic ${encoded}`,
        },
    })

    const data = await response.json()

    if (!response.ok || !data?.requestSuccessful) {
        throw new Error(data?.responseMessage ?? "Failed to authenticate with Monnify.")
    }

    return data.responseBody.accessToken as string
}

serve(async (request) => {
    if (request.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders })
    }

    try {
        const payload = await request.json() as MonnifyInitRequest
        const metadata = (payload.metadata ?? {}) as OrderPaymentMetadata

        // Order totals and references are security-sensitive. For order payments,
        // derive both from the authenticated customer's stored pending order rather
        // than trusting values supplied by the caller.
        if (metadata.type === "order_payment" || metadata.type === "gift_card_purchase") {
            const authorization = request.headers.get("authorization") ?? ""
            if (!authorization.toLowerCase().startsWith("bearer ")) {
                throw new Error("Authentication required.")
            }

            const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                global: { headers: { Authorization: authorization } },
                auth: { persistSession: false, autoRefreshToken: false },
            })
            const token = authorization.slice(7).trim()
            const { data: authData, error: authError } = await supabase.auth.getUser(token)

            if (authError || !authData.user) {
                throw new Error("Authentication required.")
            }

            if (metadata.type === "order_payment") {
                if (!metadata.order_id) throw new Error("Pending order not found.")
                const { data: order, error: orderError } = await supabase
                    .from("orders")
                    .select("id, customer_id, total_amount, payment_ref, status, payment_status")
                    .eq("id", metadata.order_id)
                    .eq("customer_id", authData.user.id)
                    .single()

                if (orderError || !order) throw new Error("Pending order not found.")
                if (order.status !== "pending" || order.payment_status !== "pending") {
                    throw new Error("Order is not awaiting payment.")
                }
                if (!order.payment_ref || !order.total_amount || order.total_amount <= 0) {
                    throw new Error("Order payment details are incomplete.")
                }

                payload.amount = order.total_amount / 100
                payload.paymentReference = order.payment_ref
                payload.metadata = {
                    type: "order_payment",
                    order_id: order.id,
                    user_id: authData.user.id,
                }
            } else {
                if (!metadata.gift_card_id) throw new Error("Pending gift card purchase not found.")
                const { data: giftCard, error: giftCardError } = await supabase
                    .from("gift_cards")
                    .select("id, purchaser_id, amount_kobo, payment_reference, status")
                    .eq("id", metadata.gift_card_id)
                    .eq("purchaser_id", authData.user.id)
                    .single()

                if (giftCardError || !giftCard || giftCard.status !== "pending") {
                    throw new Error("Pending gift card purchase not found.")
                }

                payload.amount = giftCard.amount_kobo / 100
                payload.paymentReference = giftCard.payment_reference
                payload.metadata = {
                    type: "gift_card_purchase",
                    gift_card_id: giftCard.id,
                    user_id: authData.user.id,
                }
            }
        }

        if (!payload.amount || payload.amount <= 0) {
            throw new Error("Amount must be greater than zero.")
        }

        const accessToken = await getAccessToken()
        const origin = request.headers.get("origin") ?? Deno.env.get("SITE_URL") ?? "http://localhost:3000"
        const paymentReference = payload.paymentReference ?? `MON-${Date.now()}`

        const initPayload = {
            amount: payload.amount,
            customerName: payload.customerName,
            customerEmail: payload.customerEmail ?? "support@rssfoods.com",
            paymentReference,
            paymentDescription: payload.paymentDescription,
            currencyCode: "NGN",
            contractCode: CONTRACT_CODE,
            redirectUrl: `${origin}${payload.redirectPath ?? "/account/orders"}`,
            paymentMethods: payload.paymentMethods ?? ["CARD", "ACCOUNT_TRANSFER"],
            metaData: payload.metadata ?? {},
        }

        const response = await fetch(`${MONNIFY_API_URL}/api/v1/merchant/transactions/init-transaction`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(initPayload),
        })

        const data = await response.json()

        if (!response.ok || !data?.requestSuccessful) {
            throw new Error(data?.responseMessage ?? "Failed to initialize Monnify transaction.")
        }

        return new Response(
            JSON.stringify({
                checkoutUrl: data.responseBody.checkoutUrl,
                paymentReference,
                transactionReference: data.responseBody.transactionReference,
            }),
            {
                headers: {
                    ...corsHeaders,
                    "Content-Type": "application/json",
                },
            }
        )
    } catch (error) {
        return new Response(
            JSON.stringify({
                error: error instanceof Error ? error.message : "Unable to initialize Monnify transaction.",
            }),
            {
                status: 400,
                headers: {
                    ...corsHeaders,
                    "Content-Type": "application/json",
                },
            }
        )
    }
})
