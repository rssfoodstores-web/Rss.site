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

        const { data: topup, error: transactionError } = await supabase
            .from("wallet_topup_requests")
            .select("wallet_id,wallet_credit_kobo,processor_fee_kobo,processor_fee_vat_kobo,rss_fee_kobo,total_charge_kobo,reference")
            .eq("reference", payload.paymentReference)
            .eq("user_id", authData.user.id)
            .single()

        if (
            transactionError ||
            !topup ||
            !topup.reference?.startsWith("WAL-") ||
            !Number.isSafeInteger(topup.total_charge_kobo) ||
            topup.total_charge_kobo <= 0
        ) {
            throw new Error("Pending wallet top-up not found.")
        }

        const amount = topup.total_charge_kobo / 100

        const accessToken = await getAccessToken()
        const siteUrl = (Deno.env.get("SITE_URL") ?? "https://myrss.com.ng").replace(/\/$/, "")

        const initPayload = {
            amount,
            customerName: typeof authData.user.user_metadata?.full_name === "string"
                ? authData.user.user_metadata.full_name
                : "RSS Foods Customer",
            customerEmail: authData.user.email ?? "support@rssfoods.com",
            paymentReference: topup.reference,
            paymentDescription: `RSS wallet top-up: NGN ${(topup.wallet_credit_kobo / 100).toLocaleString()}`,
            currencyCode: "NGN",
            contractCode: CONTRACT_CODE,
            redirectUrl: `${siteUrl}/account/wallet?ref=${encodeURIComponent(topup.reference)}&payment=return`,
            paymentMethods: ["CARD", "ACCOUNT_TRANSFER"],
            metaData: {
                type: "wallet_topup",
                wallet_id: topup.wallet_id,
                user_id: authData.user.id,
                wallet_credit_kobo: topup.wallet_credit_kobo,
                quoted_fee_kobo: topup.processor_fee_kobo + topup.processor_fee_vat_kobo + topup.rss_fee_kobo,
                total_charge_kobo: topup.total_charge_kobo,
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
                paymentReference: topup.reference,
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

