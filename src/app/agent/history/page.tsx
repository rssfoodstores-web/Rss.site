import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatKobo } from "@/lib/money"
import {
    formatOrderStatus,
    formatPaymentStatus,
    formatSettlementStatus,
    getOrderOperationalHint,
    getOrderStatusTone,
    getPaymentStatusTone,
    getSettlementTone,
} from "@/lib/orders"
import { AlertCircle, ArrowRight, CheckCircle2, ClipboardList, ShieldAlert, Wallet } from "lucide-react"

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
    customer: Relation<RelationProfile>
    order_financials: Relation<{
        settlement_status: string | null
    }>
}

interface AgentOrderDisputeRow {
    id: string
    status: string | null
    reason: string | null
    resolution_notes: string | null
    created_at: string | null
}

interface AgentRefundRow {
    id: string
    amount_kobo: number
    status: string | null
    reason: string | null
    created_at: string | null
}

interface AgentOrderDetailRow {
    id: string
    status: string | null
    payment_status: string | null
    total_amount: number
    payment_ref: string | null
    created_at: string | null
    agent_accepted_at: string | null
    merchant_confirmed_at: string | null
    rider_assigned_at: string | null
    pickup_verified_at: string | null
    delivery_verified_at: string | null
    customer: Relation<RelationProfile>
    merchant: Relation<RelationProfile>
    rider: Relation<RelationProfile>
    order_disputes: AgentOrderDisputeRow[] | null
    refunds: AgentRefundRow[] | null
    order_financials: Relation<{
        settlement_status: string | null
        agent_fee_total_kobo: number
        settled_at: string | null
    }>
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

export default async function AgentHistoryPage({
    searchParams,
}: {
    searchParams: Promise<{ order?: string }>
}) {
    const { order: requestedOrderId } = await searchParams
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect("/login")
    }

    const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select(`
            id,
            status,
            payment_status,
            total_amount,
            created_at,
            customer:customer_id (
                id,
                full_name
            ),
            order_financials (
                settlement_status
            )
        `)
        .eq("assigned_agent_id", user.id)
        .order("created_at", { ascending: false })
        .limit(60)

    const normalizedOrders = ((orders ?? []) as unknown as AgentOrderSummaryRow[])
    const historyOrders = normalizedOrders.filter((row) =>
        ["completed", "delivered", "disputed", "refunded", "cancelled"].includes(row.status ?? "")
    )
    const completedCount = historyOrders.filter((row) => row.status === "completed" || row.status === "delivered").length
    const issueCount = historyOrders.filter((row) => row.status === "disputed" || row.status === "refunded" || row.status === "cancelled").length
    const selectedSummary =
        historyOrders.find((row) => row.id === requestedOrderId) ??
        historyOrders[0] ??
        null

    let selectedOrder: AgentOrderDetailRow | null = null
    let selectedOrderError: string | null = null

    if (selectedSummary) {
        const [
            { data: selectedBase, error: selectedBaseError },
            { data: selectedDisputes, error: selectedDisputesError },
            { data: selectedRefunds, error: selectedRefundsError },
        ] = await Promise.all([
            supabase
                .from("orders")
                .select(`
                    id,
                    status,
                    payment_status,
                    total_amount,
                    payment_ref,
                    created_at,
                    agent_accepted_at,
                    merchant_confirmed_at,
                    rider_assigned_at,
                    pickup_verified_at,
                    delivery_verified_at,
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
                        settlement_status,
                        agent_fee_total_kobo,
                        settled_at
                    )
                `)
                .eq("id", selectedSummary.id)
                .eq("assigned_agent_id", user.id)
                .maybeSingle(),
            supabase
                .from("order_disputes")
                .select("id, status, reason, resolution_notes, created_at")
                .eq("order_id", selectedSummary.id)
                .order("created_at", { ascending: false }),
            supabase
                .from("refunds")
                .select("id, amount_kobo, status, reason, created_at")
                .eq("order_id", selectedSummary.id)
                .order("created_at", { ascending: false }),
        ])

        if (selectedBaseError || !selectedBase) {
            selectedOrderError = selectedBaseError?.message ?? "Order details could not be loaded."
        } else {
            selectedOrder = {
                ...(selectedBase as unknown as Omit<AgentOrderDetailRow, "order_disputes" | "refunds">),
                order_disputes: (selectedDisputesError ? [] : (selectedDisputes ?? [])) as AgentOrderDetailRow["order_disputes"],
                refunds: (selectedRefundsError ? [] : (selectedRefunds ?? [])) as AgentOrderDetailRow["refunds"],
            }
        }
    }

    const selectedFinancials = firstRelation(selectedOrder?.order_financials ?? null)
    const selectedCustomer = firstRelation(selectedOrder?.customer ?? null)
    const selectedMerchant = firstRelation(selectedOrder?.merchant ?? null)
    const selectedRider = firstRelation(selectedOrder?.rider ?? null)
    const statusHint = selectedOrder ? getOrderOperationalHint(selectedOrder.status) : null

    return (
        <div className="space-y-8">
            <Card className="border-orange-100 bg-gradient-to-br from-white via-orange-50/40 to-white dark:from-zinc-950 dark:via-orange-950/10 dark:to-zinc-950">
                <CardContent className="space-y-6 p-6 lg:p-8">
                    <div className="space-y-2">
                        <Badge className="w-fit border border-orange-200 bg-white text-orange-700 dark:border-orange-900 dark:bg-transparent dark:text-orange-300">
                            History and exceptions
                        </Badge>
                        <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white sm:text-3xl">Review completed work without mixing it into the live queue</h2>
                        <p className="max-w-3xl text-sm text-gray-500">
                            This page is for delivered orders, refunds, disputes, and cancelled assignments. Active operations stay on the orders page.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <Button asChild className="bg-[#F58220] text-white hover:bg-[#E57210]">
                            <Link href="/agent/orders">
                                Back to active orders
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                        <Button asChild variant="outline">
                            <Link href="/agent/pricing">Open pricing</Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Card className="border-orange-100">
                    <CardContent className="flex items-center gap-4 p-6">
                        <div className="rounded-2xl bg-green-50 p-3 text-green-700 dark:bg-green-950/20">
                            <CheckCircle2 className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Completed deliveries</p>
                            <p className="text-3xl font-extrabold text-gray-900 dark:text-white">{completedCount}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-orange-100">
                    <CardContent className="flex items-center gap-4 p-6">
                        <div className="rounded-2xl bg-amber-50 p-3 text-amber-700 dark:bg-amber-950/20">
                            <ShieldAlert className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Exceptions</p>
                            <p className="text-3xl font-extrabold text-gray-900 dark:text-white">{issueCount}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-orange-100">
                    <CardContent className="flex items-center gap-4 p-6">
                        <div className="rounded-2xl bg-sky-50 p-3 text-sky-700 dark:bg-sky-950/20">
                            <ClipboardList className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Loaded records</p>
                            <p className="text-3xl font-extrabold text-gray-900 dark:text-white">{historyOrders.length}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-orange-100">
                    <CardContent className="flex items-center gap-4 p-6">
                        <div className="rounded-2xl bg-violet-50 p-3 text-violet-700 dark:bg-violet-950/20">
                            <Wallet className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Selected commission</p>
                            <p className="text-3xl font-extrabold text-gray-900 dark:text-white">{formatKobo(selectedFinancials?.agent_fee_total_kobo ?? 0)}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {ordersError ? (
                <Card className="border-red-200 bg-red-50 dark:bg-red-900/10">
                    <CardContent className="p-8 text-center text-red-600">
                        <AlertCircle className="mx-auto mb-4 h-10 w-10" />
                        <p>{ordersError.message}</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                    <Card className="border-orange-100">
                        <CardHeader className="space-y-2">
                            <CardTitle className="text-xl">Past assignments</CardTitle>
                            <p className="text-sm text-gray-500">Select any completed or exception order to review how it closed.</p>
                        </CardHeader>
                        <CardContent>
                            {historyOrders.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500 dark:border-zinc-800">
                                    No completed or exception orders have been assigned to you yet.
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-3 md:hidden">
                                        {historyOrders.map((order) => {
                                            const customer = firstRelation(order.customer)
                                            const settlementStatus = firstRelation(order.order_financials)?.settlement_status ?? "pending"
                                            const isSelected = selectedSummary?.id === order.id

                                            return (
                                                <Link
                                                    key={order.id}
                                                    href={`/agent/history?order=${order.id}`}
                                                    className={`block rounded-2xl border p-4 transition ${isSelected ? "border-orange-200 bg-orange-50/60 dark:border-orange-900 dark:bg-orange-950/10" : "border-gray-100 hover:border-orange-200 hover:bg-orange-50/40 dark:border-zinc-800 dark:hover:border-orange-900 dark:hover:bg-orange-950/10"}`}
                                                >
                                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                                        <div className="space-y-1">
                                                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Order</p>
                                                            <p className="font-semibold text-gray-900 dark:text-white">#{order.id.slice(0, 8)}</p>
                                                        </div>
                                                        <Badge className={`border ${getOrderStatusTone(order.status)}`}>{formatOrderStatus(order.status)}</Badge>
                                                    </div>
                                                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                                        <div>
                                                            <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Customer</p>
                                                            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{customer?.full_name ?? "Customer"}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Date</p>
                                                            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{formatShortDate(order.created_at)}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Total</p>
                                                            <p className="mt-1 font-semibold text-gray-900 dark:text-white">{formatKobo(order.total_amount)}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Settlement</p>
                                                            <Badge className={`mt-1 border ${getSettlementTone(settlementStatus)}`}>{formatSettlementStatus(settlementStatus)}</Badge>
                                                        </div>
                                                    </div>
                                                </Link>
                                            )
                                        })}
                                    </div>
                                    <div className="hidden overflow-x-auto md:block">
                                        <table className="w-full min-w-[680px] text-left">
                                        <thead>
                                            <tr className="border-b border-gray-100 text-xs uppercase tracking-[0.18em] text-gray-500 dark:border-zinc-800">
                                                <th className="pb-4">Order</th>
                                                <th className="pb-4">Customer</th>
                                                <th className="pb-4">Date</th>
                                                <th className="pb-4">Total</th>
                                                <th className="pb-4">Outcome</th>
                                                <th className="pb-4">Settlement</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                            {historyOrders.map((order) => {
                                                const customer = firstRelation(order.customer)
                                                const settlementStatus = firstRelation(order.order_financials)?.settlement_status ?? "pending"
                                                const isSelected = selectedSummary?.id === order.id

                                                return (
                                                    <tr key={order.id} className={isSelected ? "bg-orange-50/60 dark:bg-orange-950/10" : ""}>
                                                        <td className="py-4">
                                                            <Link href={`/agent/history?order=${order.id}`} className="font-semibold text-gray-900 transition hover:text-[#F58220] dark:text-white">
                                                                #{order.id.slice(0, 8)}
                                                            </Link>
                                                        </td>
                                                        <td className="py-4 text-gray-600 dark:text-gray-300">{customer?.full_name ?? "Customer"}</td>
                                                        <td className="py-4 text-gray-500">{formatShortDate(order.created_at)}</td>
                                                        <td className="py-4 text-gray-900 dark:text-white">{formatKobo(order.total_amount)}</td>
                                                        <td className="py-4">
                                                            <Badge className={`border ${getOrderStatusTone(order.status)}`}>{formatOrderStatus(order.status)}</Badge>
                                                        </td>
                                                        <td className="py-4">
                                                            <Badge className={`border ${getSettlementTone(settlementStatus)}`}>{formatSettlementStatus(settlementStatus)}</Badge>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                        </table>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    <div className="space-y-6">
                        {selectedOrderError ? (
                            <Card className="border-red-200 bg-red-50 dark:bg-red-900/10">
                                <CardContent className="p-8 text-center text-red-600">
                                    <AlertCircle className="mx-auto mb-4 h-10 w-10" />
                                    <p className="font-semibold">This order could not be loaded.</p>
                                    <p className="mt-2 text-sm text-red-500/90">{selectedOrderError}</p>
                                </CardContent>
                            </Card>
                        ) : !selectedOrder ? (
                            <Card>
                                <CardContent className="p-10 text-center text-gray-500">
                                    Select a past order to review its outcome here.
                                </CardContent>
                            </Card>
                        ) : (
                            <>
                                <Card className="border-orange-100">
                                    <CardHeader className="space-y-4">
                                        <div className="space-y-3">
                                            <div className="flex flex-wrap items-center gap-3">
                                                <CardTitle className="text-2xl font-extrabold text-gray-900 dark:text-white">
                                                    Order #{selectedOrder.id.slice(0, 8)}
                                                </CardTitle>
                                                <Badge className={`border ${getOrderStatusTone(selectedOrder.status)}`}>{formatOrderStatus(selectedOrder.status)}</Badge>
                                                <Badge className={`border ${getPaymentStatusTone(selectedOrder.payment_status)}`}>{formatPaymentStatus(selectedOrder.payment_status)}</Badge>
                                                <Badge className={`border ${getSettlementTone(selectedFinancials?.settlement_status ?? "pending")}`}>
                                                    {formatSettlementStatus(selectedFinancials?.settlement_status ?? "pending")}
                                                </Badge>
                                            </div>
                                            <p className="text-sm text-gray-500">
                                                Payment reference: {selectedOrder.payment_ref ?? "Waiting for payment reference"}
                                            </p>
                                            {statusHint ? <p className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:bg-zinc-900 dark:text-gray-300">{statusHint}</p> : null}
                                        </div>
                                    </CardHeader>
                                </Card>

                                <Card className="border-orange-100">
                                    <CardHeader>
                                        <CardTitle className="text-lg">Closure summary</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4 text-sm text-gray-600 dark:text-gray-300">
                                        <div className="rounded-2xl bg-gray-50 px-4 py-4 dark:bg-zinc-900">
                                            <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Customer</p>
                                            <p className="mt-2 font-semibold text-gray-900 dark:text-white">{selectedCustomer?.full_name ?? "Customer"}</p>
                                            {selectedCustomer?.phone ? <p className="mt-1">{selectedCustomer.phone}</p> : null}
                                        </div>
                                        <div className="rounded-2xl bg-gray-50 px-4 py-4 dark:bg-zinc-900">
                                            <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Merchant</p>
                                            <p className="mt-2 font-semibold text-gray-900 dark:text-white">{selectedMerchant?.full_name ?? "RSS Merchant"}</p>
                                            {selectedMerchant?.address ? <p className="mt-1">{selectedMerchant.address}</p> : null}
                                        </div>
                                        <div className="rounded-2xl bg-gray-50 px-4 py-4 dark:bg-zinc-900">
                                            <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Rider</p>
                                            <p className="mt-2 font-semibold text-gray-900 dark:text-white">{selectedRider?.full_name ?? "Not assigned"}</p>
                                            {selectedRider?.phone ? <p className="mt-1">{selectedRider.phone}</p> : null}
                                        </div>
                                        <div className="rounded-2xl border border-orange-100 bg-orange-50/60 px-4 py-4 dark:border-orange-900 dark:bg-orange-950/10">
                                            <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Commission and settlement</p>
                                            <p className="mt-2 text-lg font-bold text-gray-900 dark:text-white">{formatKobo(selectedFinancials?.agent_fee_total_kobo ?? 0)}</p>
                                            <p className="mt-1">Settled {formatDateTime(selectedFinancials?.settled_at)}</p>
                                        </div>
                                        <div className="space-y-2 rounded-2xl border border-gray-100 px-4 py-4 dark:border-zinc-800">
                                            <p className="font-semibold text-gray-900 dark:text-white">Timeline</p>
                                            <p>Created: {formatDateTime(selectedOrder.created_at)}</p>
                                            <p>Agent accepted: {formatDateTime(selectedOrder.agent_accepted_at)}</p>
                                            <p>Merchant confirmed: {formatDateTime(selectedOrder.merchant_confirmed_at)}</p>
                                            <p>Rider assigned: {formatDateTime(selectedOrder.rider_assigned_at)}</p>
                                            <p>Pickup verified: {formatDateTime(selectedOrder.pickup_verified_at)}</p>
                                            <p>Delivery completed: {formatDateTime(selectedOrder.delivery_verified_at)}</p>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="border-orange-100">
                                    <CardHeader>
                                        <CardTitle className="text-lg">Disputes and refunds</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        {!selectedOrder.order_disputes?.length && !selectedOrder.refunds?.length ? (
                                            <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-sm text-gray-500 dark:border-zinc-800">
                                                No disputes or refunds were attached to this order.
                                            </div>
                                        ) : null}

                                        {selectedOrder.order_disputes?.map((dispute) => (
                                            <div key={dispute.id} className="rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-4 dark:border-amber-900 dark:bg-amber-950/10">
                                                <div className="flex items-center justify-between gap-3">
                                                    <p className="font-semibold text-gray-900 dark:text-white">Dispute</p>
                                                    <Badge className="border border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300">
                                                        {dispute.status ?? "open"}
                                                    </Badge>
                                                </div>
                                                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{dispute.reason}</p>
                                                <p className="mt-2 text-xs text-gray-500">Opened {formatDateTime(dispute.created_at)}</p>
                                                {dispute.resolution_notes ? <p className="mt-2 text-xs text-gray-500">Resolution: {dispute.resolution_notes}</p> : null}
                                            </div>
                                        ))}

                                        {selectedOrder.refunds?.map((refund) => (
                                            <div key={refund.id} className="rounded-2xl border border-blue-200 bg-blue-50/70 px-4 py-4 dark:border-blue-900 dark:bg-blue-950/10">
                                                <div className="flex items-center justify-between gap-3">
                                                    <p className="font-semibold text-gray-900 dark:text-white">Refund</p>
                                                    <Badge className="border border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-300">
                                                        {refund.status ?? "pending"}
                                                    </Badge>
                                                </div>
                                                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{formatKobo(refund.amount_kobo)}</p>
                                                {refund.reason ? <p className="mt-2 text-xs text-gray-500">Reason: {refund.reason}</p> : null}
                                                <p className="mt-2 text-xs text-gray-500">Created {formatDateTime(refund.created_at)}</p>
                                            </div>
                                        ))}
                                    </CardContent>
                                </Card>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
