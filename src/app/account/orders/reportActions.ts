"use server"

import { createClient } from "@/lib/supabase/server"

export async function reportCustomerOrder(orderId: string, details: string, replyEmail: string) {
    const message = details.trim()
    if (!/^[0-9a-f-]{36}$/i.test(orderId) || message.length < 2 || message.length > 2000) {
        return { error: "Enter a brief description of the problem." }
    }
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Sign in to report this order." }
    const { data: order, error } = await supabase.from("orders").select("id")
        .eq("id", orderId).eq("customer_id", user.id).maybeSingle()
    if (error || !order) return { error: "This order is unavailable." }

    const email = user.email || replyEmail.trim()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254) {
        return { error: "Enter an email address where support can reach you." }
    }
    const name = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : ""
    const { data, error: startError } = await supabase.rpc("start_support_conversation", {
        p_name: name.length > 1 ? name.slice(0, 100) : "RSS Customer",
        p_email: email,
        p_phone: user.phone || null,
        p_subject: `Order report #${order.id.slice(0, 8).toUpperCase()}`,
        p_initial_message: `Order reference: ${order.id}\n\n${message}`,
        p_channel: "contact_page",
    })
    if (startError || !data?.conversationId || !data?.accessToken) return { error: "Couldn’t send the report. Try again." }

    const { error: escalationError } = await supabase.rpc("append_support_assistant_message", {
        p_conversation_id: data.conversationId,
        p_access_token: data.accessToken,
        p_body: "This order report needs review by the support team.",
        p_should_escalate: true,
        p_ai_generated: false,
        p_metadata: { order_id: order.id },
    })
    return { reference: String(data.conversationId).slice(0, 8).toUpperCase(), escalated: !escalationError }
}
