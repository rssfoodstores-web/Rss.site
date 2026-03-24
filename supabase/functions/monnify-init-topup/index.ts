import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { CONTRACT_CODE, MONNIFY_API_URL, corsHeaders, getAccessToken } from "../_shared/monnify.ts"

interface TopupRequest {
    amount: number
    customerName: string
    customerEmail?: string
    paymentReference: string
    paymentDescription?: string
    redirectPath?: string
    metadata?: Record<string, unknown>
}

serve(async (request) => {
    if (request.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders })
    }

    try {
        const payload = await request.json() as TopupRequest

        if (!payload.amount || payload.amount <= 0) {
            throw new Error("Amount must be greater than zero.")
        }

        if (!payload.paymentReference) {
            throw new Error("Payment reference is required.")
        }

        const accessToken = await getAccessToken()
        const origin = request.headers.get("origin") ?? Deno.env.get("SITE_URL") ?? "http://localhost:3000"

        const initPayload = {
            amount: payload.amount,
            customerName: payload.customerName,
            customerEmail: payload.customerEmail ?? "support@rssfoods.com",
            paymentReference: payload.paymentReference,
            paymentDescription: payload.paymentDescription ?? "Wallet top-up",
            currencyCode: "NGN",
            contractCode: CONTRACT_CODE,
            redirectUrl: `${origin}${payload.redirectPath ?? "/account/wallet"}`,
            paymentMethods: ["CARD", "ACCOUNT_TRANSFER"],
            metaData: payload.metadata ?? {},
        }

        const response = await fetch(`${MONNIFY_API_URL}/api/v1/merchant/transactions/init-transaction`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(initPayload),
        })

        const data = await response.json()

        if (!response.ok || !data?.requestSuccessful) {
            throw new Error(data?.responseMessage ?? "Failed to initialize top-up transaction.")
        }

        return new Response(
            JSON.stringify({
                checkoutUrl: data.responseBody.checkoutUrl,
                paymentReference: payload.paymentReference,
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
                error: error instanceof Error ? error.message : "Unable to initialize wallet top-up.",
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
