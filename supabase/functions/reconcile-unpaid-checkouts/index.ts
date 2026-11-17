import { createClient } from "npm:@supabase/supabase-js@2.90.1"
import { getAccessToken, MONNIFY_API_URL } from "../_shared/monnify.ts"

type Checkout = {
    order_id: string
    checkout_group_id: string | null
    payment_reference: string
    expected_kobo: number
}

Deno.serve(async (request: Request) => {
    if (request.method !== "POST") return new Response(null, { status: 405 })
    const token = request.headers.get("x-checkout-worker-token")
    if (!token) return new Response(null, { status: 401 })

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
    const { data, error } = await supabase.rpc("claim_unpaid_checkout_checks", { p_worker_token: token })
    if (error) {
        if (error.code === "42501") return new Response(null, { status: 401 })
        console.error("Unable to claim unpaid checkout checks", error.code)
        return new Response(null, { status: 500 })
    }

    const checkouts = data as Checkout[]
    if (!checkouts.length) return Response.json({ checked: 0, closed: 0, confirmed: 0 })

    try {
        const accessToken = await getAccessToken()
        const results = await Promise.all(checkouts.map(async (checkout) => {
            try {
                const url = new URL("/api/v2/merchant/transactions/query", MONNIFY_API_URL)
                url.searchParams.set("paymentReference", checkout.payment_reference)
                const response = await fetch(url, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                    signal: AbortSignal.timeout(8000),
                })
                if (!response.ok) return "unverified"
                const result = await response.json()
                const verified = result.responseBody
                if (!result.requestSuccessful || verified?.paymentReference !== checkout.payment_reference) return "unverified"

                const status = verified.paymentStatus
                const paid = verified.amountPaid
                const hasAmount = typeof paid === "number" || (typeof paid === "string" && paid.trim() !== "")
                if ((status === "FAILED" || status === "EXPIRED") && hasAmount && Number(paid) === 0) {
                    const closed = await supabase.rpc("close_verified_unpaid_checkout", {
                        p_order_id: checkout.order_id,
                        p_group_id: checkout.checkout_group_id,
                        p_reference: checkout.payment_reference,
                        p_gateway_status: status,
                    })
                    if (closed.error) throw closed.error
                    return closed.data ? "closed" : "unchanged"
                }

                if (checkout.checkout_group_id && status === "PAID" && hasAmount &&
                    Math.round(Number(paid) * 100) === checkout.expected_kobo) {
                    const confirmed = await supabase.rpc("confirm_delivery_checkout_payment", {
                        p_group_id: checkout.checkout_group_id,
                        p_reference: checkout.payment_reference,
                        p_amount_kobo: checkout.expected_kobo,
                    })
                    if (confirmed.error || !confirmed.data?.success) throw new Error("Could not confirm checkout")
                    return "confirmed"
                }

                return "unchanged"
            } catch {
                console.error("Unpaid checkout reconciliation failed", checkout.order_id)
                return "error"
            }
        }))

        return Response.json({
            checked: checkouts.length,
            closed: results.filter(result => result === "closed").length,
            confirmed: results.filter(result => result === "confirmed").length,
            unverified: results.filter(result => result === "unverified" || result === "error").length,
        })
    } catch {
        console.error("Could not authenticate payment status checks")
        return new Response(null, { status: 502 })
    }
})
