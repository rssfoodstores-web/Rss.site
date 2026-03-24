import { redirect } from "next/navigation"
import { BarChart3, Clock3, Package, Wallet } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { formatKobo } from "@/lib/money"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface MerchantLedgerRow {
    id: string
    amount: number
    description: string | null
    reference_id: string | null
    created_at: string | null
}

interface MerchantOrderRow {
    id: string
    status: string | null
    created_at: string | null
    delivery_verified_at: string | null
    order_financials: Array<{
        merchant_base_total_kobo: number
        settlement_status: string | null
    }> | null
    order_items: Array<{
        quantity: number
        products: Array<{ name: string | null }> | null
    }> | null
}

export default async function MerchantTransactionsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect("/login")
    }

    const [{ data: wallet }, { data: ledgerRows }, { data: orderRows }] = await Promise.all([
        supabase
            .from("wallets")
            .select("id, balance")
            .eq("owner_id", user.id)
            .eq("type", "merchant")
            .maybeSingle(),
        supabase
            .from("wallets")
            .select("id")
            .eq("owner_id", user.id)
            .eq("type", "merchant")
            .maybeSingle()
            .then(async ({ data }) => {
                if (!data?.id) {
                    return { data: [] as MerchantLedgerRow[] }
                }

                return supabase
                    .from("ledger_entries")
                    .select("id, amount, description, reference_id, created_at")
                    .eq("wallet_id", data.id)
                    .order("created_at", { ascending: false })
                    .limit(25)
            }),
        supabase
            .from("orders")
            .select(`
                id,
                status,
                created_at,
                delivery_verified_at,
                order_financials (
                    merchant_base_total_kobo,
                    settlement_status
                ),
                order_items (
                    quantity,
                    products (
                        name
                    )
                )
            `)
            .eq("merchant_id", user.id)
            .order("created_at", { ascending: false })
            .limit(80),
    ])

    const ledger = (ledgerRows ?? []) as MerchantLedgerRow[]
    const orders = (orderRows ?? []) as unknown as MerchantOrderRow[]

    const totalSettled = ledger.reduce((sum, entry) => sum + Math.max(entry.amount, 0), 0)
    const settledCount = ledger.length
    const pendingSettlement = orders.reduce((sum, order) => {
        const financial = order.order_financials?.[0]
        if (!financial) return sum
        if (financial.settlement_status === "completed") return sum
        return sum + (financial.merchant_base_total_kobo ?? 0)
    }, 0)

    const productsSold = orders.reduce((sum, order) => (
        sum + (order.order_items ?? []).reduce((itemSum, item) => itemSum + item.quantity, 0)
    ), 0)

    const topProducts = new Map<string, { quantity: number; revenue: number }>()
    for (const order of orders) {
        const merchantBase = order.order_financials?.[0]?.merchant_base_total_kobo ?? 0
        const items = order.order_items ?? []
        const totalQty = items.reduce((sum, item) => sum + item.quantity, 0) || 1

        for (const item of items) {
            const name = item.products?.[0]?.name ?? "Unnamed product"
            const current = topProducts.get(name) ?? { quantity: 0, revenue: 0 }
            current.quantity += item.quantity
            current.revenue += Math.round((merchantBase * item.quantity) / totalQty)
            topProducts.set(name, current)
        }
    }

    const topProductsList = Array.from(topProducts.entries())
        .map(([name, value]) => ({ name, ...value }))
        .sort((left, right) => right.quantity - left.quantity)
        .slice(0, 5)

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl">Merchant earnings</h1>
                <p className="mt-2 text-gray-500 dark:text-gray-400">
                    Real payout history, pending settlement value, and product-level sales insight.
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                <Card className="border-orange-100">
                    <CardContent className="flex items-center gap-4 p-6">
                        <div className="rounded-2xl bg-orange-50 p-3 text-[#F58220]"><Wallet className="h-5 w-5" /></div>
                        <div>
                            <p className="text-sm text-gray-500">Available balance</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatKobo(wallet?.balance ?? 0)}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-6">
                        <div className="rounded-2xl bg-green-50 p-3 text-green-600"><BarChart3 className="h-5 w-5" /></div>
                        <div>
                            <p className="text-sm text-gray-500">Settled payouts</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatKobo(totalSettled)}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-6">
                        <div className="rounded-2xl bg-blue-50 p-3 text-blue-600"><Clock3 className="h-5 w-5" /></div>
                        <div>
                            <p className="text-sm text-gray-500">Pending settlement</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatKobo(pendingSettlement)}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-6">
                        <div className="rounded-2xl bg-violet-50 p-3 text-violet-600"><Package className="h-5 w-5" /></div>
                        <div>
                            <p className="text-sm text-gray-500">Products sold</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{productsSold}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-8 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                <Card className="overflow-hidden">
                    <CardHeader className="border-b border-gray-100 dark:border-zinc-800">
                        <CardTitle>Recent merchant payouts</CardTitle>
                    </CardHeader>
                    <CardContent className="divide-y divide-gray-50 p-0 dark:divide-zinc-800">
                        {ledger.length === 0 ? (
                            <div className="p-10 text-center text-sm text-gray-500 dark:text-gray-400">
                                No merchant payout entries yet.
                            </div>
                        ) : (
                            ledger.map((entry) => (
                                <div key={entry.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <p className="font-semibold text-gray-900 dark:text-white">
                                            {entry.description ?? "Merchant payout"}
                                        </p>
                                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                            {entry.created_at ? new Date(entry.created_at).toLocaleString() : "Pending"}
                                            {entry.reference_id ? ` • Order ${entry.reference_id.slice(0, 8)}` : ""}
                                        </p>
                                    </div>
                                    <div className="text-left sm:text-right">
                                        <p className="text-lg font-bold text-green-600">{formatKobo(entry.amount)}</p>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">
                                            Settled
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="border-b border-gray-100 dark:border-zinc-800">
                        <CardTitle>Top selling products</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 p-6">
                        {topProductsList.length === 0 ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400">No product sales yet.</p>
                        ) : (
                            topProductsList.map((product) => (
                                <div key={product.name} className="rounded-2xl border border-gray-100 p-4 dark:border-zinc-800">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="font-semibold text-gray-900 dark:text-white">{product.name}</p>
                                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                                {product.quantity} units sold
                                            </p>
                                        </div>
                                        <Badge variant="outline">{formatKobo(product.revenue)}</Badge>
                                    </div>
                                </div>
                            ))
                        )}

                        <div className="rounded-2xl bg-orange-50 p-4 text-sm text-[#9A4A00] dark:bg-orange-950/20 dark:text-orange-200">
                            {settledCount} payout {settledCount === 1 ? "entry" : "entries"} have been written to your merchant wallet so far.
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
