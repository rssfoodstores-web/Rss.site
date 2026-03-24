export type OrderStatus =
    | "pending"
    | "awaiting_agent_acceptance"
    | "awaiting_merchant_confirmation"
    | "processing"
    | "ready_for_pickup"
    | "out_for_delivery"
    | "delivered"
    | "completed"
    | "cancelled"
    | "disputed"
    | "refunded"

export type PaymentStatus = "pending" | "paid" | "failed" | "refunded"
export type SettlementStatus = "pending" | "completed" | "failed" | "refunded" | "disputed"

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
    pending: "Pending payment",
    awaiting_agent_acceptance: "Waiting on agent",
    awaiting_merchant_confirmation: "Waiting on merchant",
    processing: "Preparing order",
    ready_for_pickup: "Ready for rider pickup",
    out_for_delivery: "Out for delivery",
    delivered: "Delivered",
    completed: "Completed",
    cancelled: "Cancelled",
    disputed: "Disputed",
    refunded: "Refunded",
}

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
    pending: "Payment pending",
    paid: "Paid",
    failed: "Payment failed",
    refunded: "Refunded",
}

const SETTLEMENT_STATUS_LABELS: Record<SettlementStatus, string> = {
    pending: "Settlement pending",
    completed: "Settled",
    failed: "Settlement failed",
    refunded: "Refunded",
    disputed: "Disputed",
}

export function formatOrderStatus(status: string | null | undefined): string {
    if (!status) {
        return "Unknown"
    }

    return ORDER_STATUS_LABELS[status as OrderStatus] ?? status.replace(/_/g, " ")
}

export function getOrderOperationalHint(
    status: string | null | undefined,
    options?: { riderAssigned?: boolean }
): string | null {
    switch (status) {
        case "awaiting_agent_acceptance":
            return "Waiting for the assigned agent to accept this order."
        case "awaiting_merchant_confirmation":
            return "Waiting for merchant confirmation so preparation can begin."
        case "processing":
            return "Order confirmed. Waiting for the assigned agent to open rider dispatch."
        case "ready_for_pickup":
            return options?.riderAssigned
                ? "Rider has claimed this order. Verify the pickup code at handoff."
                : "Rider request is open. Waiting for a rider to claim pickup."
        case "out_for_delivery":
            return "Order is with the rider and heading to the customer."
        case "delivered":
        case "completed":
            return "Order delivered and settlement completed."
        case "cancelled":
            return "Order was cancelled before completion."
        case "disputed":
            return "This order is currently under dispute review."
        case "refunded":
            return "This order has been refunded."
        default:
            return null
    }
}

export function getCustomerOrderTimeline(status: string | null | undefined): OrderStatus[] {
    const completedStatus = status === "completed" ? "completed" : "delivered"

    return [
        "pending",
        "awaiting_agent_acceptance",
        "awaiting_merchant_confirmation",
        "processing",
        "ready_for_pickup",
        "out_for_delivery",
        completedStatus,
    ]
}

export function getOrderStatusTone(status: string | null | undefined): string {
    switch (status) {
        case "completed":
        case "delivered":
            return "text-green-600 bg-green-50 border-green-100 dark:bg-green-900/10 dark:border-green-900"
        case "cancelled":
        case "refunded":
            return "text-red-600 bg-red-50 border-red-100 dark:bg-red-900/10 dark:border-red-900"
        case "disputed":
            return "text-amber-700 bg-amber-50 border-amber-100 dark:bg-amber-900/10 dark:border-amber-900"
        case "out_for_delivery":
        case "ready_for_pickup":
            return "text-blue-600 bg-blue-50 border-blue-100 dark:bg-blue-900/10 dark:border-blue-900"
        case "processing":
        case "awaiting_agent_acceptance":
        case "awaiting_merchant_confirmation":
            return "text-orange-600 bg-orange-50 border-orange-100 dark:bg-orange-900/10 dark:border-orange-900"
        default:
            return "text-gray-600 bg-gray-100 border-gray-200 dark:bg-zinc-800 dark:border-zinc-700"
    }
}

export function formatPaymentStatus(status: string | null | undefined): string {
    if (!status) {
        return "Unknown"
    }

    return PAYMENT_STATUS_LABELS[status as PaymentStatus] ?? status.replace(/_/g, " ")
}

export function getPaymentStatusTone(status: string | null | undefined): string {
    switch (status) {
        case "paid":
            return "text-green-700 bg-green-50 border-green-100 dark:bg-green-900/10 dark:border-green-900"
        case "pending":
            return "text-orange-700 bg-orange-50 border-orange-100 dark:bg-orange-900/10 dark:border-orange-900"
        case "failed":
            return "text-red-700 bg-red-50 border-red-100 dark:bg-red-900/10 dark:border-red-900"
        case "refunded":
            return "text-blue-700 bg-blue-50 border-blue-100 dark:bg-blue-900/10 dark:border-blue-900"
        default:
            return "text-gray-600 bg-gray-100 border-gray-200 dark:bg-zinc-800 dark:border-zinc-700"
    }
}

export function formatSettlementStatus(status: string | null | undefined): string {
    if (!status) {
        return "Unknown"
    }

    return SETTLEMENT_STATUS_LABELS[status as SettlementStatus] ?? status.replace(/_/g, " ")
}

export function getSettlementTone(status: string | null | undefined): string {
    switch (status) {
        case "completed":
            return "text-green-700 bg-green-50 border-green-100 dark:bg-green-900/10 dark:border-green-900"
        case "pending":
            return "text-orange-700 bg-orange-50 border-orange-100 dark:bg-orange-900/10 dark:border-orange-900"
        case "failed":
            return "text-red-700 bg-red-50 border-red-100 dark:bg-red-900/10 dark:border-red-900"
        case "refunded":
            return "text-blue-700 bg-blue-50 border-blue-100 dark:bg-blue-900/10 dark:border-blue-900"
        case "disputed":
            return "text-amber-700 bg-amber-50 border-amber-100 dark:bg-amber-900/10 dark:border-amber-900"
        default:
            return "text-gray-600 bg-gray-100 border-gray-200 dark:bg-zinc-800 dark:border-zinc-700"
    }
}
