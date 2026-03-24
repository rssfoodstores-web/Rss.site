import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { StatsWidget } from "@/components/merchant/dashboard/StatsWidget"
import { RevenueChart } from "@/components/merchant/dashboard/RevenueChart"
import { BestsellersTable, RecentOrdersTable, TopProductsWidget } from "@/components/merchant/dashboard/Widgets"
import { VerifyRiderWidget } from "@/components/merchant/dashboard/VerifyRiderWidget"
import { formatKobo } from "@/lib/money"

type Relation<T> = T | T[] | null

interface MerchantDashboardOrderRow {
    id: string
    status: string | null
    created_at: string | null
    rider_id: string | null
    customer: Relation<{
        full_name: string | null
    }>
    order_items: Array<{
        quantity: number
        price_per_unit: number
        total_price: number | null
        products: Relation<{
            id: string
            name: string | null
        }>
    }>
    order_financials: Relation<{
        merchant_base_total_kobo: number | null
        settlement_status: string | null
    }>
}

function firstRelation<T>(value: Relation<T>): T | null {
    if (Array.isArray(value)) {
        return value[0] ?? null
    }

    return value ?? null
}

function sumOrderGross(order: MerchantDashboardOrderRow) {
    return order.order_items.reduce((sum, item) => {
        return sum + (item.total_price ?? item.price_per_unit * item.quantity)
    }, 0)
}

export default async function MerchantDashboard() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect("/login")
    }

    const merchantId = user.id

    const [{ data: pickupOrders }, { data: orderRows }] = await Promise.all([
        supabase
            .from("orders")
            .select(`
                *,
                order_items!inner (
                    *,
                    products (
                        name
                    )
                ),
                rider:rider_id (
                    full_name,
                    phone
                )
            `)
            .eq("merchant_id", merchantId)
            .eq("status", "ready_for_pickup")
            .not("rider_id", "is", null)
            .order("updated_at", { ascending: false }),
        supabase
            .from("orders")
            .select(`
                id,
                status,
                created_at,
                rider_id,
                customer:customer_id (
                    full_name
                ),
                order_items (
                    quantity,
                    price_per_unit,
                    total_price,
                    products (
                        id,
                        name
                    )
                ),
                order_financials (
                    merchant_base_total_kobo,
                    settlement_status
                )
            `)
            .eq("merchant_id", merchantId)
            .order("created_at", { ascending: false }),
    ])

    const activePickupOrders = pickupOrders || []
    const orders = ((orderRows ?? []) as unknown as MerchantDashboardOrderRow[])
    const nonCancelledOrders = orders.filter((order) => order.status !== "cancelled")

    const totalOrders = orders.length
    const grossSalesKobo = nonCancelledOrders.reduce((sum, order) => sum + sumOrderGross(order), 0)
    const settledPayoutKobo = orders.reduce((sum, order) => {
        const financial = firstRelation(order.order_financials)
        if (!financial || financial.settlement_status !== "completed") {
            return sum
        }

        return sum + (financial.merchant_base_total_kobo ?? 0)
    }, 0)
    const pendingSettlementKobo = orders.reduce((sum, order) => {
        const financial = firstRelation(order.order_financials)
        if (!financial || financial.settlement_status === "completed") {
            return sum
        }

        return sum + (financial.merchant_base_total_kobo ?? 0)
    }, 0)

    const recentOrdersData = orders.slice(0, 5).map((order) => {
        const orderedProducts = order.order_items.map((item) => {
            const product = firstRelation(item.products ?? null)
            return `${product?.name ?? "Unknown Item"} x${item.quantity}`
        })

        const productSummary = orderedProducts.length > 2
            ? `${orderedProducts.slice(0, 2).join(", ")} +${orderedProducts.length - 2} more`
            : orderedProducts.join(", ")

        return {
            id: order.id,
            product: productSummary || "Unknown Item",
            qty: `x${order.order_items.reduce((sum, item) => sum + item.quantity, 0)}`,
            date: order.created_at ? new Date(order.created_at).toLocaleDateString() : "Unknown date",
            revenue: sumOrderGross(order),
            customer: firstRelation(order.customer)?.full_name ?? "Customer",
            status: order.status ?? "pending",
        }
    })

    const productSales = new Map<string, { name: string; price: number; sold: number; revenue: number }>()

    nonCancelledOrders.forEach((order) => {
        order.order_items.forEach((item) => {
            const product = firstRelation(item.products)
            const productId = product?.id ?? `unknown-${item.price_per_unit}`
            const productName = product?.name ?? "Unnamed product"
            const existing = productSales.get(productId) ?? {
                name: productName,
                price: item.price_per_unit ?? 0,
                sold: 0,
                revenue: 0,
            }

            existing.sold += item.quantity
            existing.revenue += item.total_price ?? item.price_per_unit * item.quantity

            productSales.set(productId, existing)
        })
    })

    const bestsellersData = Array.from(productSales.values())
        .sort((left, right) => right.sold - left.sold)
        .slice(0, 5)

    const totalTopUnits = bestsellersData.reduce((sum, product) => sum + product.sold, 0)
    const topProductsData = bestsellersData.map((product) => ({
        name: product.name,
        share: totalTopUnits > 0 ? Math.round((product.sold / totalTopUnits) * 100) : 0,
        units: product.sold,
    }))

    const currentYear = new Date().getFullYear()
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    const monthlyRevenue = new Array(12).fill(0)

    nonCancelledOrders.forEach((order) => {
        if (!order.created_at) {
            return
        }

        const date = new Date(order.created_at)
        if (date.getFullYear() !== currentYear) {
            return
        }

        monthlyRevenue[date.getMonth()] += sumOrderGross(order)
    })

    const chartData = monthNames.map((name, index) => ({
        name,
        revenue: monthlyRevenue[index],
    }))

    return (
        <div className="space-y-8">
            {activePickupOrders.length > 0 && (
                <VerifyRiderWidget orders={activePickupOrders} />
            )}

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                <StatsWidget
                    title="Gross Sales"
                    value={formatKobo(grossSalesKobo)}
                    trend="Sales"
                    isPositive={true}
                    color="#22c55e"
                    data={[0, Math.round(grossSalesKobo / 2), grossSalesKobo]}
                />
                <StatsWidget
                    title="Total Orders"
                    value={totalOrders.toString()}
                    trend="Orders"
                    isPositive={true}
                    color="#ef4444"
                    data={[0, Math.max(1, Math.round(totalOrders / 2)), totalOrders]}
                />
                <StatsWidget
                    title="Pending Settlement"
                    value={formatKobo(pendingSettlementKobo)}
                    trend="Awaiting"
                    isPositive={true}
                    color="#F59E0B"
                    data={[0, Math.round(pendingSettlementKobo / 2), pendingSettlementKobo]}
                />
                <StatsWidget
                    title="Settled Payouts"
                    value={formatKobo(settledPayoutKobo)}
                    trend="Settled"
                    isPositive={true}
                    color="#F58220"
                    data={[0, Math.round(settledPayoutKobo / 2), settledPayoutKobo]}
                />
            </div>

            <RevenueChart totalRevenue={grossSalesKobo} data={chartData} />

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                <BestsellersTable products={bestsellersData} />
                <TopProductsWidget products={topProductsData} />
            </div>

            <RecentOrdersTable orders={recentOrdersData} />

            <div className="text-center text-xs text-gray-400 py-8">
                RSS FOODS Platform @ 2026. All right reserved
            </div>
        </div>
    )
}
