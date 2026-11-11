import { redirect } from "next/navigation"
import { ChevronRight } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { formatKobo } from "@/lib/money"
import { RevenueChart } from "@/components/merchant/dashboard/RevenueChart"

const orderPageSize = 500
const activityLimit = 25
const dateFormat = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeZone: "Africa/Lagos" })
const monthFormat = new Intl.DateTimeFormat("en-NG", { month: "short", year: "numeric", timeZone: "Africa/Lagos" })
type Relation<T> = T | T[] | null

interface MerchantOrder {
    id: string
    status: string | null
    payment_status: string | null
    created_at: string | null
    order_financials: Relation<{ merchant_base_total_kobo: number | null; settlement_status: string | null }>
    order_items: Array<{
        quantity: number
        price_per_unit: number
        total_price: number | null
        products: Relation<{ id: string; name: string | null }>
    }> | null
}

function first<T>(relation: Relation<T>) {
    return Array.isArray(relation) ? relation[0] : relation
}

async function loadMerchantOrders(supabase: Awaited<ReturnType<typeof createClient>>, merchantId: string) {
    const orders: MerchantOrder[] = []
    for (let offset = 0; ; offset += orderPageSize) {
        const { data, error } = await supabase.from("orders").select(`
            id, status, payment_status, created_at,
            order_financials(merchant_base_total_kobo, settlement_status),
            order_items(quantity, price_per_unit, total_price, products(id, name))
        `).eq("merchant_id", merchantId)
            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
            .range(offset, offset + orderPageSize - 1)

        if (error) return { orders: [], error }
        const page = (data ?? []) as unknown as MerchantOrder[]
        orders.push(...page)
        if (page.length < orderPageSize) return { orders, error: null }
    }
}

export default async function MerchantTransactionsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect("/login")

    const [walletResult, ordersResult] = await Promise.all([
        supabase.from("wallets").select("id, balance").eq("owner_id", user.id).eq("type", "merchant").maybeSingle(),
        loadMerchantOrders(supabase, user.id),
    ])

    const wallet = walletResult.data
    const ledgerResult = wallet?.id ? await supabase.from("ledger_entries")
        .select("id, amount, description, reference_id, created_at")
        .eq("wallet_id", wallet.id).order("created_at", { ascending: false }).limit(activityLimit) : null
    const { orders } = ordersResult
    const ledger = ledgerResult?.data ?? []
    const paidOrders = orders.filter((order) => order.payment_status === "paid" && order.status !== "cancelled")
    const pending = paidOrders.flatMap((order) => {
        const financial = first(order.order_financials)
        return financial?.settlement_status === "pending" ? [{
            id: order.id, amount: financial.merchant_base_total_kobo ?? 0, date: order.created_at,
        }] : []
    })
    const pendingTotal = pending.reduce((sum, entry) => sum + entry.amount, 0)
    const settledTotal = orders.reduce((sum, order) => {
        const financial = first(order.order_financials)
        return financial?.settlement_status === "completed" ? sum + (financial.merchant_base_total_kobo ?? 0) : sum
    }, 0)

    let gross = 0
    let units = 0
    const monthlySales = new Map<string, number>()
    const products = new Map<string, { name: string; quantity: number; gross: number }>()
    for (const order of [...paidOrders].reverse()) {
        const month = order.created_at ? monthFormat.format(new Date(order.created_at)) : "Undated"
        for (const item of order.order_items ?? []) {
            const product = first(item.products)
            const name = product?.name ?? "Unnamed product"
            const key = product?.id ?? name
            const amount = item.total_price ?? item.price_per_unit * item.quantity
            const totals = products.get(key) ?? { name, quantity: 0, gross: 0 }
            totals.quantity += item.quantity
            totals.gross += amount
            products.set(key, totals)
            monthlySales.set(month, (monthlySales.get(month) ?? 0) + amount)
            gross += amount
            units += item.quantity
        }
    }
    const topProducts = [...products.entries()].sort(([, a], [, b]) => b.quantity - a.quantity).slice(0, 5)
    const activity = [
        ...ledger.map((entry) => ({
            key: `ledger-${entry.id}`, title: entry.description ?? "Merchant wallet entry",
            reference: entry.reference_id, date: entry.created_at, amount: entry.amount,
            state: entry.amount < 0 ? "Debited from wallet" : "Credited to wallet",
        })),
        ...pending.map((entry) => ({
            key: `pending-${entry.id}`, title: `Order #${entry.id.slice(0, 8).toUpperCase()}`,
            reference: null, date: entry.date, amount: entry.amount, state: "Awaiting settlement",
        })),
    ].sort((a, b) => (Date.parse(b.date ?? "") || 0) - (Date.parse(a.date ?? "") || 0)).slice(0, activityLimit)

    const balances = [
        { title: "Available balance", value: walletResult.error ? null : wallet?.balance ?? 0, detail: "In your merchant wallet" },
        { title: "Pending settlement", value: ordersResult.error ? null : pendingTotal, detail: "Waiting to be credited" },
        { title: "Settled payouts", value: ordersResult.error ? null : settledTotal, detail: "Already credited to your wallet" },
    ]
    const incompleteActivity = Boolean(ledgerResult?.error || walletResult.error || ordersResult.error)

    return (
        <div className="mx-auto min-w-0 max-w-4xl space-y-5 py-2 sm:py-4">
            <header>
                <p className="text-xs font-bold uppercase tracking-widest text-orange-800 dark:text-orange-300">Merchant workspace</p>
                <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Transactions</h1>
                <p className="mt-1 text-sm text-muted-foreground">Track your balance, settlements, and sales.</p>
            </header>
            <section aria-label="Merchant balances">
                <dl className="grid divide-y overflow-hidden rounded-2xl border bg-card sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                    {balances.map(({ title, value, detail }, index) => (
                        <div key={title} className={`min-w-0 p-4 ${index === 0 ? "bg-orange-50 dark:bg-orange-950/30" : ""}`}>
                            <dt className="text-sm font-semibold">{title}</dt>
                            <dd className="mt-1 break-words text-xl font-bold tracking-tight tabular-nums md:text-2xl">{value === null ? "Unavailable" : formatKobo(value)}</dd>
                            <dd className="text-sm text-muted-foreground">{detail}</dd>
                        </div>
                    ))}
                </dl>
            </section>

            <section aria-labelledby="merchant-activity">
                <h2 id="merchant-activity" className="mb-2 text-lg font-semibold">Recent transactions</h2>
                {incompleteActivity && <p role="status" className="mb-2 text-sm text-muted-foreground">Some transactions couldn’t load.</p>}
                {activity.length ? (
                    <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
                        {activity.map((entry) => (
                            <li key={entry.key} className="flex items-start justify-between gap-3 px-4 py-3">
                                <div className="min-w-0">
                                    <p className="break-words text-sm font-semibold">{entry.title}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {entry.date ? `${dateFormat.format(new Date(entry.date))} · ` : ""}{entry.state}
                                        {entry.reference ? ` · Ref ${entry.reference.slice(0, 8).toUpperCase()}` : ""}
                                    </p>
                                </div>
                                <p className="shrink-0 text-right text-sm font-semibold tabular-nums">{formatKobo(entry.amount)}</p>
                            </li>
                        ))}
                    </ul>
                ) : !incompleteActivity && (
                    <p className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">No merchant transactions yet.</p>
                )}
            </section>

            <details className="group rounded-2xl border bg-card">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 font-semibold [&::-webkit-details-marker]:hidden">
                    Sales &amp; product statistics <ChevronRight className="size-4 shrink-0 group-open:rotate-90" aria-hidden="true" />
                </summary>
                <div className="space-y-3 border-t p-4">
                    {ordersResult.error ? <p className="text-sm text-muted-foreground">Sales statistics couldn’t load.</p> : (
                        <>
                            <p className="text-sm text-muted-foreground">Sales and units reflect paid orders, excluding cancellations.</p>
                            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                <div><dt className="text-sm text-muted-foreground">Gross sales before fees</dt><dd className="break-words text-lg font-bold tabular-nums">{formatKobo(gross)}</dd></div>
                                <div><dt className="text-sm text-muted-foreground">Total orders</dt><dd className="text-lg font-bold tabular-nums">{orders.length}</dd></div>
                                <div><dt className="text-sm text-muted-foreground">Units sold</dt><dd className="text-lg font-bold tabular-nums">{units}</dd></div>
                            </dl>
                            {monthlySales.size > 1 && <RevenueChart totalRevenue={gross} data={[...monthlySales].map(([name, revenue]) => ({ name, revenue }))} />}
                            <h3 className="font-semibold">Top products by units sold</h3>
                            {topProducts.length ? (
                                <ol className="divide-y border-t">
                                    {topProducts.map(([key, product]) => (
                                        <li key={key} className="flex items-start justify-between gap-3 py-2 text-sm">
                                            <span className="min-w-0 break-words">{product.name}<span className="block text-xs text-muted-foreground">{product.quantity} sold</span></span>
                                            <span className="shrink-0 font-medium tabular-nums">{formatKobo(product.gross)}</span>
                                        </li>
                                    ))}
                                </ol>
                            ) : <p className="text-sm text-muted-foreground">No paid product sales yet.</p>}
                        </>
                    )}
                </div>
            </details>
        </div>
    )
}
