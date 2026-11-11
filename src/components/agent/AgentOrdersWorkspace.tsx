import type { ReactNode } from "react"
import Link from "next/link"
import { Bell, ClipboardList, Package, ShieldAlert, Store, Truck, UserRound, Wallet, type LucideIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AcceptAssignmentButton } from "@/components/agent/AcceptAssignmentButton"
import { AgentOrderChat, OrderCall, OrderChatButton } from "@/components/agent/AgentOrderChat"
import { RequestRiderButton } from "@/components/merchant/RequestRiderButton"
import { formatKobo } from "@/lib/money"
import { getNotificationPresentation, type AppNotification } from "@/lib/notifications"
import { formatOrderStatus, formatPaymentStatus, formatSettlementStatus, getPaymentStatusTone, getSettlementTone } from "@/lib/orders"
import { cn } from "@/lib/utils"

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

interface AgentOrderItemRow {
    id: string
    quantity: number
    price_per_unit: number
    products: {
        id: string
        name: string | null
        image_url: string | null
    } | null
}

interface AgentOrderFinancials {
    agent_fee_total_kobo: number
    settlement_status: string | null
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
    customer: Relation<RelationProfile>
    merchant: Relation<RelationProfile>
    rider: Relation<RelationProfile>
    order_items: AgentOrderItemRow[] | null
    order_financials: Relation<AgentOrderFinancials>
    order_assignments: AgentOrderAssignmentRow[] | null
    order_disputes: AgentOrderDisputeRow[] | null
    refunds: AgentRefundRow[] | null
}

interface AgentOrdersWorkspaceProps {
    activeFilter: AgentOrdersFilter
    filterCounts: Record<AgentOrdersFilter, number>
    ordersError: string | null
    watchlistOrders: AgentOrderSummaryRow[]
    checkoutOrders: AgentOrderSummaryRow[]
    checkoutError: boolean
    showDetails: boolean
    selectedSummary: AgentOrderSummaryRow | null
    selectedOrder: AgentOrderDetailRow | null
    selectedOrderError: string | null
    selectedFinancials: AgentOrderFinancials | null
    selectedCustomer: RelationProfile | null
    selectedMerchant: RelationProfile | null
    selectedRider: RelationProfile | null
    selectedContacts: string[]
    assignmentDirectory: Map<string, string>
    orderNotifications: AppNotification[]
}

function firstRelation<T>(value: Relation<T>): T | null {
    if (Array.isArray(value)) {
        return value[0] ?? null
    }

    return value ?? null
}

function formatDateTime(value: string | null | undefined) {
    if (!value) {
        return "Pending"
    }

    return new Date(value).toLocaleString()
}

function formatShortDate(value: string | null | undefined) {
    if (!value) {
        return "Pending"
    }

    return new Date(value).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })
}

function buildOrdersHref(filter: AgentOrdersFilter, orderId?: string, details?: boolean) {
    const params = new URLSearchParams()

    if (filter !== "all") {
        params.set("filter", filter)
    }

    if (orderId) {
        params.set("order", orderId)
    }
    if (details) params.set("details", "1")

    const query = params.toString()
    const hash = details ? "#agent-merchant-details" : ""
    return query ? `/agent/orders?${query}${hash}` : "/agent/orders"
}

function isNonEmptyString(value: string | null | undefined): value is string {
    return typeof value === "string" && value.trim().length > 0
}

function uniqueStrings(values: Array<string | null | undefined>) {
    return Array.from(new Set(values.filter(isNonEmptyString).map((value) => value.trim())))
}

function SummaryTile({
    icon: Icon,
    label,
    title,
    description,
    meta,
}: {
    icon: LucideIcon
    label: string
    title: string
    description?: string
    meta?: ReactNode
}) {
    return (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-gray-500 dark:text-zinc-400">
                <Icon className="h-4 w-4 text-[#F58220]" />
                <span>{label}</span>
            </div>
            <p className="mt-3 text-base font-semibold text-gray-900 dark:text-white">{title}</p>
            {description ? <p className="mt-1 text-sm text-gray-600 dark:text-zinc-400">{description}</p> : null}
            {meta ? <div className="mt-3">{meta}</div> : null}
        </div>
    )
}

function SecondaryDialog({ icon: Icon, label, hint, count, title, description, children }: {
    icon: LucideIcon
    label: string
    hint: string
    count?: number
    title: string
    description: string
    children: ReactNode
}) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <button
                    type="button"
                    className="flex w-full items-start justify-between rounded-2xl border border-gray-200 bg-white p-4 text-left transition hover:border-orange-200 hover:bg-orange-50/50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-orange-900 dark:hover:bg-orange-950/20"
                >
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                            <Icon className="h-4 w-4 text-[#F58220]" />
                            <span>{label}</span>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-zinc-400">{hint}</p>
                    </div>
                    {typeof count === "number" ? (
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:bg-zinc-800 dark:text-zinc-300">
                            {count}
                        </span>
                    ) : null}
                </button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl border-orange-100 p-0 dark:border-zinc-800">
                <DialogHeader className="border-b border-gray-100 px-6 py-5 dark:border-zinc-800">
                    <DialogTitle className="text-xl font-semibold text-gray-900 dark:text-white">{title}</DialogTitle>
                    <DialogDescription className="text-sm text-gray-500 dark:text-zinc-400">
                        {description}
                    </DialogDescription>
                </DialogHeader>
                <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>
            </DialogContent>
        </Dialog>
    )
}

function checkoutId(order: AgentOrderSummaryRow) {
    return order.agent_checkout_group_id ?? order.id
}

function orderNumber(id: string) {
    return id.slice(0, 8).toUpperCase()
}

function getMerchantName(order: AgentOrderSummaryRow) {
    return firstRelation(order.merchant)?.full_name ?? "Merchant"
}

function getHandoff(order: AgentOrderSummaryRow) {
    const merchant = firstRelation(order.merchant)
    const rider = firstRelation(order.rider)
    switch (order.status) {
        case "awaiting_merchant_confirmation":
            return { label: "Waiting for merchant to confirm", phone: merchant?.phone, contact: merchant?.full_name ?? "merchant" }
        case "processing":
            return { label: "Merchant is preparing items", phone: merchant?.phone, contact: merchant?.full_name ?? "merchant" }
        case "ready_for_pickup":
            return order.rider_id
                ? { label: "Waiting for rider pickup", phone: rider?.phone, contact: rider?.full_name ?? "rider" }
                : { label: "Waiting for a rider", phone: merchant?.phone, contact: merchant?.full_name ?? "merchant" }
        case "out_for_delivery":
        case "delivery_failed":
        case "rescheduled":
        case "return_in_transit":
            return { label: formatOrderStatus(order.status), phone: rider?.phone, contact: rider?.full_name ?? "rider" }
        default:
            return { label: formatOrderStatus(order.status), phone: null, contact: "" }
    }
}

const handoffStages = ["Merchant confirmed", "Rider assigned", "Picked up", "Delivered"]

function MerchantProgress({ order }: { order: AgentOrderSummaryRow }) {
    const stage = {
        awaiting_merchant_confirmation: 0,
        processing: 1,
        ready_for_pickup: order.rider_id ? 2 : 1,
        out_for_delivery: 3,
        delivered: 4,
        completed: 4,
    }[order.status ?? ""]
    if (stage === undefined) return null
    return <div className="mt-2 flex max-w-32 gap-1" role="img"
        aria-label={stage === 0 ? "Merchant confirmation pending" : `Last milestone: ${handoffStages[stage - 1]}`}>
        {handoffStages.map((label, index) => <span key={label} title={label}
            className={cn("h-1 flex-1 rounded-full bg-muted", index < stage && "bg-[#F58220]")} />)}
    </div>
}

const filters: { id: AgentOrdersFilter; label: string }[] = [
    { id: "all", label: "Active" },
    { id: "acceptance", label: "Offers" },
    { id: "merchant", label: "Waiting for merchant" },
    { id: "dispatch", label: "Dispatch" },
]

export function AgentOrdersWorkspace({
    activeFilter, filterCounts, ordersError, watchlistOrders, selectedSummary, checkoutOrders, checkoutError, showDetails,
    selectedOrder, selectedOrderError, selectedFinancials, selectedCustomer, selectedMerchant, selectedRider,
    selectedContacts, assignmentDirectory, orderNotifications,
}: AgentOrdersWorkspaceProps) {
    const items = selectedOrder?.order_items ?? []
    const assignments = selectedOrder?.order_assignments ?? []
    const disputes = selectedOrder?.order_disputes ?? []
    const refunds = selectedOrder?.refunds ?? []
    const contactNumbers = uniqueStrings([ ...selectedContacts, selectedCustomer?.phone, selectedMerchant?.phone, selectedRider?.phone ])
    const queue = Array.from(new Map(watchlistOrders.map((order) => [checkoutId(order), order])).values())
    const offered = selectedSummary?.status === "awaiting_agent_acceptance"
    const selectedCheckout = selectedSummary && checkoutId(selectedSummary)
    const delivered = checkoutOrders.filter((order) => ["completed", "delivered"].includes(order.status ?? "")).length
    const commission = checkoutOrders.map((order) => firstRelation(order.order_financials)?.agent_fee_total_kobo)
    const canShowCommission = !checkoutError && commission.every((value) => value !== undefined)
    const earned = commission.reduce<number>((total, value) => total + (value ?? 0), 0)
    const waiting = checkoutOrders.find((order) => order.status === "awaiting_merchant_confirmation")
    const focus = checkoutOrders.find((order) => ["disputed", "delivery_failed"].includes(order.status ?? "")) ?? waiting ??
        checkoutOrders.find((order) => ["processing", "ready_for_pickup", "out_for_delivery", "rescheduled", "return_in_transit"].includes(order.status ?? ""))
    const focusHandoff = focus && getHandoff(focus)
    const deliveryAddress = selectedSummary?.delivery_address_snapshot?.address_label

    const orderRows = selectedSummary && <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 sm:px-5">
            <h3 className="font-semibold">Merchant pickups</h3>
            {delivered > 0 && <span className="text-sm text-muted-foreground">{delivered} of {checkoutOrders.length} delivered</span>}
        </div>
        <ul className="divide-y">
            {checkoutOrders.map((order) => {
                const handoff = getHandoff(order)
                const merchant = firstRelation(order.merchant)
                return <li key={order.id} className="grid gap-3 px-4 py-4 sm:grid-cols-[1fr_auto] sm:items-center sm:px-5">
                    <div className="flex min-w-0 gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-orange-100 text-orange-900"><Store className="size-5" /></span>
                        <div className="min-w-0">
                            <p className="break-words font-semibold">{getMerchantName(order)}</p>
                            {merchant?.address && <p className="break-words text-sm text-muted-foreground">{merchant.address}</p>}
                            {!offered && <p className="mt-1 text-sm font-medium">{handoff.label}</p>}
                            {!offered && <MerchantProgress order={order} />}
                            {order.delivery_fee_kobo !== null && <p className="mt-1 text-xs text-muted-foreground">Delivery {formatKobo(order.delivery_fee_kobo)}</p>}
                        </div>
                    </div>
                    {!offered && <div className="flex flex-wrap items-center gap-2">
                        <Link href={buildOrdersHref(activeFilter, order.id, true)} className="p-2 text-sm font-medium underline underline-offset-4">Details</Link>
                        <OrderChatButton orderId={order.id} />
                        <OrderCall phone={handoff.phone} label={handoff.contact} />
                        {!order.rider_id && ["processing", "ready_for_pickup"].includes(order.status ?? "") && <RequestRiderButton orderId={order.id} />}
                    </div>}
                </li>
            })}
        </ul>
    </div>

    return <div className="min-w-0 space-y-5 pb-20">
        <header className="flex flex-wrap items-end justify-between gap-3">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
                <p className="mt-1 text-sm text-muted-foreground">See what needs your attention and move each delivery forward.</p>
            </div>
            <Link href="/agent/messages" className="py-2 text-sm font-semibold text-orange-800 underline-offset-4 hover:underline dark:text-orange-300">All order messages</Link>
        </header>
        <nav className="flex flex-wrap gap-2" aria-label="Filter orders">
            {filters.map(({ id, label }) => <Link key={id} href={buildOrdersHref(id)} scroll={false}
                aria-current={activeFilter === id ? "page" : undefined}
                className={cn("inline-flex min-h-10 items-center gap-2 rounded-full border bg-card px-3 text-sm font-medium", activeFilter === id && "border-orange-300 bg-orange-50 text-orange-950 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-100")}>
                {label} <span className="tabular-nums">{filterCounts[id]}</span>
            </Link>)}
        </nav>
        {ordersError && <p className="rounded-xl border border-red-300 p-3 text-sm text-destructive" role="alert">Orders couldn’t load. Refresh to try again.</p>}
        {queue.length > 0 && <nav className="flex min-w-0 gap-2 overflow-x-auto pb-2" aria-label="Switch orders">
            {queue.map((order) => {
                const id = checkoutId(order)
                const isSelected = selectedCheckout === id
                const isOffer = order.status === "awaiting_agent_acceptance"
                return <Link key={id} scroll={false} href={buildOrdersHref(activeFilter, order.id)}
                    aria-current={isSelected ? "page" : undefined}
                    className={cn("min-w-36 max-w-52 shrink-0 rounded-xl border bg-card px-3 py-2", isSelected && "border-orange-500 ring-1 ring-inset ring-orange-500")}>
                    <span className="block text-sm font-semibold">#{orderNumber(id)}</span>
                    <span className="block truncate text-xs text-muted-foreground">{isOffer ? "New offer" : order.agent_checkout_group_id ? "Multiple merchants" : getMerchantName(order)}</span>
                </Link>
            })}
        </nav>}
        {!selectedSummary && !ordersError && <div className="rounded-2xl border bg-card p-6">
            <h2 className="font-semibold">{activeFilter === "all" ? "No active orders" : "No orders in this view"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">New assignments will appear in Offers.</p>
        </div>}
        {selectedSummary && <section className="min-w-0 space-y-4" aria-label="Selected order">
            <div className={cn("space-y-4 rounded-2xl border bg-card p-4 sm:p-5", offered && "border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/40")}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        {offered && <p className="mb-1 text-sm font-semibold text-orange-900 dark:text-orange-200">
                            {selectedSummary.assignment_method === "auto" ? "Nearby order offer" : "Order offered by Admin"}
                        </p>}
                        <h2 className="text-xl font-bold">Order #{orderNumber(checkoutId(selectedSummary))}</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {checkoutOrders.length} {checkoutOrders.length === 1 ? "merchant" : "merchants"}
                            {deliveryAddress && <> · Deliver to {deliveryAddress}</>}
                        </p>
                    </div>
                    {offered && canShowCommission && <p className="text-sm text-muted-foreground">Estimated earnings <strong className="block text-lg text-foreground">{formatKobo(earned)}</strong></p>}
                </div>
                {checkoutError && <p role="alert" className="text-sm text-destructive">Some merchant pickups couldn’t load. Refresh to see the full order.</p>}
                {offered && selectedOrder && !checkoutError && <AcceptAssignmentButton orderId={selectedOrder.id} expiresAt={selectedOrder.agent_offer_expires_at} canDecline />}
                {!offered && focus && focusHandoff && <div className="rounded-xl bg-muted/60 p-3">
                    <p className="text-xs font-medium text-muted-foreground">Needs attention</p>
                    <p className="mt-1 font-semibold">{focusHandoff.label} · {getMerchantName(focus)}</p>
                </div>}
            </div>
            {offered ? orderRows : <AgentOrderChat merchants={checkoutOrders.map((order) => ({ id: order.id, name: getMerchantName(order) }))} initialOrderId={selectedSummary.id}>
                {orderRows}
            </AgentOrderChat>}
            {selectedOrderError && <p className="text-sm text-destructive" role="alert">Order details couldn’t load. Refresh to try again.</p>}
            {!offered && selectedOrder && <details key={selectedOrder.id} open={showDetails || undefined} id="agent-merchant-details" className="rounded-2xl border bg-card p-4 sm:p-5">
                <summary className="cursor-pointer font-semibold">{getMerchantName(selectedSummary)} details</summary>
                <div className="mt-4 space-y-4">
                    <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className={getPaymentStatusTone(selectedOrder.payment_status)}>{formatPaymentStatus(selectedOrder.payment_status)}</Badge>
                        <Badge variant="outline" className={getSettlementTone(selectedFinancials?.settlement_status)}>{formatSettlementStatus(selectedFinancials?.settlement_status)}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">Merchant order #{orderNumber(selectedOrder.id)} · {formatKobo(selectedOrder.total_amount)}</p>
                    <Card className="border-gray-200 shadow-sm dark:border-zinc-800">
                                <CardHeader>
                                    <CardTitle className="text-lg text-gray-900 dark:text-white">Order records</CardTitle>
                                    <CardDescription>Items, assignment history and issues for this merchant.</CardDescription>
                                </CardHeader>
                                <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                    <SecondaryDialog icon={UserRound} label="Contacts" hint="Customer, merchant, rider, and extra numbers" count={contactNumbers.length} title="People and contacts" description="Everyone connected to this order.">
                                        <div className="grid gap-4 md:grid-cols-2">
                                            <SummaryTile icon={UserRound} label="Customer" title={selectedCustomer?.full_name ?? "Customer pending"} description={selectedCustomer?.phone ?? "Phone unavailable"} />
                                            <SummaryTile icon={Store} label="Merchant" title={selectedMerchant?.full_name ?? "Merchant pending"} description={selectedMerchant?.address ?? selectedMerchant?.phone ?? "Address unavailable"} />
                                            <SummaryTile icon={Truck} label="Rider" title={selectedRider?.full_name ?? "Not assigned yet"} description={selectedRider?.phone ?? "Rider details will appear here after dispatch"} />
                                            <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                                                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500 dark:text-zinc-400">Extra contacts</p>
                                                {contactNumbers.length ? <div className="mt-3 flex flex-wrap gap-2">{contactNumbers.map((number) => <Badge key={number} variant="outline" className="border-gray-200 dark:border-zinc-700">{number}</Badge>)}</div> : <p className="mt-3 text-sm text-gray-500 dark:text-zinc-400">No extra contact numbers attached to this order.</p>}
                                            </div>
                                        </div>
                                    </SecondaryDialog>

                                    <SecondaryDialog icon={Package} label="Items" hint="Products, quantities, and totals" count={items.length} title="Order items" description="Product lines attached to this order.">
                                        {items.length ? <div className="space-y-3">{items.map((item) => <div key={item.id} className="flex items-start justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"><div className="space-y-1"><p className="font-semibold text-gray-900 dark:text-white">{item.products?.name ?? "Unnamed product"}</p><p className="text-sm text-gray-500 dark:text-zinc-400">Qty {item.quantity} at {formatKobo(item.price_per_unit)} each</p></div><p className="text-sm font-semibold text-gray-900 dark:text-white">{formatKobo(item.quantity * item.price_per_unit)}</p></div>)}</div> : <p className="text-sm text-gray-500 dark:text-zinc-400">No line items were returned for this order.</p>}
                                    </SecondaryDialog>

                                    <SecondaryDialog icon={ClipboardList} label="Assignment log" hint="Queue history and acceptance" count={assignments.length} title="Assignment history" description="Shows how the order moved between internal operators.">
                                        {assignments.length ? <div className="space-y-3">{assignments.map((assignment) => <div key={assignment.id} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"><div className="flex flex-wrap items-center justify-between gap-3"><p className="font-semibold text-gray-900 dark:text-white">{assignment.assignment_role.replace(/_/g, " ")}</p><p className="text-sm text-gray-500 dark:text-zinc-400">{formatDateTime(assignment.created_at)}</p></div><div className="mt-3 flex flex-wrap gap-2"><Badge variant="outline" className="border-gray-200 dark:border-zinc-700">{assignment.assignee_id ? assignmentDirectory.get(assignment.assignee_id) ?? "Unknown user" : "Unassigned"}</Badge>{assignment.method ? <Badge variant="outline" className="border-gray-200 dark:border-zinc-700">{assignment.method.replace(/_/g, " ")}</Badge> : null}{assignment.accepted_at ? <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">Accepted {formatShortDate(assignment.accepted_at)}</Badge> : null}</div>{assignment.reason ? <p className="mt-3 text-sm text-gray-600 dark:text-zinc-400">{assignment.reason}</p> : null}</div>)}</div> : <p className="text-sm text-gray-500 dark:text-zinc-400">No assignment history is available for this order yet.</p>}
                                    </SecondaryDialog>

                                    <SecondaryDialog icon={Bell} label="Activity" hint="Order notifications and status updates" count={orderNotifications.length} title="Recent activity" description="Notifications generated for this order.">
                                        {orderNotifications.length ? <div className="space-y-3">{orderNotifications.map((notification) => { const presentation = getNotificationPresentation(notification.type); const Icon = presentation.icon; return <div key={notification.id} className={cn("rounded-2xl border bg-white p-4 dark:bg-zinc-950", presentation.cardClassName)}><div className="flex items-start gap-3"><div className={cn("flex h-10 w-10 items-center justify-center rounded-full", presentation.iconClassName)}><Icon className="h-4 w-4" /></div><div className="min-w-0 flex-1 space-y-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-gray-900 dark:text-white">{notification.title}</p>{!notification.read ? <Badge className={presentation.badgeClassName}>Unread</Badge> : null}</div><p className="text-sm text-gray-600 dark:text-zinc-400">{notification.message}</p><div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-zinc-400"><span>{presentation.label}</span><span>{formatDateTime(notification.created_at)}</span></div></div></div></div> })}</div> : <p className="text-sm text-gray-500 dark:text-zinc-400">No order-level notifications are available for this selection.</p>}
                                    </SecondaryDialog>

                                    <SecondaryDialog icon={ShieldAlert} label="Issues" hint="Disputes, refunds, and exception records" count={disputes.length + refunds.length} title="Issues and reversals" description="Exception history for the selected order.">
                                        <div className="space-y-5">
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-red-500" /><p className="font-semibold text-gray-900 dark:text-white">Disputes</p></div>
                                                {disputes.length ? disputes.map((dispute) => <div key={dispute.id} className="rounded-2xl border border-red-200 bg-red-50/70 p-4 dark:border-red-900 dark:bg-red-950/20"><div className="flex flex-wrap items-center justify-between gap-3"><Badge variant="outline" className="border-red-200 text-red-700 dark:border-red-900 dark:text-red-300">{dispute.status ?? "Open"}</Badge><p className="text-sm text-red-700 dark:text-red-300">{formatDateTime(dispute.created_at)}</p></div><p className="mt-3 text-sm text-red-900 dark:text-red-100">{dispute.reason ?? "No reason provided"}</p>{dispute.resolution_notes ? <p className="mt-2 text-sm text-red-800 dark:text-red-200">{dispute.resolution_notes}</p> : null}</div>) : <p className="text-sm text-gray-500 dark:text-zinc-400">No disputes recorded.</p>}
                                            </div>
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2"><Wallet className="h-4 w-4 text-blue-500" /><p className="font-semibold text-gray-900 dark:text-white">Refunds</p></div>
                                                {refunds.length ? refunds.map((refund) => <div key={refund.id} className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900 dark:bg-blue-950/20"><div className="flex flex-wrap items-center justify-between gap-3"><Badge variant="outline" className="border-blue-200 text-blue-700 dark:border-blue-900 dark:text-blue-300">{refund.status ?? "Pending"}</Badge><p className="text-sm font-semibold text-blue-900 dark:text-blue-100">{formatKobo(refund.amount_kobo)}</p></div><p className="mt-3 text-sm text-blue-900 dark:text-blue-100">{refund.reason ?? "No refund reason recorded"}</p><p className="mt-2 text-xs text-blue-700 dark:text-blue-300">Created {formatDateTime(refund.created_at)}{refund.processed_at ? ` • Processed ${formatDateTime(refund.processed_at)}` : ""}</p></div>) : <p className="text-sm text-gray-500 dark:text-zinc-400">No refunds recorded.</p>}
                                            </div>
                                        </div>
                                    </SecondaryDialog>
                                </CardContent>
                            </Card>
                </div>
            </details>}
        </section>}
    </div>
}
