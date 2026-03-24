import type { ReactNode } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AcceptAssignmentButton } from "@/components/agent/AcceptAssignmentButton"
import { RequestRiderButton } from "@/components/merchant/RequestRiderButton"
import { formatKobo } from "@/lib/money"
import { getNotificationPresentation, type AppNotification } from "@/lib/notifications"
import {
    formatOrderStatus,
    formatPaymentStatus,
    formatSettlementStatus,
    getOrderStatusTone,
    getPaymentStatusTone,
    getSettlementTone,
} from "@/lib/orders"
import { cn } from "@/lib/utils"
import {
    AlertCircle,
    ArrowRight,
    Bell,
    CheckCircle2,
    ClipboardList,
    Clock3,
    MessageSquare,
    Package,
    ReceiptText,
    ShieldAlert,
    Store,
    Truck,
    UserRound,
    Wallet,
    type LucideIcon,
} from "lucide-react"

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

interface CheckpointRow {
    label: string
    description: string
    value: string | null
}

interface AgentOrdersWorkspaceProps {
    activeFilter: AgentOrdersFilter
    filterCounts: Record<AgentOrdersFilter, number>
    ordersError: string | null
    watchlistOrders: AgentOrderSummaryRow[]
    selectedSummary: AgentOrderSummaryRow | null
    selectedOrder: AgentOrderDetailRow | null
    selectedOrderError: string | null
    selectedFinancials: AgentOrderFinancials | null
    selectedCustomer: RelationProfile | null
    selectedMerchant: RelationProfile | null
    selectedRider: RelationProfile | null
    selectedContacts: string[]
    statusHint: string | null
    actionMessage: string | null
    checkpointRows: CheckpointRow[]
    completedCheckpointCount: number
    progressPercent: number
    nextCheckpoint: CheckpointRow | null
    assignmentDirectory: Map<string, string>
    orderNotifications: AppNotification[]
    exceptionCount: number
    agentWalletBalance: number
    settledCommissionTotal: number
    pendingCommissionTotal: number
}

interface MetricChipProps {
    icon: LucideIcon
    label: string
    value: number
    className: string
}

interface SecondaryDialogProps {
    icon: LucideIcon
    label: string
    hint: string
    count?: number
    title: string
    description: string
    children: ReactNode
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

function getSelectionLabel(order: AgentOrderSummaryRow) {
    switch (order.status) {
        case "awaiting_agent_acceptance":
            return "Needs acceptance"
        case "awaiting_merchant_confirmation":
            return "Waiting merchant"
        case "processing":
            return "Ready dispatch"
        case "ready_for_pickup":
            return order.rider_id ? "Rider assigned" : "Waiting rider"
        case "out_for_delivery":
            return "In delivery"
        default:
            return formatOrderStatus(order.status)
    }
}

function buildOrdersHref(filter: AgentOrdersFilter, orderId?: string) {
    const params = new URLSearchParams()

    if (filter !== "all") {
        params.set("filter", filter)
    }

    if (orderId) {
        params.set("order", orderId)
    }

    const query = params.toString()
    return query ? `/agent/orders?${query}` : "/agent/orders"
}

function isNonEmptyString(value: string | null | undefined): value is string {
    return typeof value === "string" && value.trim().length > 0
}

function uniqueStrings(values: Array<string | null | undefined>) {
    return Array.from(new Set(values.filter(isNonEmptyString).map((value) => value.trim())))
}

function MetricChip({ icon: Icon, label, value, className }: MetricChipProps) {
    return (
        <div className={cn("rounded-2xl border px-4 py-3", className)}>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em]">
                <Icon className="h-4 w-4" />
                <span>{label}</span>
            </div>
            <p className="mt-2 text-2xl font-semibold">{value}</p>
        </div>
    )
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

function SecondaryDialog({ icon: Icon, label, hint, count, title, description, children }: SecondaryDialogProps) {
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

export function AgentOrdersWorkspace({
    activeFilter,
    filterCounts,
    ordersError,
    watchlistOrders,
    selectedSummary,
    selectedOrder,
    selectedOrderError,
    selectedFinancials,
    selectedCustomer,
    selectedMerchant,
    selectedRider,
    selectedContacts,
    statusHint,
    actionMessage,
    checkpointRows,
    completedCheckpointCount,
    progressPercent,
    nextCheckpoint,
    assignmentDirectory,
    orderNotifications,
    exceptionCount,
    agentWalletBalance,
    settledCommissionTotal,
    pendingCommissionTotal,
}: AgentOrdersWorkspaceProps) {
    const contactNumbers = uniqueStrings([
        ...selectedContacts,
        selectedCustomer?.phone,
        selectedMerchant?.phone,
        selectedRider?.phone,
    ])
    const items = selectedOrder?.order_items ?? []
    const assignments = selectedOrder?.order_assignments ?? []
    const disputes = selectedOrder?.order_disputes ?? []
    const refunds = selectedOrder?.refunds ?? []
    const showRequestRider =
        !!selectedOrder && !selectedOrder.rider_id && ["processing", "ready_for_pickup"].includes(selectedOrder.status ?? "")

    return (
        <div className="space-y-6">
            <Card className="border-orange-100 bg-gradient-to-r from-white via-orange-50/60 to-amber-50/60 shadow-sm dark:border-zinc-800 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900">
                <CardContent className="space-y-5 p-5 sm:p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#F58220]">Live operations</p>
                            <div className="space-y-1">
                                <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Order coordination</h1>
                                <p className="max-w-2xl text-sm text-gray-600 dark:text-zinc-400">
                                    Work active orders from one place. The queue stays left and the selected order stays focused on the right.
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button asChild variant="outline" className="border-gray-200 dark:border-zinc-700">
                                <Link href="/agent/history">History</Link>
                            </Button>
                            <Button asChild className="bg-[#F58220] text-white hover:bg-[#E57210]">
                                <Link href="/agent/pricing">Pricing queue</Link>
                            </Button>
                        </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <MetricChip icon={ClipboardList} label="Live queue" value={filterCounts.all} className="border-orange-200 bg-white/80 text-gray-900 dark:border-orange-900 dark:bg-zinc-950 dark:text-white" />
                        <MetricChip icon={AlertCircle} label="Acceptance" value={filterCounts.acceptance} className="border-amber-200 bg-amber-50/80 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100" />
                        <MetricChip icon={Store} label="Merchant" value={filterCounts.merchant} className="border-blue-200 bg-blue-50/80 text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100" />
                        <MetricChip icon={Truck} label="Dispatch" value={filterCounts.dispatch} className="border-emerald-200 bg-emerald-50/80 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100" />
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                <div className="space-y-4 xl:sticky xl:top-24 xl:self-start">
                    <Card className="border-orange-100 shadow-sm dark:border-zinc-800">
                        <CardHeader className="space-y-4">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <CardTitle className="text-lg text-gray-900 dark:text-white">Queue</CardTitle>
                                    <CardDescription>Choose an order and keep the workspace focused.</CardDescription>
                                </div>
                                <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-300">
                                    {watchlistOrders.length} visible
                                </Badge>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {([
                                    ["all", "All"],
                                    ["acceptance", "Needs acceptance"],
                                    ["merchant", "Waiting merchant"],
                                    ["dispatch", "Dispatch live"],
                                ] as Array<[AgentOrdersFilter, string]>).map(([key, label]) => (
                                    <Button
                                        key={key}
                                        asChild
                                        size="sm"
                                        variant={activeFilter === key ? "default" : "outline"}
                                        className={activeFilter === key ? "bg-[#F58220] text-white hover:bg-[#E57210]" : "border-gray-200 text-gray-600 hover:border-orange-200 hover:text-[#F58220] dark:border-zinc-700 dark:text-zinc-300"}
                                    >
                                        <Link href={buildOrdersHref(key, selectedSummary?.id)}>
                                            {label} ({filterCounts[key]})
                                        </Link>
                                    </Button>
                                ))}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {ordersError ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{ordersError}</div> : null}
                            {!watchlistOrders.length ? (
                                <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center dark:border-zinc-800">
                                    <p className="text-base font-semibold text-gray-900 dark:text-white">No active orders in this view</p>
                                    <p className="mt-2 text-sm text-gray-500 dark:text-zinc-400">Change the queue filter or review completed jobs in history.</p>
                                </div>
                            ) : (
                                watchlistOrders.map((order) => {
                                    const customer = firstRelation(order.customer)
                                    const merchant = firstRelation(order.merchant)
                                    const settlement = firstRelation(order.order_financials)
                                    const selected = selectedSummary?.id === order.id

                                    return (
                                        <Link
                                            key={order.id}
                                            href={buildOrdersHref(activeFilter, order.id)}
                                            className={cn("block rounded-2xl border p-4 transition", selected ? "border-orange-200 bg-orange-50/70 shadow-sm dark:border-orange-900 dark:bg-orange-950/20" : "border-gray-200 bg-white hover:border-orange-200 hover:bg-orange-50/40 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-orange-900 dark:hover:bg-orange-950/10")}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0 space-y-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{customer?.full_name ?? "Customer pending"}</p>
                                                        <Badge variant="outline" className={cn("border", getOrderStatusTone(order.status))}>{getSelectionLabel(order)}</Badge>
                                                    </div>
                                                    <p className="truncate text-sm text-gray-500 dark:text-zinc-400">{merchant?.full_name ?? "Merchant pending"}</p>
                                                </div>
                                                <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatKobo(order.total_amount)}</p>
                                            </div>
                                            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-zinc-400">
                                                <span>#{order.id.slice(0, 8)}</span>
                                                <span>&bull;</span>
                                                <span>{formatShortDate(order.created_at)}</span>
                                                <Badge variant="outline" className={cn("border", getPaymentStatusTone(order.payment_status))}>{formatPaymentStatus(order.payment_status)}</Badge>
                                                <Badge variant="outline" className={cn("border", getSettlementTone(settlement?.settlement_status))}>{formatSettlementStatus(settlement?.settlement_status)}</Badge>
                                            </div>
                                        </Link>
                                    )
                                })
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-gray-200 shadow-sm dark:border-zinc-800">
                        <CardHeader>
                            <CardTitle className="text-base text-gray-900 dark:text-white">Quick balances</CardTitle>
                            <CardDescription>Still here, but no longer overwhelming the queue.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                            <SummaryTile icon={Wallet} label="Wallet" title={formatKobo(agentWalletBalance)} description="Available balance" />
                            <SummaryTile icon={ReceiptText} label="Settled" title={formatKobo(settledCommissionTotal)} description="Commission paid out" />
                            <SummaryTile icon={Clock3} label="Pending" title={formatKobo(pendingCommissionTotal)} description="Awaiting settlement" />
                            <SummaryTile icon={ShieldAlert} label="Exceptions" title={`${exceptionCount}`} description="Disputed or refunded orders" />
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-4">
                    {!selectedSummary ? (
                        <Card className="border-dashed border-gray-200 dark:border-zinc-800">
                            <CardContent className="px-6 py-12 text-center">
                                <p className="text-lg font-semibold text-gray-900 dark:text-white">Select an order from the queue</p>
                                <p className="mt-2 text-sm text-gray-500 dark:text-zinc-400">
                                    The queue stays on the left. Everything for the selected order opens here.
                                </p>
                            </CardContent>
                        </Card>
                    ) : null}

                    {selectedSummary && selectedOrderError ? (
                        <Card className="border-red-200 dark:border-red-900">
                            <CardContent className="space-y-3 p-6">
                                <p className="text-lg font-semibold text-gray-900 dark:text-white">Order #{selectedSummary.id.slice(0, 8)}</p>
                                <p className="text-sm text-red-700 dark:text-red-300">{selectedOrderError}</p>
                                <Button asChild variant="outline">
                                    <Link href={`/agent/messages?order=${selectedSummary.id}`}>Open thread</Link>
                                </Button>
                            </CardContent>
                        </Card>
                    ) : null}

                    {selectedSummary && selectedOrder ? (
                        <>
                            <Card className="border-orange-100 shadow-sm dark:border-zinc-800">
                                <CardContent className="space-y-5 p-5 sm:p-6">
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                        <div className="space-y-3">
                                            <div className="flex flex-wrap gap-2">
                                                <Badge variant="outline" className={cn("border", getOrderStatusTone(selectedOrder.status))}>{formatOrderStatus(selectedOrder.status)}</Badge>
                                                <Badge variant="outline" className={cn("border", getPaymentStatusTone(selectedOrder.payment_status))}>{formatPaymentStatus(selectedOrder.payment_status)}</Badge>
                                                <Badge variant="outline" className={cn("border", getSettlementTone(selectedFinancials?.settlement_status))}>{formatSettlementStatus(selectedFinancials?.settlement_status)}</Badge>
                                            </div>
                                            <div>
                                                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Order #{selectedOrder.id.slice(0, 8)}</h2>
                                                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-zinc-400">
                                                    <span>Created {formatDateTime(selectedOrder.created_at)}</span>
                                                    <span>Payment ref {selectedOrder.payment_ref ?? "Pending generation"}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedOrder.status === "awaiting_agent_acceptance" ? <AcceptAssignmentButton orderId={selectedOrder.id} /> : null}
                                            {showRequestRider ? <RequestRiderButton orderId={selectedOrder.id} /> : null}
                                            <Button asChild variant="outline" className="border-gray-200 dark:border-zinc-700">
                                                <Link href={`/agent/messages?order=${selectedOrder.id}`}>
                                                    <MessageSquare className="mr-2 h-4 w-4" />
                                                    Open thread
                                                </Link>
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
                                        <div className="rounded-3xl border border-orange-200 bg-orange-50/70 p-5 dark:border-orange-900 dark:bg-orange-950/20">
                                            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-[#F58220]">
                                                <ArrowRight className="h-4 w-4" />
                                                <span>Next action</span>
                                            </div>
                                            <p className="mt-3 text-lg font-semibold text-gray-900 dark:text-white">
                                                {actionMessage ?? "Review the selected order and complete the next handoff."}
                                            </p>
                                            <p className="mt-2 text-sm text-gray-600 dark:text-zinc-300">
                                                {statusHint ?? "Use the progress panel to confirm where this order is blocked."}
                                            </p>
                                            {nextCheckpoint ? (
                                                <div className="mt-4 rounded-2xl border border-white/70 bg-white/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/70">
                                                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500 dark:text-zinc-400">Current focus</p>
                                                    <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">{nextCheckpoint.label}</p>
                                                    <p className="mt-1 text-sm text-gray-600 dark:text-zinc-400">{nextCheckpoint.description}</p>
                                                </div>
                                            ) : null}
                                        </div>

                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <SummaryTile icon={UserRound} label="Customer" title={selectedCustomer?.full_name ?? "Customer pending"} description={selectedCustomer?.phone ?? "Phone unavailable"} />
                                            <SummaryTile icon={Store} label="Merchant" title={selectedMerchant?.full_name ?? "Merchant pending"} description={selectedMerchant?.address ?? selectedMerchant?.phone ?? "Merchant details unavailable"} />
                                            <SummaryTile icon={Truck} label="Rider" title={selectedRider?.full_name ?? "Not assigned yet"} description={selectedRider?.phone ?? "Rider claim or assignment will appear here"} />
                                            <SummaryTile
                                                icon={Wallet}
                                                label="Commercials"
                                                title={formatKobo(selectedOrder.total_amount)}
                                                description={`Delivery ${formatKobo(selectedOrder.delivery_fee_kobo ?? 0)}`}
                                                meta={<Badge variant="outline" className={cn("border", getSettlementTone(selectedFinancials?.settlement_status))}>Commission {formatKobo(selectedFinancials?.agent_fee_total_kobo ?? 0)}</Badge>}
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-gray-200 shadow-sm dark:border-zinc-800">
                                <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <CardTitle className="text-lg text-gray-900 dark:text-white">Operational progress</CardTitle>
                                        <CardDescription>{completedCheckpointCount} of {checkpointRows.length} checkpoints complete</CardDescription>
                                    </div>
                                    <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-300">{progressPercent}% complete</Badge>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="h-2 rounded-full bg-gray-100 dark:bg-zinc-800">
                                        <div className="h-2 rounded-full bg-[#F58220] transition-all" style={{ width: `${Math.max(progressPercent, 6)}%` }} />
                                    </div>
                                    <div className="grid gap-3 lg:grid-cols-2">
                                        {checkpointRows.map((checkpoint) => {
                                            const done = Boolean(checkpoint.value)
                                            const current = !done && nextCheckpoint?.label === checkpoint.label

                                            return (
                                                <div key={checkpoint.label} className={cn("rounded-2xl border p-4", done ? "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/20" : current ? "border-orange-200 bg-orange-50/70 dark:border-orange-900 dark:bg-orange-950/20" : "border-gray-200 bg-white dark:border-zinc-800 dark:bg-zinc-950")}>
                                                    <div className="flex items-start gap-3">
                                                        <div className={cn("mt-0.5 flex h-8 w-8 items-center justify-center rounded-full border", done ? "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300" : current ? "border-orange-200 bg-orange-100 text-[#F58220] dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-300" : "border-gray-200 bg-gray-100 text-gray-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400")}>
                                                            {done ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="font-semibold text-gray-900 dark:text-white">{checkpoint.label}</p>
                                                            <p className="text-sm text-gray-600 dark:text-zinc-400">{checkpoint.description}</p>
                                                            <p className={cn("text-sm font-medium", done ? "text-emerald-700 dark:text-emerald-300" : current ? "text-[#F58220]" : "text-gray-500 dark:text-zinc-400")}>
                                                                {done ? formatDateTime(checkpoint.value) : current ? "Current focus" : "Pending"}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </CardContent>
                            </Card>

                            {disputes.length || refunds.length ? (
                                <div className="rounded-2xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300">
                                    This order has {disputes.length} dispute record{disputes.length === 1 ? "" : "s"} and {refunds.length} refund record{refunds.length === 1 ? "" : "s"}. Open Issues below for the full log.
                                </div>
                            ) : null}

                            <Card className="border-gray-200 shadow-sm dark:border-zinc-800">
                                <CardHeader>
                                    <CardTitle className="text-lg text-gray-900 dark:text-white">Secondary records</CardTitle>
                                    <CardDescription>Supporting details stay available without taking over the page.</CardDescription>
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
                        </>
                    ) : null}
                </div>
            </div>
        </div>
    )
}
