import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { CONTRACT_CODE, MONNIFY_API_URL, corsHeaders, getAccessToken } from "../_shared/monnify.ts"

interface ReservedAccountRequest {
    walletId: string
    customerName: string
    customerEmail: string
}

serve(async (request) => {
    if (request.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders })
    }

    try {
        const payload = await request.json() as ReservedAccountRequest

        if (!payload.walletId || !payload.customerName || !payload.customerEmail) {
            throw new Error("Wallet ID, customer name, and customer email are required.")
        }

        const accessToken = await getAccessToken()

        const response = await fetch(`${MONNIFY_API_URL}/api/v2/bank-transfer/reserved-accounts`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                accountReference: payload.walletId,
                accountName: payload.customerName,
                currencyCode: "NGN",
                contractCode: CONTRACT_CODE,
                customerEmail: payload.customerEmail,
                customerName: payload.customerName,
                getAllAvailableBanks: true,
            }),
        })

        const data = await response.json()

        if (!response.ok || !data?.requestSuccessful) {
            if (data?.responseMessage?.includes("same reference") || data?.responseCode === "99") {
                const existingResponse = await fetch(`${MONNIFY_API_URL}/api/v2/bank-transfer/reserved-accounts/${payload.walletId}`, {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                })
                const existingData = await existingResponse.json()

                if (!existingResponse.ok || !existingData?.requestSuccessful) {
                    throw new Error(existingData?.responseMessage ?? "Failed to fetch reserved account.")
                }

                return new Response(
                    JSON.stringify({
                        accounts: existingData.responseBody.accounts ?? [],
                    }),
                    {
                        headers: {
                            ...corsHeaders,
                            "Content-Type": "application/json",
                        },
                    }
                )
            }

            throw new Error(data?.responseMessage ?? "Failed to create reserved account.")
        }

        return new Response(
            JSON.stringify({
                accounts: data.responseBody.accounts ?? [],
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
                error: error instanceof Error ? error.message : "Unable to create reserved account.",
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
