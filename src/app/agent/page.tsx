import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatKobo } from "@/lib/money"
import { formatOrderStatus, getOrderStatusTone } from "@/lib/orders"
import {
    AlertCircle,
    ArrowRight,
    ClipboardList,
    Clock3,
    History,
    ReceiptText,
    Store,
    Tags,
    Truck,
    Wallet,
} from "lucide-react"

interface RelationProfile {
    id?: string
    full_name: string | null
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
    order_financials: Relation<{
        settlement_status: string | null
    }>
}

interface AgentPendingProductRow {
    id: string
    name: string
    created_at: string | null
    price: number
    merchant: Relation<RelationProfile>
}

interface AgentPriceInputRow {
    product_id: string
    created_at: string
}

interface AgentCommissionSummaryRow {
    order_financials: Array<{
        agent_fee_total_kobo: number
        settlement_status: string | null
    }> | null
}

function firstRelation<T>(value: Relation<T>): T | null {
    if (Array.isArray(value)) {
        return value[0] ?? null
    }

    return value ?? null
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

function getQueueLabel(status: string | null | undefined, riderAssigned: boolean) {
    switch (status) {
        case "awaiting_agent_acceptance":
            return "Accept assignment"
        case "awaiting_merchant_confirmation":
            return "Follow up merchant"
        case "processing":
            return "Open rider dispatch"
        case "ready_for_pickup":
            return riderAssigned ? "Track rider handoff" : "Waiting for rider"
        case "out_for_delivery":
            return "Track delivery"
        default:
            return formatOrderStatus(status)
    }
}

export default async function AgentOverviewPage() {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect("/login")
    }

    const [
        { data: orders, error: ordersError },
        { data: pendingProducts, error: pendingProductsError },
        { data: priceInputs, error: priceInputsError },
        { data: agentWallet },
        { data: commissionRows },
    ] = await Promise.all([
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
                    full_name
                ),
                merchant:merchant_id (
                    id,
                    full_name
                ),
                order_financials (
                    settlement_status
                )
            `)
            .eq("assigned_agent_id", user.id)
            .order("created_at", { ascending: false })
            .limit(40),
        supabase
            .from("products")
            .select(`
                id,
                name,
                created_at,
                price,
                merchant:merchant_id (
                    id,
                    full_name
                )
            `)
            .eq("status", "pending")
            .order("created_at", { ascending: false })
            .limit(8),
        supabase
            .from("product_price_inputs")
            .select("product_id, created_at")
            .eq("source", "agent")
            .eq("source_user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(40),
        supabase
            .from("wallets")
            .select("id, balance")
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
    const normalizedPendingProducts = ((pendingProducts ?? []) as unknown as AgentPendingProductRow[])
    const normalizedPriceInputs = (priceInputs ?? []) as AgentPriceInputRow[]
    const latestInputByProductId = new Map<string, AgentPriceInputRow>()

    for (const input of normalizedPriceInputs) {
        if (!latestInputByProductId.has(input.product_id)) {
            latestInputByProductId.set(input.product_id, input)
        }
    }

    const activeOrders = normalizedOrders.filter((order) =>
        ["awaiting_agent_acceptance", "awaiting_merchant_confirmation", "processing", "ready_for_pickup", "out_for_delivery"].includes(order.status ?? "")
    )
    const historyOrders = normalizedOrders.filter((order) =>
        ["completed", "delivered", "disputed", "refunded", "cancelled"].includes(order.status ?? "")
    )
    const needsAcceptanceCount = activeOrders.filter((order) => order.status === "awaiting_agent_acceptance").length
    const waitingMerchantCount = activeOrders.filter((order) => order.status === "awaiting_merchant_confirmation").length
    const riderLiveCount = activeOrders.filter((order) => order.status === "ready_for_pickup" || order.status === "out_for_delivery").length
    const pendingPricingWithoutInput = normalizedPendingProducts.filter((product) => !latestInputByProductId.has(product.id)).length
    const commissionSummary = (commissionRows ?? []) as unknown as AgentCommissionSummaryRow[]
    const settledCommissionTotal = commissionSummary.reduce((sum, order) => {
        const financial = firstRelation(order.order_financials)
        if (!financial || financial.settlement_status !== "completed") {
            return sum
        }
        return sum + financial.agent_fee_total_kobo
    }, 0)

    return (
        <div className="space-y-8">
            <Card className="border-orange-100 bg-gradient-to-br from-white via-orange-50/50 to-white dark:from-zinc-950 dark:via-orange-950/10 dark:to-zinc-950">
                <CardContent className="space-y-6 p-6 lg:p-8">
                    <div className="space-y-3">
                        <Badge className="w-fit border border-orange-200 bg-white text-orange-700 dark:border-orange-900 dark:bg-transparent dark:text-orange-300">
                            Agent workspace
                        </Badge>
                        <div className="space-y-2">
                            <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white sm:text-3xl">Keep live orders moving without digging through clutter</h2>
                            <p className="max-w-3xl text-sm text-gray-500">
                                Orders, pricing, and history are separated so the current queue is easy to read. Start from the route that matches the job you need to do.
                            </p>
                        </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        <Button asChild className="h-auto justify-between rounded-2xl bg-[#F58220] px-5 py-4 text-left text-white hover:bg-[#E57210]">
                            <Link href="/agent/orders">
                                <span>
                                    <span className="block text-xs uppercase tracking-[0.18em] text-white/80">Operations</span>
                                    <span className="mt-1 block text-lg font-bold">Open orders queue</span>
                                </span>
                                <ArrowRight className="h-5 w-5" />
                            </Link>
                        </Button>

                        <Button asChild variant="outline" className="h-auto justify-between rounded-2xl px-5 py-4 text-left">
                            <Link href="/agent/pricing">
                                <span>
                                    <span className="block text-xs uppercase tracking-[0.18em] text-gray-500">Pricing</span>
                                    <span className="mt-1 block text-lg font-bold text-gray-900 dark:text-white">Survey pricing queue</span>
                                </span>
                                <ArrowRight className="h-5 w-5" />
                            </Link>
                        </Button>

                        <Button asChild variant="outline" className="h-auto justify-between rounded-2xl px-5 py-4 text-left">
                            <Link href="/agent/history">
                                <span>
                                    <span className="block text-xs uppercase tracking-[0.18em] text-gray-500">History</span>
                                    <span className="mt-1 block text-lg font-bold text-gray-900 dark:text-white">Completed and exception log</span>
                                </span>
                                <ArrowRight className="h-5 w-5" />
                            </Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Card className="border-orange-100">
                    <CardContent className="flex items-center gap-4 p-6">
                        <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700 dark:bg-emerald-950/20">
                            <Wallet className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Agent wallet</p>
                            <p className="text-3xl font-extrabold text-gray-900 dark:text-white">{formatKobo(agentWallet?.balance ?? 0)}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-orange-100">
                    <CardContent className="flex items-center gap-4 p-6">
                        <div className="rounded-2xl bg-green-50 p-3 text-green-700 dark:bg-green-950/20">
                            <ReceiptText className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Settled commission</p>
                            <p className="text-3xl font-extrabold text-gray-900 dark:text-white">{formatKobo(settledCommissionTotal)}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-orange-100">
                    <CardContent className="flex items-center gap-4 p-6">
                        <div className="rounded-2xl bg-orange-50 p-3 text-[#F58220] dark:bg-orange-950/20">
                            <ClipboardList className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Active queue</p>
                            <p className="text-3xl font-extrabold text-gray-900 dark:text-white">{activeOrders.length}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-orange-100">
                    <CardContent className="flex items-center gap-4 p-6">
                        <div className="rounded-2xl bg-amber-50 p-3 text-amber-700 dark:bg-amber-950/20">
                            <Clock3 className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Needs acceptance</p>
                            <p className="text-3xl font-extrabold text-gray-900 dark:text-white">{needsAcceptanceCount}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-orange-100">
                    <CardContent className="flex items-center gap-4 p-6">
                        <div className="rounded-2xl bg-sky-50 p-3 text-sky-700 dark:bg-sky-950/20">
                            <Store className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Waiting on merchant</p>
                            <p className="text-3xl font-extrabold text-gray-900 dark:text-white">{waitingMerchantCount}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-orange-100">
                    <CardContent className="flex items-center gap-4 p-6">
                        <div className="rounded-2xl bg-violet-50 p-3 text-violet-700 dark:bg-violet-950/20">
                            <Tags className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Pricing queue</p>
                            <p className="text-3xl font-extrabold text-gray-900 dark:text-white">{normalizedPendingProducts.length}</p>
                            <p className="mt-1 text-xs text-gray-500">{pendingPricingWithoutInput} still need your input</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-3">
                <Card className="border-orange-100 xl:col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
                        <div className="space-y-1">
                            <CardTitle className="text-xl">Needs attention now</CardTitle>
                            <p className="text-sm text-gray-500">The highest-signal live orders to open first.</p>
                        </div>
                        <Button asChild variant="outline">
                            <Link href="/agent/orders">Open full queue</Link>
                        </Button>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {ordersError ? (
                            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-5 text-sm text-red-600 dark:bg-red-900/10">
                                {ordersError.message}
                            </div>
                        ) : activeOrders.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500 dark:border-zinc-800">
                                No active orders in your queue right now.
                            </div>
                        ) : (
                            activeOrders.slice(0, 6).map((order) => {
                                const customer = firstRelation(order.customer)
                                const merchant = firstRelation(order.merchant)

                                return (
                                    <Link
                                        key={order.id}
                                        href={`/agent/orders?order=${order.id}`}
                                        className="flex items-center justify-between gap-4 rounded-2xl border border-gray-100 px-4 py-4 transition hover:border-orange-200 hover:bg-orange-50/40 dark:border-zinc-800 dark:hover:border-orange-900"
                                    >
                                        <div className="min-w-0 space-y-1">
                                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Order #{order.id.slice(0, 8)}</p>
                                            <p className="truncate font-bold text-gray-900 dark:text-white">{customer?.full_name ?? "Customer"}</p>
                                            <p className="truncate text-sm text-gray-500">
                                                Merchant: {merchant?.full_name ?? "RSS Merchant"} | {getQueueLabel(order.status, Boolean(order.rider_id))}
                                            </p>
                                        </div>
                                        <div className="space-y-2 text-right">
                                            <Badge className={`border ${getOrderStatusTone(order.status)}`}>
                                                {formatOrderStatus(order.status)}
                                            </Badge>
                                            <p className="text-xs text-gray-500">{formatShortDate(order.created_at)}</p>
                                        </div>
                                    </Link>
                                )
                            })
                        )}
                    </CardContent>
                </Card>

                <Card className="border-orange-100">
                    <CardHeader className="space-y-1">
                        <CardTitle className="text-xl">Live dispatch</CardTitle>
                        <p className="text-sm text-gray-500">Orders already with rider activity.</p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="rounded-2xl bg-blue-50 px-4 py-4 dark:bg-blue-950/10">
                            <div className="flex items-center gap-3">
                                <Truck className="h-5 w-5 text-blue-600" />
                                <div>
                                    <p className="text-sm text-gray-500">Dispatch in flight</p>
                                    <p className="text-3xl font-extrabold text-gray-900 dark:text-white">{riderLiveCount}</p>
                                </div>
                            </div>
                        </div>
                        <div className="rounded-2xl bg-gray-50 px-4 py-4 dark:bg-zinc-900">
                            <div className="flex items-center gap-3">
                                <History className="h-5 w-5 text-gray-500" />
                                <div>
                                    <p className="text-sm text-gray-500">Completed or closed</p>
                                    <p className="text-3xl font-extrabold text-gray-900 dark:text-white">{historyOrders.length}</p>
                                </div>
                            </div>
                        </div>
                        <Button asChild className="w-full bg-[#1E1E66] text-white hover:bg-[#1E1E66]/90">
                            <Link href="/agent/history">Review past orders</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
                <Card className="border-orange-100">
                    <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
                        <div className="space-y-1">
                            <CardTitle className="text-xl">Pricing queue snapshot</CardTitle>
                            <p className="text-sm text-gray-500">Products still waiting on market survey input or review.</p>
                        </div>
                        <Button asChild variant="outline">
                            <Link href="/agent/pricing">Open pricing</Link>
                        </Button>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {pendingProductsError || priceInputsError ? (
                            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-5 text-sm text-red-600 dark:bg-red-900/10">
                                {pendingProductsError?.message ?? priceInputsError?.message}
                            </div>
                        ) : normalizedPendingProducts.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500 dark:border-zinc-800">
                                No products are waiting on survey pricing right now.
                            </div>
                        ) : (
                            normalizedPendingProducts.map((product) => {
                                const merchant = firstRelation(product.merchant)
                                const latestInput = latestInputByProductId.get(product.id)

                                return (
                                    <div key={product.id} className="rounded-2xl border border-gray-100 px-4 py-4 dark:border-zinc-800">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="space-y-1">
                                                <p className="font-bold text-gray-900 dark:text-white">{product.name}</p>
                                                <p className="text-sm text-gray-500">Merchant: {merchant?.full_name ?? "RSS Merchant"}</p>
                                            </div>
                                            <Badge variant="outline" className="border-orange-200 text-orange-700 dark:border-orange-900 dark:text-orange-300">
                                                {latestInput ? "Survey saved" : "Awaiting survey"}
                                            </Badge>
                                        </div>
                                        <div className="mt-3 flex items-center justify-between text-sm text-gray-500">
                                            <span>{formatKobo(product.price)}</span>
                                            <span>{latestInput ? formatShortDate(latestInput.created_at) : formatShortDate(product.created_at)}</span>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </CardContent>
                </Card>

                <Card className="border-orange-100">
                    <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
                        <div className="space-y-1">
                            <CardTitle className="text-xl">Recent closures</CardTitle>
                            <p className="text-sm text-gray-500">Completed deliveries and exception outcomes assigned to you.</p>
                        </div>
                        <Button asChild variant="outline">
                            <Link href="/agent/history">Open history</Link>
                        </Button>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {ordersError ? (
                            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-5 text-sm text-red-600 dark:bg-red-900/10">
                                {ordersError.message}
                            </div>
                        ) : historyOrders.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500 dark:border-zinc-800">
                                Completed and exception orders will appear here after your first delivery cycle.
                            </div>
                        ) : (
                            historyOrders.slice(0, 6).map((order) => {
                                const customer = firstRelation(order.customer)
                                const settlementStatus = firstRelation(order.order_financials)?.settlement_status ?? "pending"

                                return (
                                    <Link
                                        key={order.id}
                                        href={`/agent/history?order=${order.id}`}
                                        className="flex items-center justify-between gap-4 rounded-2xl border border-gray-100 px-4 py-4 transition hover:border-orange-200 hover:bg-orange-50/40 dark:border-zinc-800 dark:hover:border-orange-900"
                                    >
                                        <div className="space-y-1">
                                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Order #{order.id.slice(0, 8)}</p>
                                            <p className="font-bold text-gray-900 dark:text-white">{customer?.full_name ?? "Customer"}</p>
                                            <p className="text-sm text-gray-500">
                                                Settlement: {settlementStatus === "completed" ? "Settled" : settlementStatus.replace(/_/g, " ")}
                                            </p>
                                        </div>
                                        <div className="space-y-2 text-right">
                                            <Badge className={`border ${getOrderStatusTone(order.status)}`}>
                                                {formatOrderStatus(order.status)}
                                            </Badge>
                                            <p className="text-xs text-gray-500">{formatShortDate(order.created_at)}</p>
                                        </div>
                                    </Link>
                                )
                            })
                        )}
                    </CardContent>
                </Card>
            </div>

            {(ordersError || pendingProductsError || priceInputsError) && (
                <Card className="border-amber-200 bg-amber-50/70 dark:bg-amber-950/10">
                    <CardContent className="flex items-start gap-3 p-5 text-sm text-amber-800 dark:text-amber-300">
                        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                        <p>
                            Some overview widgets could not be loaded. The dedicated pages still expose clearer error states and can usually continue independently.
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
