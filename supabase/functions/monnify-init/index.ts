import { serve } from "https://deno.land/std@0.224.0/http/server.ts"

const MONNIFY_API_URL = Deno.env.get("MONNIFY_API_URL") ?? "https://sandbox.monnify.com"
const API_KEY = Deno.env.get("MONNIFY_API_KEY") ?? ""
const SECRET_KEY = Deno.env.get("MONNIFY_SECRET_KEY") ?? ""
const CONTRACT_CODE = Deno.env.get("MONNIFY_CONTRACT_CODE") ?? ""

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
