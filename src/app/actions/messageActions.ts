"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import type { OrderChatChannel } from "@/lib/orderChat"

interface OrderMessageActionResult {
    success: boolean
    message?: string
}

function revalidateOrderMessagePaths(orderId: string) {
    revalidatePath("/account/messages")
    revalidatePath("/merchant/messages")
    revalidatePath("/agent/messages")
    revalidatePath("/rider/messages")
    revalidatePath(`/account/orders/${orderId}`)
    revalidatePath(`/merchant/orders/${orderId}`)
    revalidatePath("/agent/orders")
    revalidatePath("/rider")
}

export async function sendOrderMessage(orderId: string, channel: OrderChatChannel, body: string): Promise<OrderMessageActionResult> {
    const supabase = await createClient()
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
        return { success: false, message: "Authentication failed." }
    }

    const trimmedBody = body.trim()
    if (!trimmedBody) {
        return { success: false, message: "Message cannot be empty." }
    }

    if (trimmedBody.length > 2000) {
        return { success: false, message: "Message is too long." }
    }

    const { data: canAccess, error: accessError } = await supabase.rpc("can_access_order_chat", {
        p_order_id: orderId,
        p_channel: channel,
        p_user_id: user.id,
    })

    if (accessError) {
        console.error("can_access_order_chat RPC error:", accessError)
        return { success: false, message: accessError.message }
    }

    if (!canAccess) {
        return { success: false, message: "You do not have access to this order thread." }
    }

    const { error } = await supabase
        .from("order_messages")
        .insert({
            order_id: orderId,
            channel,
            sender_id: user.id,
            body: trimmedBody,
        })

    if (error) {
        console.error("sendOrderMessage insert error:", error)
        return { success: false, message: error.message }
    }

    revalidateOrderMessagePaths(orderId)
    return { success: true }
}

export async function markOrderChatRead(orderId: string, channel: OrderChatChannel): Promise<OrderMessageActionResult> {
    const supabase = await createClient()
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
        return { success: false, message: "Authentication failed." }
    }

    const { data, error } = await supabase.rpc("mark_order_chat_read", {
        p_order_id: orderId,
        p_channel: channel,
        p_user_id: user.id,
    })

    if (error) {
        console.error("mark_order_chat_read RPC error:", error)
        return { success: false, message: error.message }
    }

    if (!data) {
        return { success: false, message: "Unable to update the read state for this thread." }
    }

    revalidateOrderMessagePaths(orderId)
    return { success: true }
}
