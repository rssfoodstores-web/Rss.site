import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SECRET_KEY = Deno.env.get("MONNIFY_SECRET_KEY") ?? ""
const API_KEY = Deno.env.get("MONNIFY_API_KEY") ?? ""
const MONNIFY_API_URL = Deno.env.get("MONNIFY_API_URL") ?? "https://sandbox.monnify.com"
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

async function getAccessToken() {
    const encoded = btoa(`${API_KEY}:${SECRET_KEY}`)
    const response = await fetch(`${MONNIFY_API_URL}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Authorization": `Basic ${encoded}` },
    })
    const data = await response.json()

    if (!response.ok || !data?.requestSuccessful || !data?.responseBody?.accessToken) {
        throw new Error("Unable to authenticate payment verification.")
    }

    return data.responseBody.accessToken as string
}

async function verifyTransaction(paymentReference: string) {
    const accessToken = await getAccessToken()
    const url = new URL(`${MONNIFY_API_URL}/api/v2/merchant/transactions/query`)
    url.searchParams.set("paymentReference", paymentReference)
    const response = await fetch(url, {
        headers: { "Authorization": `Bearer ${accessToken}` },
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

async function verifyDisbursement(reference: string) {
    const accessToken = await getAccessToken()
    const url = new URL(`${MONNIFY_API_URL}/api/v2/disbursements/single/summary`)
    url.searchParams.set("reference", reference)
    const response = await fetch(url, { headers: { "Authorization": `Bearer ${accessToken}` } })
    const data = await response.json()

    if (!response.ok || !data?.requestSuccessful || !data?.responseBody) {
        throw new Error("Unable to verify disbursement with Monnify.")
    }

    return data.responseBody as {
        reference?: string
        amount?: number | string
        status?: string
        transactionReference?: string
        transactionDescription?: string
        destinationAccountNumber?: string
        destinationAccountName?: string
        destinationBankCode?: string
    }
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

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    try {
        if (["SUCCESSFUL_DISBURSEMENT", "FAILED_DISBURSEMENT", "REVERSED_DISBURSEMENT"].includes(eventType)) {
            const reference = String(eventData?.reference ?? "")
            if (!reference.startsWith("WIT-")) return new Response("Ignored", { status: 200, headers: corsHeaders })

            const { data: withdrawal, error: withdrawalError } = await supabase
                .from("wallet_withdrawal_requests")
                .select("reference,payout_amount_kobo,bank_code,account_number")
                .eq("reference", reference)
                .single()
            if (withdrawalError || !withdrawal) return new Response("Withdrawal not found", { status: 400, headers: corsHeaders })

            const verified = await verifyDisbursement(reference)
            const verifiedAmountKobo = Math.round(Number(verified.amount ?? 0) * 100)
            const verifiedStatus = String(verified.status ?? "").toUpperCase()
            if (
                verified.reference !== reference ||
                verifiedAmountKobo !== withdrawal.payout_amount_kobo ||
                verified.destinationAccountNumber !== withdrawal.account_number ||
                verified.destinationBankCode !== withdrawal.bank_code
            ) {
                return new Response("Disbursement validation failed", { status: 400, headers: corsHeaders })
            }

            const finalStatus = ["SUCCESS", "COMPLETED"].includes(verifiedStatus)
                ? "success"
                : verifiedStatus === "REVERSED"
                    ? "reversed"
                    : verifiedStatus === "FAILED" || verifiedStatus === "EXPIRED"
                        ? "failed"
                        : null
            if (!finalStatus) return new Response("Disbursement still pending", { status: 200, headers: corsHeaders })

            const { data, error } = await supabase.rpc("update_wallet_withdrawal_status", {
                p_reference: reference,
                p_status: finalStatus,
                p_account_name: verified.destinationAccountName ?? null,
                p_monnify_reference: verified.transactionReference ?? null,
                p_message: verified.transactionDescription ?? verifiedStatus,
            })
            if (!error && data?.error === "Wallet top-up request not found") {
                const legacyResult = await supabase.rpc("handle_wallet_credit", {
                    p_reference: paymentReference,
                    p_amount_kobo: verifiedAmountKobo,
                })
                if (!legacyResult.error) return new Response("Legacy wallet top-up processed", { status: 200, headers: corsHeaders })
            }

            if (error || !data?.success) {
                console.error("Disbursement finalization failed", error ?? data)
                return new Response("Disbursement finalization failed", { status: 500, headers: corsHeaders })
            }

            return new Response(`Disbursement ${finalStatus}`, { status: 200, headers: corsHeaders })
        }

        if (eventType !== "SUCCESSFUL_TRANSACTION") {
            return new Response("Ignored", { status: 200, headers: corsHeaders })
        }

        const paymentReference = eventData?.paymentReference as string | undefined
        const amountPaid = Number(eventData?.amountPaid ?? 0)
        const metaData = eventData?.metaData ?? eventData?.meta_data ?? {}

        if (paymentReference?.startsWith("WAL-") || metaData?.type === "wallet_topup") {
            if (!paymentReference) {
                return new Response("Wallet payment reference missing", { status: 400, headers: corsHeaders })
            }

            const verified = await verifyTransaction(paymentReference)
            const verifiedAmountKobo = Math.round(Number(verified.amountPaid ?? 0) * 100)
            const settlementAmountKobo = Math.round(Number(verified.settlementAmount ?? 0) * 100)
            const webhookAmountKobo = Math.round(amountPaid * 100)

            if (
                verified.paymentReference !== paymentReference ||
                verified.paymentStatus !== "PAID" ||
                verifiedAmountKobo <= 0 ||
                webhookAmountKobo !== verifiedAmountKobo
            ) {
                console.error("Wallet top-up verification failed", {
                    paymentReference,
                    verifiedReference: verified.paymentReference,
                    verifiedStatus: verified.paymentStatus,
                    verifiedAmountKobo,
                    webhookAmountKobo,
                })
                return new Response("Wallet top-up validation failed", { status: 400, headers: corsHeaders })
            }

            const { data, error } = await supabase.rpc("handle_wallet_topup_payment", {
                p_reference: paymentReference,
                p_amount_paid_kobo: verifiedAmountKobo,
                p_settlement_amount_kobo: settlementAmountKobo,
                p_monnify_transaction_reference: verified.transactionReference ?? null,
            })

            if (error || !data?.success) {
                console.error("Wallet top-up processing failed:", error ?? data)
                return new Response("Wallet top-up processing failed", { status: 500, headers: corsHeaders })
            }

            return new Response("Wallet top-up processed", { status: 200, headers: corsHeaders })
        }

        if (metaData?.type === "order_payment" && metaData?.order_id) {
            const { data: order, error: orderError } = await supabase
                .from("orders")
                .select("id, total_amount, payment_ref, status, payment_status")
                .eq("id", metaData.order_id)
                .single()

            if (orderError || !order || !paymentReference || order.payment_ref !== paymentReference) {
                console.error("Order payment reference mismatch", orderError)
                return new Response("Order payment validation failed", { status: 400, headers: corsHeaders })
            }

            const verified = await verifyTransaction(paymentReference)
            const verifiedAmountKobo = Math.round(Number(verified.amountPaid ?? 0) * 100)
            const webhookAmountKobo = Math.round(amountPaid * 100)

            if (
                verified.paymentReference !== order.payment_ref ||
                verified.paymentStatus !== "PAID" ||
                verifiedAmountKobo !== order.total_amount ||
                webhookAmountKobo !== order.total_amount
            ) {
                console.error("Order payment amount or status mismatch", {
                    orderId: order.id,
                    expectedAmountKobo: order.total_amount,
                    verifiedAmountKobo,
                    webhookAmountKobo,
                    verifiedStatus: verified.paymentStatus,
                })
                return new Response("Order payment validation failed", { status: 400, headers: corsHeaders })
            }

            // A customer can close or cancel an order while the external payment
            // is still completing. Preserve the verified funds exactly once by
            // crediting their site wallet instead of losing the late payment.
            if (
                order.status === "cancelled" ||
                order.status === "refunded" ||
                order.payment_status === "failed" ||
                order.payment_status === "refunded"
            ) {
                const { data, error } = await supabase.rpc("handle_late_order_payment", {
                    p_order_id: order.id,
                    p_payment_reference: paymentReference,
                    p_amount_kobo: verifiedAmountKobo,
                })

                if (error || !data?.success) {
                    console.error("Late order payment recovery failed:", error ?? data)
                    return new Response("Late payment recovery failed", { status: 500, headers: corsHeaders })
                }

                return new Response("Late order payment credited", { status: 200, headers: corsHeaders })
            }

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
            if (!paymentReference) {
                return new Response("Gift card payment validation failed", { status: 400, headers: corsHeaders })
            }

            const { data: giftCard, error: giftCardError } = await supabase
                .from("gift_cards")
                .select("id, amount_kobo, payment_reference, status")
                .eq("id", metaData.gift_card_id)
                .single()
            const verified = await verifyTransaction(paymentReference)
            const amountKobo = Math.round(Number(verified.amountPaid ?? 0) * 100)

            if (
                giftCardError || !giftCard ||
                giftCard.payment_reference !== paymentReference ||
                verified.paymentReference !== paymentReference ||
                verified.paymentStatus !== "PAID" ||
                amountKobo !== giftCard.amount_kobo ||
                Math.round(amountPaid * 100) !== giftCard.amount_kobo
            ) {
                console.error("Gift card payment validation failed", giftCardError)
                return new Response("Gift card payment validation failed", { status: 400, headers: corsHeaders })
            }

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

