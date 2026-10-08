import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SECRET_KEY = Deno.env.get("MONNIFY_SECRET_KEY") ?? ""
const API_KEY = Deno.env.get("MONNIFY_API_KEY") ?? ""
const MONNIFY_API_URL = Deno.env.get("MONNIFY_API_URL") ?? "https://sandbox.monnify.com"
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? ""
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
}

async function verifyTransaction(paymentReference: string) {
    const encoded = btoa(`${API_KEY}:${SECRET_KEY}`)
    const tokenResponse = await fetch(`${MONNIFY_API_URL}/api/v1/auth/login`, {
        method: "POST",
        headers: { Authorization: `Basic ${encoded}` },
    })
    const tokenData = await tokenResponse.json()

    if (!tokenResponse.ok || !tokenData?.requestSuccessful || !tokenData?.responseBody?.accessToken) {
        throw new Error("Unable to authenticate payment verification.")
    }

    const url = new URL(`${MONNIFY_API_URL}/api/v2/merchant/transactions/query`)
    url.searchParams.set("paymentReference", paymentReference)
    const response = await fetch(url, {
        headers: { Authorization: `Bearer ${tokenData.responseBody.accessToken}` },
    })
    const data = await response.json()

    if (!response.ok || !data?.requestSuccessful || !data?.responseBody) {
        throw new Error("Unable to verify transaction with Monnify.")
    }

    return data.responseBody as {
        paymentReference?: string
        paymentStatus?: string
        amountPaid?: number | string
        settlementAmount?: number | string
        transactionReference?: string
    }
}

serve(async (request) => {
    if (request.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders })
    }

    if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
            status: 405,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
    }

    try {
        const authorization = request.headers.get("authorization") ?? ""
        if (!authorization.toLowerCase().startsWith("bearer ")) {
            return new Response(JSON.stringify({ error: "Authentication required." }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            })
        }

        const token = authorization.slice(7).trim()
        const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: { persistSession: false, autoRefreshToken: false },
        })
        const { data: authData, error: authError } = await authClient.auth.getUser(token)
        if (authError || !authData.user) {
            return new Response(JSON.stringify({ error: "Authentication required." }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            })
        }

        const { paymentReference } = await request.json() as { paymentReference?: string }
        if (!paymentReference || !/^WAL-[0-9a-f-]{36}$/i.test(paymentReference)) {
            return new Response(JSON.stringify({ error: "Invalid payment reference." }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            })
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        const { data: topup, error: topupError } = await supabase
            .from("wallet_topup_requests")
            .select("transaction_id,total_charge_kobo,user_id,reference")
            .eq("reference", paymentReference)
            .eq("user_id", authData.user.id)
            .maybeSingle()

        if (topupError || !topup) {
            return new Response(JSON.stringify({ error: "Wallet top-up not found." }), {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            })
        }

        const { data: transaction, error: transactionError } = await supabase
            .from("wallet_transactions")
            .select("status")
            .eq("id", topup.transaction_id)
            .maybeSingle()

        if (transactionError || !transaction) {
            throw new Error("Unable to load wallet top-up status.")
        }

        if (transaction.status === "success") {
            return new Response(JSON.stringify({ success: true, status: "PAID", settled: true }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            })
        }

        if (transaction.status !== "pending") {
            return new Response(JSON.stringify({ success: true, status: transaction.status.toUpperCase(), settled: false }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            })
        }

        const verified = await verifyTransaction(paymentReference)
        const amountPaidKobo = Math.round(Number(verified.amountPaid ?? 0) * 100)

        if (verified.paymentReference !== paymentReference) {
            throw new Error("Payment reference did not match Monnify’s verified transaction.")
        }

        if (verified.paymentStatus !== "PAID") {
            return new Response(JSON.stringify({
                success: true,
                status: verified.paymentStatus ?? "PENDING",
                settled: false,
            }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
        }

        if (!Number.isSafeInteger(topup.total_charge_kobo) || amountPaidKobo !== topup.total_charge_kobo) {
            throw new Error("Verified payment amount did not match the wallet top-up.")
        }

        const settlementAmountKobo = Math.round(Number(verified.settlementAmount ?? 0) * 100)
        const { data: settlement, error: settlementError } = await supabase.rpc("handle_wallet_topup_payment", {
            p_reference: paymentReference,
            p_amount_paid_kobo: amountPaidKobo,
            p_settlement_amount_kobo: settlementAmountKobo,
            p_monnify_transaction_reference: verified.transactionReference ?? null,
        })

        if (settlementError || !settlement?.success) {
            throw new Error("Verified payment could not be applied to the wallet.")
        }

        return new Response(JSON.stringify({ success: true, status: "PAID", settled: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
    } catch (error) {
        console.error("Wallet top-up verification failed:", error)
        return new Response(JSON.stringify({
            error: error instanceof Error ? error.message : "Unable to verify wallet top-up.",
        }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
    }
})
