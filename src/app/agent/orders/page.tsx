import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AgentOrdersWorkspace } from "@/components/agent/AgentOrdersWorkspace"
import { type AppNotification } from "@/lib/notifications"

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
    agent_checkout_group_id: string | null
    assignment_method: string | null
    agent_offer_expires_at: string | null
    delivery_fee_kobo: number | null
    delivery_address_snapshot: { address_label?: string } | null
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
        agent_fee_total_kobo: number
    }>
}

const summaryColumns = `
    id, agent_checkout_group_id, assignment_method, agent_offer_expires_at, delivery_fee_kobo, delivery_address_snapshot,
    status, payment_status, total_amount, created_at, rider_id,
    customer:customer_id(id, full_name, phone),
    merchant:merchant_id(id, full_name, phone, address),
    rider:rider_id(id, full_name, phone),
    order_financials(settlement_status, agent_fee_total_kobo)
`
const activeStatuses = [
    "awaiting_agent_acceptance", "awaiting_merchant_confirmation", "processing",
    "ready_for_pickup", "out_for_delivery", "delivery_failed", "rescheduled", "return_in_transit", "disputed",
]

function offerIsCurrent(order: AgentOrderSummaryRow, now: number) {
    return order.status !== "awaiting_agent_acceptance" ||
        !order.agent_offer_expires_at || Date.parse(order.agent_offer_expires_at) > now
}

function countCheckouts(orders: AgentOrderSummaryRow[]) {
    return new Set(orders.map((order) => order.agent_checkout_group_id ?? order.id)).size
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
    agent_offer_expires_at: string | null
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
            return orders.filter((order) => ["processing", "ready_for_pickup", "out_for_delivery", "delivery_failed", "rescheduled", "return_in_transit"].includes(order.status ?? ""))
        default:
            return orders
    }
}

export default async function AgentOrdersPage({
    searchParams,
}: {
    searchParams: Promise<{ order?: string; filter?: string; details?: string }>
}) {
    const { order: requestedOrderId, filter: requestedFilter, details } = await searchParams
    const activeFilter = parseFilter(requestedFilter)
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect("/login")
    }

    const { data: orders, error: ordersError } = await supabase
            .from("orders")
            .select(summaryColumns)
            .eq("assigned_agent_id", user.id)
            .in("status", activeStatuses)
            .order("created_at", { ascending: false })
            .order("id")

    const now = Date.now()
    const normalizedOrders = ((orders ?? []) as AgentOrderSummaryRow[]).filter((order) => offerIsCurrent(order, now))
    const activeManagedOrders = normalizedOrders

    const filterCounts = {
        all: countCheckouts(activeManagedOrders),
        acceptance: countCheckouts(filterQueueOrders(activeManagedOrders, "acceptance")),
        merchant: countCheckouts(filterQueueOrders(activeManagedOrders, "merchant")),
        dispatch: countCheckouts(filterQueueOrders(activeManagedOrders, "dispatch")),
    }

    const watchlistOrders = filterQueueOrders(activeManagedOrders, activeFilter)

    let requestedOrder = normalizedOrders.find((order) => order.id === requestedOrderId)
    if (!requestedOrder && requestedOrderId && /^[0-9a-f-]{36}$/i.test(requestedOrderId)) {
        const { data } = await supabase.from("orders").select(summaryColumns)
            .eq("assigned_agent_id", user.id).eq("id", requestedOrderId).maybeSingle()
        const order = data as AgentOrderSummaryRow | null
        if (order && offerIsCurrent(order, now)) requestedOrder = order
    }
    const selectedSummary =
        requestedOrder ??
        watchlistOrders.find((order) => order.status === "awaiting_agent_acceptance") ??
        watchlistOrders[0] ??
        null
    let checkoutOrders = selectedSummary ? [selectedSummary] : []
    let checkoutError = false
    if (selectedSummary?.agent_checkout_group_id) {
        const { data, error } = await supabase.from("orders").select(summaryColumns)
            .eq("assigned_agent_id", user.id)
            .eq("agent_checkout_group_id", selectedSummary.agent_checkout_group_id).order("id")
        if (!error && data?.length) checkoutOrders = data as AgentOrderSummaryRow[]
        else checkoutError = true
    }

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
                    agent_offer_expires_at,
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

    return (
        <AgentOrdersWorkspace
            activeFilter={activeFilter}
            filterCounts={filterCounts}
            ordersError={ordersError?.message ?? null}
            watchlistOrders={watchlistOrders}
            selectedSummary={selectedSummary}
            checkoutOrders={checkoutOrders}
            checkoutError={checkoutError}
            showDetails={details === "1"}
            selectedOrder={selectedOrder}
            selectedOrderError={selectedOrderError}
            selectedFinancials={selectedFinancials}
            selectedCustomer={selectedCustomer}
            selectedMerchant={selectedMerchant}
            selectedRider={selectedRider}
            selectedContacts={selectedContacts}
            assignmentDirectory={assignmentDirectory}
            orderNotifications={orderNotifications}
        />
    )
}
