import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
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
        const authorization = request.headers.get("authorization") ?? ""
        if (!authorization.toLowerCase().startsWith("bearer ")) {
            throw new Error("Authentication required.")
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
        const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? ""
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authorization } },
            auth: { persistSession: false, autoRefreshToken: false },
        })
        const token = authorization.slice(7).trim()
        const { data: authData, error: authError } = await supabase.auth.getUser(token)

        if (authError || !authData.user) {
            throw new Error("Authentication required.")
        }

        if (!payload.paymentReference) {
            throw new Error("Payment reference is required.")
        }

        const { data: transaction, error: transactionError } = await supabase
            .from("wallet_transactions")
            .select("wallet_id, amount, type, status, reference")
            .eq("reference", payload.paymentReference)
            .eq("wallet_id", authData.user.id)
            .single()

        if (
            transactionError ||
            !transaction ||
            transaction.type !== "credit" ||
            transaction.status !== "pending" ||
            !transaction.reference?.startsWith("WAL-") ||
            !Number.isSafeInteger(transaction.amount) ||
            transaction.amount <= 0
        ) {
            throw new Error("Pending wallet top-up not found.")
        }

        const amount = transaction.amount / 100

        const accessToken = await getAccessToken()
        const siteUrl = (Deno.env.get("SITE_URL") ?? "https://myrss.com.ng").replace(/\/$/, "")

        const initPayload = {
            amount,
            customerName: typeof authData.user.user_metadata?.full_name === "string"
                ? authData.user.user_metadata.full_name
                : "RSS Foods Customer",
            customerEmail: authData.user.email ?? "support@rssfoods.com",
            paymentReference: transaction.reference,
            paymentDescription: `Wallet top-up: NGN ${amount.toLocaleString()}`,
            currencyCode: "NGN",
            contractCode: CONTRACT_CODE,
            redirectUrl: `${siteUrl}/account/wallet?ref=${encodeURIComponent(transaction.reference)}`,
            paymentMethods: ["CARD", "ACCOUNT_TRANSFER"],
            metaData: {
                type: "wallet_topup",
                wallet_id: transaction.wallet_id,
                user_id: authData.user.id,
                amount_kobo: transaction.amount,
            },
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
                paymentReference: transaction.reference,
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

