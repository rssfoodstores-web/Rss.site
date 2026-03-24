"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

interface RiderActionResult {
    success: boolean
    message?: string
}

export async function acceptOrder(orderId: string, riderId: string): Promise<RiderActionResult> {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
        return { success: false, message: "Authentication failed." }
    }

    if (user.id !== riderId) {
        return { success: false, message: "User identity mismatch." }
    }

    const { data, error } = await supabase.rpc("claim_ready_order", {
        p_order_id: orderId,
    })

    if (error) {
        console.error("claim_ready_order RPC error:", error)
        return { success: false, message: error.message }
    }

    if (!data?.success) {
        return { success: false, message: data?.error ?? "Order is no longer available." }
    }

    revalidatePath("/rider")
    revalidatePath("/rider/deliveries")
    revalidatePath("/merchant/orders")
    revalidatePath(`/merchant/orders/${orderId}`)

    return { success: true }
}

export async function verifyPickup(orderId: string, otp: string): Promise<RiderActionResult> {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc("verify_pickup", {
        p_order_id: orderId,
        p_pickup_code: otp.trim(),
    })

    if (error) {
        console.error("verify_pickup RPC error:", error)
        return { success: false, message: error.message }
    }

    if (!data?.success) {
        return { success: false, message: data?.error ?? "Pickup verification failed." }
    }

    revalidatePath("/rider")
    revalidatePath("/rider/deliveries")
    revalidatePath("/merchant/orders")
    revalidatePath(`/merchant/orders/${orderId}`)
    revalidatePath(`/account/orders/${orderId}`)

    return { success: true }
}

export async function verifyDelivery(orderId: string, otp: string): Promise<RiderActionResult> {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc("settle_completed_order", {
        p_order_id: orderId,
        p_delivery_code: otp.trim(),
    })

    if (error) {
        console.error("settle_completed_order RPC error:", error)
        return { success: false, message: error.message }
    }

    if (!data?.success) {
        return { success: false, message: data?.error ?? "Delivery verification failed." }
    }

    revalidatePath("/rider")
    revalidatePath("/rider/deliveries")
    revalidatePath("/merchant/orders")
    revalidatePath(`/merchant/orders/${orderId}`)
    revalidatePath(`/account/orders/${orderId}`)
    revalidatePath("/account/wallet")

    return { success: true }
}

export async function releaseStalePickup(orderId: string): Promise<RiderActionResult> {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc("rider_release_ready_order_assignment", {
        p_order_id: orderId,
    })

    if (error) {
        console.error("rider_release_ready_order_assignment RPC error:", error)
        return { success: false, message: error.message }
    }

    if (!data?.success) {
        return { success: false, message: data?.error ?? "Unable to release pickup assignment." }
    }

    revalidatePath("/rider")
    revalidatePath("/rider/deliveries")
    revalidatePath("/merchant/orders")
    revalidatePath(`/merchant/orders/${orderId}`)
    revalidatePath("/agent")
    revalidatePath(`/account/orders/${orderId}`)

    return { success: true, message: "Pickup assignment released." }
}

export async function updateRiderLocation(lat: number, lng: number) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return
    }

    const { error } = await supabase
        .from("profiles")
        .update({
            location: `POINT(${lng} ${lat})`,
        })
        .eq("id", user.id)

    if (error) {
        console.error("Failed to update rider location:", error)
    }
}

export async function getNearbyOrders(lat: number, lng: number) {
    const supabase = await createClient()

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return []
    }

    const { data, error } = await supabase.rpc("fetch_nearby_orders", {
        lat,
        long: lng,
        radius_meters: 5000,
    })

    if (error) {
        console.error("fetch_nearby_orders RPC error:", error)
        return []
    }

    return data ?? []
}

export async function saveFCMToken(token: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { success: false }
    }

    const { error } = await supabase
        .from("profiles")
        .update({ fcm_token: token })
        .eq("id", user.id)

    if (error) {
        console.error("Failed to save FCM token:", error)
        return { success: false }
    }

    return { success: true }
}
