import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { MONNIFY_API_URL, corsHeaders, getAccessToken } from "../_shared/monnify.ts"

interface VerifyAccountRequest {
    bankCode: string
    accountNumber: string
}

serve(async (request) => {
    if (request.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders })
    }

    try {
        const payload = await request.json() as VerifyAccountRequest

        if (!payload.bankCode || !payload.accountNumber) {
            throw new Error("Bank code and account number are required.")
        }

        const accessToken = await getAccessToken()
        const primaryUrl = `${MONNIFY_API_URL}/api/v1/disbursements/account/validate?accountNumber=${payload.accountNumber}&bankCode=${payload.bankCode}`

        let response = await fetch(primaryUrl, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        })

        let data = await response.json()

        if (!data?.requestSuccessful && (data?.responseCode === "99" || response.status === 404)) {
            const fallbackUrl = `${MONNIFY_API_URL}/api/v1/account/validate?accountNumber=${payload.accountNumber}&bankCode=${payload.bankCode}`

            response = await fetch(fallbackUrl, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            })

            data = await response.json()
        }

        if (!response.ok || !data?.requestSuccessful) {
            throw new Error(data?.responseMessage ?? "Monnify could not verify this account.")
        }

        return new Response(
            JSON.stringify({
                accountName: data.responseBody.accountName,
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
                error: error instanceof Error ? error.message : "Unable to verify account.",
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
