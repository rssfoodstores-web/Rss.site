export type ChatWorkspace = "customer" | "merchant" | "agent" | "rider"
export type OrderChatChannel = "customer" | "ops"

export interface OrderChatThread {
    order_id: string
    order_status: string | null
    order_created_at: string | null
    total_amount: number
    current_user_role: string | null
    customer_id: string | null
    customer_name: string | null
    customer_phone: string | null
    customer_avatar_url: string | null
    merchant_id: string | null
    merchant_name: string | null
    merchant_phone: string | null
    merchant_avatar_url: string | null
    agent_id: string | null
    agent_name: string | null
    agent_phone: string | null
    agent_avatar_url: string | null
    rider_id: string | null
    rider_name: string | null
    rider_phone: string | null
    rider_avatar_url: string | null
    last_message_at: string | null
    last_message_preview: string | null
    last_message_sender_id: string | null
    last_message_sender_name: string | null
    last_message_channel: OrderChatChannel | null
    unread_count: number
    customer_unread_count: number
    ops_unread_count: number
    accessible_channels: OrderChatChannel[]
}

export interface OrderChatParticipant {
    profile_id: string
    role: string
    full_name: string | null
    phone: string | null
    avatar_url: string | null
    address: string | null
    is_current_user: boolean
    sort_order: number
}

export interface OrderChatMessage {
    id: string
    order_id: string
    channel: OrderChatChannel
    sender_id: string
    sender_role: string | null
    sender_name: string | null
    sender_phone: string | null
    sender_avatar_url: string | null
    body: string
    created_at: string
    is_mine: boolean
}

export function getChatWorkspaceCopy(workspace: ChatWorkspace) {
    switch (workspace) {
        case "customer":
            return {
                title: "Order messages",
                description: "Use the customer thread for updates tied to each order and keep the full conversation history in one place.",
            }
        case "merchant":
            return {
                title: "Merchant messages",
                description: "Each order now has a customer thread and an internal operations thread so coordination stays clear.",
            }
        case "agent":
            return {
                title: "Order communications",
                description: "Coordinate customers in one thread and merchant-rider operations in another without mixing the two.",
            }
        case "rider":
            return {
                title: "Delivery messages",
                description: "Use the customer thread when you need the buyer and the operations thread for merchant-agent-rider coordination.",
            }
    }
}

export function getDefaultChatChannel(workspace: ChatWorkspace): OrderChatChannel {
    return workspace === "customer" ? "customer" : "ops"
}

export function formatChatChannelLabel(channel: OrderChatChannel) {
    return channel === "ops" ? "Operations thread" : "Customer thread"
}

export function getChatChannelDescription(channel: OrderChatChannel) {
    return channel === "ops"
        ? "Internal coordination for merchant, agent, and rider activity on this order."
        : "Customer-facing updates and replies tied to this order."
}

export function getOrderMessagesHref(workspace: ChatWorkspace, orderId: string, channel?: OrderChatChannel) {
    const targetChannel = channel ?? getDefaultChatChannel(workspace)

    switch (workspace) {
        case "customer":
            return `/account/messages?order=${orderId}&channel=${targetChannel}`
        case "merchant":
            return `/merchant/messages?order=${orderId}&channel=${targetChannel}`
        case "agent":
            return `/agent/messages?order=${orderId}&channel=${targetChannel}`
        case "rider":
            return `/rider/messages?order=${orderId}&channel=${targetChannel}`
    }
}

export function getOrderDetailHref(workspace: ChatWorkspace, orderId: string) {
    switch (workspace) {
        case "customer":
            return `/account/orders/${orderId}`
        case "merchant":
            return `/merchant/orders/${orderId}`
        case "agent":
            return `/agent/orders?order=${orderId}`
        case "rider":
            return "/rider"
    }
}

export function formatChatRoleLabel(role: string | null | undefined) {
    if (!role) {
        return "Participant"
    }

    switch (role) {
        case "customer":
            return "Customer"
        case "merchant":
            return "Merchant"
        case "agent":
            return "Agent"
        case "rider":
            return "Rider"
        default:
            return role.replace(/_/g, " ")
    }
}

export function getThreadParticipantSummary(thread: OrderChatThread, workspace: ChatWorkspace) {
    const names: string[] = []

    if (workspace !== "customer" && thread.customer_name) {
        names.push(`Customer: ${thread.customer_name}`)
    }

    if (workspace !== "merchant" && thread.merchant_name) {
        names.push(`Merchant: ${thread.merchant_name}`)
    }

    if (workspace !== "agent" && thread.agent_name) {
        names.push(`Agent: ${thread.agent_name}`)
    }

    if (workspace !== "rider" && thread.rider_name) {
        names.push(`Rider: ${thread.rider_name}`)
    }

    return names.length > 0 ? names.join(" | ") : "No participants available yet"
}
