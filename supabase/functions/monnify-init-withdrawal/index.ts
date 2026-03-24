import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { MONNIFY_API_URL, corsHeaders, getAccessToken } from "../_shared/monnify.ts"

interface WithdrawalRequest {
    amount: number
    reference: string
    bankCode: string
    accountNumber: string
    narration?: string
}

serve(async (request) => {
    if (request.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders })
    }

    try {
        const payload = await request.json() as WithdrawalRequest

        if (!payload.amount || payload.amount <= 0) {
            throw new Error("Amount must be greater than zero.")
        }

        if (!payload.reference || !payload.bankCode || !payload.accountNumber) {
            throw new Error("Reference, bank code, and account number are required.")
        }

        const accessToken = await getAccessToken()
        const disbursementPayload = {
            amount: payload.amount,
            reference: payload.reference,
            narration: payload.narration ?? "RSS Foods wallet withdrawal",
            destinationBankCode: payload.bankCode,
            destinationAccountNumber: payload.accountNumber,
            currency: "NGN",
            sourceAccountNumber: Deno.env.get("MONNIFY_WALLET_ACCOUNT") ?? "",
        }

        const response = await fetch(`${MONNIFY_API_URL}/api/v1/disbursements/single`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(disbursementPayload),
        })

        const data = await response.json()

        if (!response.ok || !data?.requestSuccessful) {
            throw new Error(data?.responseMessage ?? "Failed to initialize withdrawal.")
        }

        return new Response(
            JSON.stringify({
                success: true,
                responseBody: data.responseBody ?? null,
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
                error: error instanceof Error ? error.message : "Unable to initialize withdrawal.",
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
