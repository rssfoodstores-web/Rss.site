import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AgentOrdersWorkspace } from "@/components/agent/AgentOrdersWorkspace"
import { type AppNotification } from "@/lib/notifications"
import { getOrderOperationalHint } from "@/lib/orders"

type AgentOrdersFilter = "all" | "acceptance" | "merchant" | "dispatch"

interface RelationProfile {
    id?: string
    full_name: string | null
    phone?: string | null
    address?: string | null
}

type Relation<T> = T | T[] | null

interface AgentOrderSummaryRow {
    id: string
    status: string | null
    payment_status: string | null
    total_amount: number
    created_at: string | null
    rider_id: string | null
    customer: Relation<RelationProfile>
    merchant: Relation<RelationProfile>
    rider: Relation<RelationProfile>
    order_financials: Relation<{
        settlement_status: string | null
    }>
}

interface AgentOrderAssignmentRow {
    id: string
    assignment_role: string
    assignee_id: string | null
    method: string | null
    reason: string | null
    accepted_at: string | null
    created_at: string | null
}

interface AgentOrderDisputeRow {
    id: string
    status: string | null
    reason: string | null
    resolution_notes: string | null
    created_at: string | null
    resolved_at: string | null
}

interface AgentRefundRow {
    id: string
    amount_kobo: number
    status: string | null
    reason: string | null
    processed_at: string | null
    created_at: string | null
}

interface AgentOrderDetailRow {
    id: string
    rider_id: string | null
    status: string | null
    payment_status: string | null
    total_amount: number
    payment_ref: string | null
    delivery_fee_kobo: number | null
    created_at: string | null
    delivery_location: { coordinates?: [number, number] } | null
    contact_numbers: unknown
    customer: Relation<RelationProfile>
    merchant: Relation<RelationProfile>
    rider: Relation<RelationProfile>
    order_items: Array<{
        id: string
        quantity: number
        price_per_unit: number
        products: {
            id: string
            name: string | null
            image_url: string | null
        } | null
    }> | null
    order_financials: Relation<{
        agent_fee_total_kobo: number
        settlement_status: string | null
    }>
    order_assignments: AgentOrderAssignmentRow[] | null
    order_disputes: AgentOrderDisputeRow[] | null
    refunds: AgentRefundRow[] | null
}

interface AgentOrderItemRow {
    id: string
    quantity: number
    price_per_unit: number
    products: Relation<{
        id: string
        name: string | null
        image_url: string | null
    }>
}

interface ProfileNameRow {
    id: string
    full_name: string | null
}

interface AgentCommissionSummaryRow {
    order_financials: Array<{
        agent_fee_total_kobo: number
        settlement_status: string | null
    }> | null
}

interface CheckpointRow {
    label: string
    description: string
    value: string | null
}

function firstRelation<T>(value: Relation<T>): T | null {
    if (Array.isArray(value)) {
        return value[0] ?? null
    }

    return value ?? null
}

function normalizeOrderItems(value: AgentOrderItemRow[] | null | undefined): AgentOrderDetailRow["order_items"] {
    if (!value?.length) {
        return []
    }

    return value.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        price_per_unit: item.price_per_unit,
        products: firstRelation(item.products),
    }))
}

function normalizeContactNumbers(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return []
    }

    return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
}

function orderNotificationMatches(notification: AppNotification, orderId: string) {
    if (!notification.metadata || typeof notification.metadata !== "object" || Array.isArray(notification.metadata)) {
        return false
    }

    const metadata = notification.metadata as Record<string, unknown>
    return metadata.order_id === orderId
}

function getAgentActionMessage(order: AgentOrderDetailRow) {
    switch (order.status) {
        case "awaiting_merchant_confirmation":
            return "Follow up with the merchant so prep can move forward."
        case "processing":
            return "Prep is on track. Request a rider once the merchant confirms readiness."
        case "ready_for_pickup":
            return order.rider_id
                ? "A rider is assigned. Track the pickup handoff from here."
                : "Dispatch is open. Watch for rider claim or assign manually if needed."
        case "out_for_delivery":
            return "Delivery is in flight. Monitor the rider and customer handoff."
        case "completed":
        case "delivered":
            return "This order is complete."
        case "disputed":
            return "This order has an active issue record."
        case "refunded":
            return "This order has already been refunded."
        default:
            return "Review the current state and complete the next operational action."
    }
}

function getCheckpointRows(order: AgentOrderDetailRow): CheckpointRow[] {
    return [
        {
            label: "Order created",
            value: order.created_at,
            description: "Customer checkout completed.",
        },
        {
            label: "Agent accepted",
            value: order.status === "awaiting_agent_acceptance" ? null : order.created_at,
            description: "Agent took ownership of the order.",
        },
        {
            label: "Merchant confirmed",
            value: order.status === "awaiting_agent_acceptance" || order.status === "awaiting_merchant_confirmation" ? null : order.created_at,
            description: "Merchant confirmed prep and handoff can continue.",
        },
        {
            label: "Dispatch active",
            value: ["processing", "ready_for_pickup", "out_for_delivery", "completed", "delivered"].includes(order.status ?? "") ? order.created_at : null,
            description: "Rider request or rider handoff is active.",
        },
        {
            label: "Delivery complete",
            value: ["completed", "delivered"].includes(order.status ?? "") ? order.created_at : null,
            description: "Customer handoff is finished.",
        },
    ]
}

function parseFilter(value: string | undefined): AgentOrdersFilter {
    if (value === "acceptance" || value === "merchant" || value === "dispatch") {
        return value
    }

    return "all"
}

function filterQueueOrders(orders: AgentOrderSummaryRow[], filter: AgentOrdersFilter) {
    switch (filter) {
        case "acceptance":
            return orders.filter((order) => order.status === "awaiting_agent_acceptance")
        case "merchant":
            return orders.filter((order) => order.status === "awaiting_merchant_confirmation")
        case "dispatch":
            return orders.filter((order) => ["processing", "ready_for_pickup", "out_for_delivery"].includes(order.status ?? ""))
        default:
            return orders
    }
}

export default async function AgentOrdersPage({
    searchParams,
}: {
    searchParams: Promise<{ order?: string; filter?: string }>
}) {
    const { order: requestedOrderId, filter: requestedFilter } = await searchParams
    const activeFilter = parseFilter(requestedFilter)
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect("/login")
    }

    const [{ data: orders, error: ordersError }, { data: agentWallet }, { data: commissionRows }] = await Promise.all([
        supabase
            .from("orders")
            .select(`
                id,
                status,
                payment_status,
                total_amount,
                created_at,
                rider_id,
                customer:customer_id (
                    id,
                    full_name,
                    phone
                ),
                merchant:merchant_id (
                    id,
                    full_name,
                    phone
                ),
                rider:rider_id (
                    id,
                    full_name,
                    phone
                ),
                order_financials (
                    settlement_status
                )
            `)
            .eq("assigned_agent_id", user.id)
            .order("created_at", { ascending: false })
            .limit(30),
        supabase
            .from("wallets")
            .select("balance")
            .eq("owner_id", user.id)
            .eq("type", "agent")
            .maybeSingle(),
        supabase
            .from("orders")
            .select(`
                order_financials (
                    agent_fee_total_kobo,
                    settlement_status
                )
            `)
            .eq("assigned_agent_id", user.id)
            .limit(100),
    ])

    const normalizedOrders = ((orders ?? []) as unknown as AgentOrderSummaryRow[])
    const activeManagedOrders = normalizedOrders.filter((order) =>
        ["awaiting_agent_acceptance", "awaiting_merchant_confirmation", "processing", "ready_for_pickup", "out_for_delivery"].includes(order.status ?? "")
    )

    const filterCounts = {
        all: activeManagedOrders.length,
        acceptance: activeManagedOrders.filter((order) => order.status === "awaiting_agent_acceptance").length,
        merchant: activeManagedOrders.filter((order) => order.status === "awaiting_merchant_confirmation").length,
        dispatch: activeManagedOrders.filter((order) => ["processing", "ready_for_pickup", "out_for_delivery"].includes(order.status ?? "")).length,
    }

    const watchlistOrders = filterQueueOrders(activeManagedOrders, activeFilter)
    const exceptionCount = normalizedOrders.filter((order) => order.status === "disputed" || order.status === "refunded").length
    const commissionSummary = (commissionRows ?? []) as unknown as AgentCommissionSummaryRow[]
    const settledCommissionTotal = commissionSummary.reduce((sum, order) => {
        const financial = firstRelation(order.order_financials)
        if (!financial || financial.settlement_status !== "completed") {
            return sum
        }
        return sum + financial.agent_fee_total_kobo
    }, 0)
    const pendingCommissionTotal = commissionSummary.reduce((sum, order) => {
        const financial = firstRelation(order.order_financials)
        if (!financial || financial.settlement_status === "completed") {
            return sum
        }
        return sum + financial.agent_fee_total_kobo
    }, 0)

    const selectedSummary =
        watchlistOrders.find((order) => order.id === requestedOrderId) ??
        watchlistOrders[0] ??
        null

    let selectedOrder: AgentOrderDetailRow | null = null
    let selectedOrderError: string | null = null
    let assignmentDirectory = new Map<string, string>()
    let orderNotifications: AppNotification[] = []

    if (selectedSummary) {
        const [
            { data: selectedOrderBase, error: selectedOrderBaseError },
            { data: selectedOrderItems, error: selectedOrderItemsError },
            { data: selectedOrderAssignments, error: selectedOrderAssignmentsError },
            { data: selectedOrderDisputes, error: selectedOrderDisputesError },
            { data: selectedRefunds, error: selectedRefundsError },
            { data: recentNotifications, error: recentNotificationsError },
        ] = await Promise.all([
            supabase
                .from("orders")
                .select(`
                    id,
                    rider_id,
                    status,
                    payment_status,
                    total_amount,
                    payment_ref,
                    delivery_fee_kobo,
                    created_at,
                    delivery_location,
                    contact_numbers,
                    customer:customer_id (
                        id,
                        full_name,
                        phone
                    ),
                    merchant:merchant_id (
                        id,
                        full_name,
                        phone,
                        address
                    ),
                    rider:rider_id (
                        id,
                        full_name,
                        phone
                    ),
                    order_financials (
                        agent_fee_total_kobo,
                        settlement_status
                    )
                `)
                .eq("id", selectedSummary.id)
                .eq("assigned_agent_id", user.id)
                .maybeSingle(),
            supabase
                .from("order_items")
                .select(`
                    id,
                    quantity,
                    price_per_unit,
                    products (
                        id,
                        name,
                        image_url
                    )
                `)
                .eq("order_id", selectedSummary.id)
                .order("created_at", { ascending: true }),
            supabase
                .from("order_assignments")
                .select("id, assignment_role, assignee_id, method, reason, accepted_at, created_at")
                .eq("order_id", selectedSummary.id)
                .order("created_at", { ascending: false }),
            supabase
                .from("order_disputes")
                .select("id, status, reason, resolution_notes, created_at, resolved_at")
                .eq("order_id", selectedSummary.id)
                .order("created_at", { ascending: false }),
            supabase
                .from("refunds")
                .select("id, amount_kobo, status, reason, processed_at, created_at")
                .eq("order_id", selectedSummary.id)
                .order("created_at", { ascending: false }),
            supabase
                .from("notifications")
                .select("id, user_id, title, message, type, read, created_at, action_url, metadata")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false })
                .limit(80),
        ])

        if (selectedOrderBaseError || !selectedOrderBase) {
            selectedOrderError = selectedOrderBaseError?.message ?? "Order details could not be loaded."
        } else {
            selectedOrder = {
                ...(selectedOrderBase as unknown as Omit<AgentOrderDetailRow, "order_items" | "order_assignments" | "order_disputes" | "refunds">),
                order_items: selectedOrderItemsError
                    ? []
                    : normalizeOrderItems((selectedOrderItems ?? []) as AgentOrderItemRow[]),
                order_assignments: (selectedOrderAssignmentsError ? [] : (selectedOrderAssignments ?? [])) as AgentOrderDetailRow["order_assignments"],
                order_disputes: (selectedOrderDisputesError ? [] : (selectedOrderDisputes ?? [])) as AgentOrderDetailRow["order_disputes"],
                refunds: (selectedRefundsError ? [] : (selectedRefunds ?? [])) as AgentOrderDetailRow["refunds"],
            }
        }

        if (!recentNotificationsError) {
            orderNotifications = ((recentNotifications ?? []) as AppNotification[]).filter((notification) =>
                orderNotificationMatches(notification, selectedSummary.id)
            )
        }

        if (selectedOrder?.order_assignments?.length) {
            const profileIds = Array.from(
                new Set(
                    selectedOrder.order_assignments
                        .map((assignment) => assignment.assignee_id)
                        .filter((value): value is string => Boolean(value))
                )
            )

            if (profileIds.length) {
                const { data: assignmentProfiles } = await supabase
                    .from("profiles")
                    .select("id, full_name")
                    .in("id", profileIds)

                assignmentDirectory = new Map(
                    ((assignmentProfiles ?? []) as ProfileNameRow[]).map((profile) => [
                        profile.id,
                        profile.full_name ?? "Unknown user",
                    ])
                )
            }
        }
    }

    const selectedFinancials = firstRelation(selectedOrder?.order_financials ?? null)
    const selectedCustomer = firstRelation(selectedOrder?.customer ?? null)
    const selectedMerchant = firstRelation(selectedOrder?.merchant ?? null)
    const selectedRider = firstRelation(selectedOrder?.rider ?? null)
    const selectedContacts = normalizeContactNumbers(selectedOrder?.contact_numbers)
    const statusHint = selectedOrder
        ? getOrderOperationalHint(selectedOrder.status, { riderAssigned: Boolean(selectedOrder.rider_id) })
        : null
    const actionMessage = selectedOrder ? getAgentActionMessage(selectedOrder) : null
    const checkpointRows = selectedOrder ? getCheckpointRows(selectedOrder) : []
    const completedCheckpointCount = checkpointRows.filter((checkpoint) => checkpoint.value !== null).length
    const nextCheckpoint = checkpointRows.find((checkpoint) => checkpoint.value === null) ?? null
    const progressPercent = checkpointRows.length
        ? Math.round((completedCheckpointCount / checkpointRows.length) * 100)
        : 0

    return (
        <AgentOrdersWorkspace
            activeFilter={activeFilter}
            filterCounts={filterCounts}
            ordersError={ordersError?.message ?? null}
            watchlistOrders={watchlistOrders}
            selectedSummary={selectedSummary}
            selectedOrder={selectedOrder}
            selectedOrderError={selectedOrderError}
            selectedFinancials={selectedFinancials}
            selectedCustomer={selectedCustomer}
            selectedMerchant={selectedMerchant}
            selectedRider={selectedRider}
            selectedContacts={selectedContacts}
            statusHint={statusHint}
            actionMessage={actionMessage}
            checkpointRows={checkpointRows}
            completedCheckpointCount={completedCheckpointCount}
            progressPercent={progressPercent}
            nextCheckpoint={nextCheckpoint}
            assignmentDirectory={assignmentDirectory}
            orderNotifications={orderNotifications}
            exceptionCount={exceptionCount}
            agentWalletBalance={agentWallet?.balance ?? 0}
            settledCommissionTotal={settledCommissionTotal}
            pendingCommissionTotal={pendingCommissionTotal}
        />
    )
}
