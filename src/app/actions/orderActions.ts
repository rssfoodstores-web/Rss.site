"use server"

import {
    FunctionsHttpError,
    FunctionsRelayError,
    FunctionsFetchError,
} from "@supabase/functions-js"
import { createServerClient } from "@supabase/ssr"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { koboToNaira } from "@/lib/money"

interface OrderItemInput {
    product_id: string
    quantity: number
}

interface BaseOrderParams {
    userId: string
    items: OrderItemInput[]
    deliveryLocation: {
        type: "Point"
        coordinates: [number, number]
    } | null
    deliveryFeeKobo: number
    contactNumbers: string[]
    rewardPointsToRedeem?: number
}

interface OrderActionResult {
    success?: boolean
    orderId?: string
    checkoutUrl?: string
    reference?: string
    error?: string
    message?: string
}

async function getSupabase() {
    const cookieStore = await cookies()

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                        // Server Components cannot always mutate cookies.
                    }
                },
            },
        }
    )
}

function getEdgeFunctionClient() {
    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                detectSessionInUrl: false,
                persistSession: false,
            },
        }
    )
}

async function getEdgeFunctionErrorMessage(error: unknown) {
    if (error instanceof FunctionsHttpError) {
        const response = error.context as Response | undefined

        if (response) {
            try {
                const payload = await response.clone().json() as {
                    error?: string
                    message?: string
                }

                if (typeof payload.error === "string" && payload.error) {
                    return payload.error
                }

                if (typeof payload.message === "string" && payload.message) {
                    return payload.message
                }
            } catch {
                try {
                    const text = await response.clone().text()
                    if (text) {
                        return text
                    }
                } catch {
                }
            }

            return `Edge Function returned status ${response.status}.`
        }
    }

    if (error instanceof FunctionsRelayError) {
        return "Supabase relay could not reach the Edge Function."
    }

    if (error instanceof FunctionsFetchError) {
        return "Unable to reach Supabase Edge Functions."
    }

    if (error instanceof Error) {
        return error.message
    }

    return "Unexpected Edge Function error."
}

function shouldRetryWithAnon(error: unknown, message: string) {
    const normalizedMessage = message.trim().toLowerCase()

    if (normalizedMessage === "invalid jwt") {
        return true
    }

    if (error instanceof FunctionsHttpError) {
        const response = error.context as Response | undefined
        return response?.status === 401
    }

    return false
}

async function invokeMonnifyInit(
    supabase: Awaited<ReturnType<typeof getSupabase>>,
    body: Record<string, unknown>
) {
    const primaryResult = await supabase.functions.invoke("monnify-init", { body })

    if (!primaryResult.error) {
        return primaryResult
    }

    const message = await getEdgeFunctionErrorMessage(primaryResult.error)

    if (shouldRetryWithAnon(primaryResult.error, message)) {
        const fallbackResult = await getEdgeFunctionClient().functions.invoke("monnify-init", { body })

        if (fallbackResult.error) {
            throw new Error(await getEdgeFunctionErrorMessage(fallbackResult.error))
        }

        return fallbackResult
    }

    throw new Error(message)
}

function sanitizeItems(items: OrderItemInput[]): OrderItemInput[] {
    return items
        .filter((item) => item.product_id && item.quantity > 0)
        .map((item) => ({
            product_id: item.product_id,
            quantity: Math.floor(item.quantity),
        }))
}

function sanitizeContactNumbers(contactNumbers: string[]): string[] {
    return contactNumbers
        .map((contact) => contact.trim())
        .filter(Boolean)
        .slice(0, 3)
}

function sanitizeRewardPoints(points: number | undefined) {
    if (!Number.isFinite(points)) {
        return 0
    }

    return Math.max(0, Math.floor(points ?? 0))
}

async function cancelPendingOrderReservation(
    supabase: Awaited<ReturnType<typeof getSupabase>>,
    orderId: string
) {
    const { error } = await supabase.rpc("cancel_unpaid_order", {
        p_order_id: orderId,
    })

    if (error) {
        console.error("cancel_unpaid_order RPC error:", error)
    }
}

export async function processWalletPayment({
    items,
    deliveryLocation,
    deliveryFeeKobo,
    contactNumbers,
    rewardPointsToRedeem,
}: BaseOrderParams): Promise<OrderActionResult> {
    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    const authenticatedUserId = user?.id ?? null

    if (!authenticatedUserId) {
        return { error: "Authentication required." }
    }

    const { data, error } = await supabase.rpc("create_paid_order", {
        p_user_id: authenticatedUserId,
        p_items: sanitizeItems(items),
        p_delivery_location: deliveryLocation,
        p_delivery_fee_kobo: Math.max(0, deliveryFeeKobo),
        p_contact_numbers: sanitizeContactNumbers(contactNumbers),
        p_payment_reference: null,
        p_points_to_redeem: sanitizeRewardPoints(rewardPointsToRedeem),
    })

    if (error) {
        console.error("create_paid_order RPC error:", error)
        return { error: error.message }
    }

    if (!data?.success) {
        return { error: data?.error ?? "Unable to create wallet order." }
    }

    revalidatePath("/account/wallet")
    revalidatePath("/account/rewards")
    revalidatePath("/account/orders")
    revalidatePath("/merchant/orders")
    revalidatePath("/merchant/products")

    return {
        success: true,
        orderId: data.order_id,
        reference: data.payment_reference,
    }
}

export async function processGiftCardPayment({
    items,
    deliveryLocation,
    deliveryFeeKobo,
    contactNumbers,
    rewardPointsToRedeem,
}: BaseOrderParams): Promise<OrderActionResult> {
    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    const authenticatedUserId = user?.id ?? null

    if (!authenticatedUserId) {
        return { error: "Authentication required." }
    }

    const { data, error } = await supabase.rpc("create_paid_order_with_gift_card", {
        p_user_id: authenticatedUserId,
        p_items: sanitizeItems(items),
        p_delivery_location: deliveryLocation,
        p_delivery_fee_kobo: Math.max(0, deliveryFeeKobo),
        p_contact_numbers: sanitizeContactNumbers(contactNumbers),
        p_payment_reference: null,
        p_points_to_redeem: sanitizeRewardPoints(rewardPointsToRedeem),
    })

    if (error) {
        console.error("create_paid_order_with_gift_card RPC error:", error)
        return { error: error.message }
    }

    if (!data?.success) {
        return { error: data?.error ?? "Unable to create gift card order." }
    }

    revalidatePath("/account/gift-card")
    revalidatePath("/account/rewards")
    revalidatePath("/account/orders")
    revalidatePath("/merchant/orders")
    revalidatePath("/merchant/products")
    revalidatePath("/account/notifications")

    return {
        success: true,
        orderId: data.order_id,
        reference: data.payment_reference,
    }
}

export async function initiateDirectPayment({
    items,
    deliveryLocation,
    deliveryFeeKobo,
    contactNumbers,
    rewardPointsToRedeem,
}: BaseOrderParams): Promise<OrderActionResult> {
    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    const authenticatedUserId = user?.id ?? null

    if (!authenticatedUserId) {
        return { error: "Authentication required." }
    }

    const paymentReference = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`

    const pendingOrder = await supabase.rpc("create_pending_order", {
        p_user_id: authenticatedUserId,
        p_items: sanitizeItems(items),
        p_delivery_location: deliveryLocation,
        p_delivery_fee_kobo: Math.max(0, deliveryFeeKobo),
        p_contact_numbers: sanitizeContactNumbers(contactNumbers),
        p_payment_reference: paymentReference,
        p_points_to_redeem: sanitizeRewardPoints(rewardPointsToRedeem),
    })

    if (pendingOrder.error) {
        console.error("create_pending_order RPC error:", pendingOrder.error)
        return { error: pendingOrder.error.message }
    }

    if (!pendingOrder.data?.success) {
        return { error: pendingOrder.data?.error ?? "Unable to create pending order." }
    }

    const { data: orderRow, error: orderRowError } = await supabase
        .from("orders")
        .select("total_amount")
        .eq("id", pendingOrder.data.order_id)
        .single()

    if (orderRowError || !orderRow) {
        console.error("Failed to fetch pending order total:", orderRowError)
        await cancelPendingOrderReservation(supabase, pendingOrder.data.order_id)
        return {
            error: "Pending order was created but its payment total could not be loaded.",
            orderId: pendingOrder.data.order_id,
            reference: paymentReference,
        }
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", authenticatedUserId)
        .single()

    let functionResult: {
        checkoutUrl?: string
        checkout_url?: string
    }

    try {
        const response = await invokeMonnifyInit(supabase, {
            amount: koboToNaira(orderRow.total_amount ?? 0),
            customerName: profile?.full_name ?? "RSS Foods Customer",
            customerEmail: user?.email,
            paymentReference,
            paymentDescription: `Order ${pendingOrder.data.order_id} payment`,
            redirectPath: `/account/orders/${pendingOrder.data.order_id}`,
            metadata: {
                type: "order_payment",
                order_id: pendingOrder.data.order_id,
                user_id: authenticatedUserId,
            },
        })

        functionResult = response.data ?? {}
    } catch (error) {
        console.error("monnify-init invoke error:", error)
        await cancelPendingOrderReservation(supabase, pendingOrder.data.order_id)
        return {
            error: error instanceof Error ? error.message : "Unable to initialize direct payment.",
            orderId: pendingOrder.data.order_id,
            reference: paymentReference,
        }
    }

    const checkoutUrl = functionResult.checkoutUrl ?? functionResult.checkout_url

    if (!checkoutUrl) {
        await cancelPendingOrderReservation(supabase, pendingOrder.data.order_id)
        return {
            error: "Unable to initialize direct payment.",
            orderId: pendingOrder.data.order_id,
            reference: paymentReference,
        }
    }

    revalidatePath("/account/orders")
    revalidatePath("/account/rewards")

    return {
        success: true,
        orderId: pendingOrder.data.order_id,
        reference: paymentReference,
        checkoutUrl,
    }
}

export async function cancelUnpaidOrder(orderId: string): Promise<OrderActionResult> {
    const supabase = await getSupabase()
    const { data, error } = await supabase.rpc("cancel_unpaid_order", {
        p_order_id: orderId,
    })

    if (error) {
        console.error("cancel_unpaid_order RPC error:", error)
        return { success: false, message: error.message }
    }

    if (!data?.success) {
        return { success: false, message: data?.error ?? "Unable to cancel unpaid order." }
    }

    revalidatePath("/account/orders")
    revalidatePath(`/account/orders/${orderId}`)
    revalidatePath("/account/rewards")

    return { success: true, message: "Pending order cancelled." }
}

export async function requestRider(orderId: string): Promise<OrderActionResult> {
    const supabase = await getSupabase()
    const { data, error } = await supabase.rpc("request_rider_for_order", {
        p_order_id: orderId,
    })

    if (error) {
        console.error("request_rider_for_order RPC error:", error)
        return { success: false, message: error.message }
    }

    if (!data?.success) {
        return { success: false, message: data?.error ?? "Unable to request rider." }
    }

    revalidatePath("/merchant/orders")
    revalidatePath(`/merchant/orders/${orderId}`)
    revalidatePath("/agent")
    revalidatePath("/rider")

    return { success: true, message: "Rider request opened." }
}

export async function verifyMerchantPickup(orderId: string, otp: string): Promise<OrderActionResult> {
    const supabase = await getSupabase()
    const { data, error } = await supabase.rpc("verify_pickup", {
        p_order_id: orderId,
        p_pickup_code: otp.trim(),
    })

    if (error) {
        console.error("verify_pickup RPC error:", error)
        return { success: false, message: error.message }
    }

    if (!data?.success) {
        return { success: false, message: data?.error ?? "Unable to verify pickup." }
    }

    revalidatePath("/merchant")
    revalidatePath("/merchant/orders")
    revalidatePath(`/merchant/orders/${orderId}`)
    revalidatePath("/agent")
    revalidatePath("/rider")
    revalidatePath(`/account/orders/${orderId}`)

    return { success: true, message: "Pickup verified." }
}

export async function confirmMerchantOrder(orderId: string): Promise<OrderActionResult> {
    const supabase = await getSupabase()
    const { data, error } = await supabase.rpc("confirm_merchant_order", {
        p_order_id: orderId,
    })

    if (error) {
        console.error("confirm_merchant_order RPC error:", error)
        return { success: false, message: error.message }
    }

    if (!data?.success) {
        return { success: false, message: data?.error ?? "Unable to confirm order." }
    }

    revalidatePath("/merchant/orders")
    revalidatePath(`/merchant/orders/${orderId}`)
    revalidatePath("/agent")

    return { success: true }
}

export async function acceptAgentAssignment(orderId: string): Promise<OrderActionResult> {
    const supabase = await getSupabase()
    const { data, error } = await supabase.rpc("accept_agent_assignment", {
        p_order_id: orderId,
    })

    if (error) {
        console.error("accept_agent_assignment RPC error:", error)
        return { success: false, message: error.message }
    }

    if (!data?.success) {
        return { success: false, message: data?.error ?? "Unable to accept assignment." }
    }

    revalidatePath("/agent")
    revalidatePath("/merchant/orders")
    revalidatePath(`/merchant/orders/${orderId}`)

    return { success: true }
}

export async function openOrderDispute(orderId: string, reason: string): Promise<OrderActionResult> {
    const supabase = await getSupabase()
    const trimmedReason = reason.trim()

    if (!trimmedReason) {
        return { success: false, message: "Please provide a reason for the dispute." }
    }

    const { data, error } = await supabase.rpc("open_order_dispute", {
        p_order_id: orderId,
        p_reason: trimmedReason,
    })

    if (error) {
        console.error("open_order_dispute RPC error:", error)
        return { success: false, message: error.message }
    }

    if (!data?.success) {
        return { success: false, message: data?.error ?? "Unable to open dispute." }
    }

    revalidatePath("/account/orders")
    revalidatePath(`/account/orders/${orderId}`)

    return { success: true }
}
