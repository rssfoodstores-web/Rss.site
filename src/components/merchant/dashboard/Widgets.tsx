"use client"

import { cn } from "@/lib/utils"
import Link from "next/link"
import { formatKobo } from "@/lib/money"

interface BestsellerItem {
    name: string
    price: number
    sold: number
    revenue: number
}

export function BestsellersTable({ products }: { products: BestsellerItem[] }) {
    if (!products || products.length === 0) {
        return (
            <div className="bg-white dark:bg-zinc-900 p-6 lg:p-8 rounded-[24px] border border-gray-100 dark:border-zinc-800 shadow-sm h-full flex items-center justify-center text-gray-400">
                No sales data yet
            </div>
        )
    }

    return (
        <div className="bg-white dark:bg-zinc-900 p-6 lg:p-8 rounded-[24px] border border-gray-100 dark:border-zinc-800 shadow-sm h-full">
            <h3 className="text-xl font-bold mb-6 text-gray-900 dark:text-white">Bestsellers</h3>
            <div className="space-y-3 md:hidden">
                {products.map((product) => (
                    <div key={product.name} className="rounded-2xl border border-gray-100 p-4 dark:border-zinc-800">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-[#F58220] dark:bg-zinc-800">
                                    {product.name.substring(0, 2).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <p className="truncate font-bold text-gray-900 dark:text-white">{product.name}</p>
                                    <p className="text-sm text-gray-500">{formatKobo(product.price)}</p>
                                </div>
                            </div>
                            <p className="text-sm font-bold text-gray-900 dark:text-white">{formatKobo(product.revenue)}</p>
                        </div>
                        <p className="mt-3 text-sm text-gray-500">{product.sold} sold</p>
                    </div>
                ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
                <table className="w-full">
                    <thead>
                        <tr className="text-left text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-50 dark:border-zinc-800">
                            <th className="pb-4 pl-2">Product</th>
                            <th className="pb-4">Price</th>
                            <th className="pb-4">Sold</th>
                            <th className="pb-4">Revenue</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                        {products.map((product) => (
                            <tr key={product.name} className="group hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                                <td className="py-4 pl-2 flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-zinc-800 flex items-center justify-center text-[#F58220] font-bold text-xs">
                                        {product.name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <span className="font-bold text-sm text-gray-900 dark:text-white">{product.name}</span>
                                </td>
                                <td className="py-4 text-sm font-medium text-gray-500">{formatKobo(product.price)}</td>
                                <td className="py-4 text-sm font-medium text-gray-500">{product.sold}</td>
                                <td className="py-4 text-sm font-bold text-gray-900 dark:text-white">{formatKobo(product.revenue)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

interface TopProductItem {
    name: string
    share: number
    units: number
}

export function TopProductsWidget({ products }: { products: TopProductItem[] }) {
    if (!products || products.length === 0) {
        return (
            <div className="bg-white dark:bg-zinc-900 p-6 lg:p-8 rounded-[24px] border border-gray-100 dark:border-zinc-800 shadow-sm h-full flex items-center justify-center text-gray-400">
                No top products yet
            </div>
        )
    }

    return (
        <div className="bg-white dark:bg-zinc-900 p-6 lg:p-8 rounded-[24px] border border-gray-100 dark:border-zinc-800 shadow-sm h-full">
            <h3 className="text-xl font-bold mb-6 text-gray-900 dark:text-white">Top Products</h3>
            <div className="space-y-6">
                {products.map((product) => (
                    <div key={product.name}>
                        <div className="flex justify-between mb-2 text-sm font-medium">
                            <span className="text-gray-600 dark:text-gray-300">{product.name}</span>
                            <span className="text-gray-400">{product.share}% of units</span>
                        </div>
                        <div className="h-2 w-full bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-[#F58220] rounded-full"
                                style={{ width: `${product.share}%` }}
                            />
                        </div>
                        <p className="mt-2 text-xs text-gray-400">{product.units} unit{product.units === 1 ? "" : "s"} sold</p>
                    </div>
                ))}
            </div>
        </div>
    )
}

interface RecentOrder {
    id: string
    product: string
    qty: string
    date: string
    revenue: number
    customer: string
    status: string
}

export function RecentOrdersTable({ orders }: { orders: RecentOrder[] }) {
    if (!orders || orders.length === 0) return null

    return (
        <div className="bg-white dark:bg-zinc-900 p-6 lg:p-8 rounded-[24px] border border-gray-100 dark:border-zinc-800 shadow-sm">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Latest Orders</h3>
                <Link href="/merchant/orders" className="text-sm font-bold text-gray-400 hover:text-[#F58220]">More -&gt;</Link>
            </div>

            <div className="space-y-3 md:hidden">
                {orders.map((order) => (
                    <div key={order.id} className="rounded-2xl border border-gray-100 p-4 dark:border-zinc-800">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500 dark:bg-zinc-800">
                                    KG
                                </div>
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-gray-900 dark:text-white" title={order.product}>
                                        {order.product}
                                    </p>
                                    <p className="text-sm text-gray-500">{order.customer}</p>
                                </div>
                            </div>
                            <span className={cn(
                                "px-3 py-1 rounded-md text-xs font-bold uppercase",
                                order.status === "pending" ? "bg-yellow-100 text-yellow-600" :
                                    order.status === "delivered" || order.status === "completed" ? "bg-green-100 text-green-600" :
                                        order.status === "cancelled" ? "bg-red-100 text-red-600" :
                                            "bg-blue-100 text-blue-600"
                            )}>
                                {order.status}
                            </span>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <div>
                                <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Quantity</p>
                                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{order.qty}</p>
                            </div>
                            <div>
                                <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Date</p>
                                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{order.date}</p>
                            </div>
                            <div>
                                <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Revenue</p>
                                <p className="mt-1 text-sm font-bold text-gray-900 dark:text-white">{formatKobo(order.revenue)}</p>
                            </div>
                        </div>
                        <div className="mt-4 flex justify-end">
                            <Link href={`/merchant/orders/${order.id}`} className="text-sm font-bold text-gray-400 hover:text-[#F58220]">
                                View
                            </Link>
                        </div>
                    </div>
                ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[800px]">
                    <thead>
                        <tr className="text-left text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-50 dark:border-zinc-800">
                            <th className="pb-4 pl-2">Products</th>
                            <th className="pb-4">QTY</th>
                            <th className="pb-4">Date</th>
                            <th className="pb-4">Revenue</th>
                            <th className="pb-4">Customer</th>
                            <th className="pb-4">Status</th>
                            <th className="pb-4 text-right pr-2">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                        {orders.map((order) => (
                            <tr key={order.id} className="group hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                                <td className="py-4 pl-2 flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-bold text-gray-500">
                                        KG
                                    </div>
                                    <span className="max-w-[260px] truncate font-medium text-sm text-gray-600 dark:text-gray-300" title={order.product}>
                                        {order.product}
                                    </span>
                                </td>
                                <td className="py-4 text-sm text-gray-500">{order.qty}</td>
                                <td className="py-4 text-sm text-gray-500">{order.date}</td>
                                <td className="py-4 text-sm font-bold text-gray-900 dark:text-white">{formatKobo(order.revenue)}</td>
                                <td className="py-4 text-sm text-gray-500">{order.customer}</td>
                                <td className="py-4">
                                    <span className={cn(
                                        "px-3 py-1 rounded-md text-xs font-bold uppercase",
                                        order.status === "pending" ? "bg-yellow-100 text-yellow-600" :
                                            order.status === "delivered" || order.status === "completed" ? "bg-green-100 text-green-600" :
                                                order.status === "cancelled" ? "bg-red-100 text-red-600" :
                                                    "bg-blue-100 text-blue-600"
                                    )}>
                                        {order.status}
                                    </span>
                                </td>
                                <td className="py-4 text-right pr-2">
                                    <Link href={`/merchant/orders/${order.id}`} className="text-gray-400 hover:text-[#F58220] font-bold text-sm">
                                        View
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
