"use server"

import { createClient } from "@/lib/supabase/server"
import type { OrderChatChannel } from "@/lib/orderChat"

interface OrderMessageActionResult {
    success: boolean
    message?: string
}

export async function sendOrderMessage(orderId: string, channel: OrderChatChannel, body: string, messageId?: string): Promise<OrderMessageActionResult> {
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

    const message = {
        order_id: orderId,
        channel,
        sender_id: user.id,
        body: trimmedBody,
    }
    const table = supabase.from("order_messages")
    const { error } = messageId
        ? await table.upsert({ ...message, id: messageId }, { onConflict: "id", ignoreDuplicates: true })
        : await table.insert(message)

    if (error) {
        console.error("sendOrderMessage insert error:", error)
        return { success: false, message: error.message }
    }

    return { success: true }
}

export async function markOrderChatRead(orderId: string, channel: OrderChatChannel, messageId: string): Promise<OrderMessageActionResult> {
    const supabase = await createClient()
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
        return { success: false, message: "Authentication failed." }
    }

    const { data, error } = await supabase.rpc("read_order_chat_through_message", {
        p_order_id: orderId,
        p_channel: channel,
        p_message_id: messageId,
    })

    if (error) {
        console.error("read_order_chat_through_message RPC error:", error)
        return { success: false, message: error.message }
    }

    if (!data) {
        return { success: false, message: "Unable to update the read state for this thread." }
    }

    return { success: true }
}
