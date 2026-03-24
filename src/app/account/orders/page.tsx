import Link from "next/link"
import { ProfileSidebar } from "@/components/account/ProfileSidebar"
import { ChevronLeft, ChevronRight, Package, AlertCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { formatKobo } from "@/lib/money"
import { formatOrderStatus, getOrderStatusTone } from "@/lib/orders"

interface OrderHistoryRow {
    id: string
    total_amount: number
    status: string
    created_at: string | null
    order_items: { id: string; quantity: number }[]
}

function formatOrderDate(date: string | null) {
    return date ? new Date(date).toLocaleDateString() : "-"
}

export default async function OrderHistoryPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect("/login")
    }

    // Fetch Orders
    const { data: ordersData, error } = await supabase
        .from("orders")
        .select(`
            id,
            total_amount,
            status,
            created_at,
            order_items (
                id,
                quantity
            )
        `)
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false })

    if (error) {
        console.error("Error fetching orders:", error)
    }

    const orders = (ordersData ?? []) as OrderHistoryRow[]

    return (
        <div className="min-h-screen bg-gray-50/50 py-6 dark:bg-black sm:py-8 lg:py-12">
            <div className="container mx-auto px-4 sm:px-6">
                <div className="mb-6 sm:mb-8">
                    <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">Order History</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 sm:text-base">View and manage your past orders.</p>
                </div>

                <div className="flex flex-col gap-5 sm:gap-6 lg:flex-row lg:gap-8">
                    <aside className="w-full lg:w-80 flex-shrink-0">
                        <ProfileSidebar />
                    </aside>
                    <main className="min-w-0 flex-1">
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden shadow-sm">
                            {error ? (
                                <div className="p-8 text-center text-red-500 sm:p-12">
                                    <AlertCircle className="h-12 w-12 mx-auto mb-4" />
                                    <h3 className="text-lg font-bold mb-2">Error Loading Orders</h3>
                                    <p>{error.message}</p>
                                </div>
                            ) : (!orders || orders.length === 0) ? (
                                <div className="p-8 text-center sm:p-12">
                                    <div className="h-16 w-16 bg-gray-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                                        <Package className="h-8 w-8" />
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No orders yet</h3>
                                    <p className="text-gray-500 mb-6">Start shopping to see your orders here.</p>
                                    <Link href="/" className="inline-flex h-10 items-center justify-center rounded-lg bg-[#F58220] px-8 text-sm font-medium text-white shadow transition-colors hover:bg-[#F58220]/90">
                                        Browse Products
                                    </Link>
                                </div>
                            ) : (
                                <>
                                    <div className="divide-y divide-gray-100 dark:divide-zinc-800 md:hidden">
                                        {orders.map((order) => (
                                            <div key={order.id} className="space-y-4 p-4 sm:p-5">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Order ID</p>
                                                        <p className="mt-1 font-mono text-sm font-bold text-gray-900 dark:text-white">
                                                            #{order.id.slice(0, 8)}
                                                        </p>
                                                    </div>
                                                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${getOrderStatusTone(order.status)}`}>
                                                        {formatOrderStatus(order.status)}
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-2 gap-3 rounded-2xl bg-gray-50 p-3 dark:bg-zinc-800/60">
                                                    <div>
                                                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">Date</p>
                                                        <p className="mt-1 text-sm font-medium text-gray-700 dark:text-zinc-200">
                                                            {formatOrderDate(order.created_at)}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">Items</p>
                                                        <p className="mt-1 text-sm font-medium text-gray-700 dark:text-zinc-200">
                                                            {order.order_items.length}
                                                        </p>
                                                    </div>
                                                    <div className="col-span-2">
                                                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">Total</p>
                                                        <p className="mt-1 text-base font-bold text-gray-900 dark:text-white">
                                                            {formatKobo(order.total_amount)}
                                                        </p>
                                                    </div>
                                                </div>

                                                <Link
                                                    href={`/account/orders/${order.id}`}
                                                    className="inline-flex w-full items-center justify-center rounded-xl bg-orange-50 px-4 py-3 text-sm font-bold text-[#F58220] transition-colors hover:bg-orange-100 dark:bg-orange-950/20 dark:hover:bg-orange-950/30"
                                                >
                                                    View details
                                                    <ChevronRight className="ml-1 h-4 w-4" />
                                                </Link>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="hidden overflow-x-auto md:block">
                                        <table className="min-w-[600px] w-full border-collapse text-left">
                                            <thead>
                                                <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-zinc-800 dark:bg-zinc-800/50">
                                                    <th className="p-4 md:p-6">Order ID</th>
                                                    <th className="p-4 md:p-6">Date</th>
                                                    <th className="p-4 md:p-6">Total</th>
                                                    <th className="p-4 md:p-6">Status</th>
                                                    <th className="p-4 md:p-6"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                                {orders.map((order) => (
                                                    <tr key={order.id} className="group text-sm transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800/50 md:text-base">
                                                        <td className="p-4 font-mono text-xs font-medium text-gray-900 dark:text-white md:p-6 md:text-sm">
                                                            #{order.id.slice(0, 8)}
                                                        </td>
                                                        <td className="p-4 text-gray-500 dark:text-gray-400 md:p-6">
                                                            {formatOrderDate(order.created_at)}
                                                        </td>
                                                        <td className="p-4 font-medium text-gray-900 dark:text-white md:p-6">
                                                            {formatKobo(order.total_amount)} <span className="font-normal text-gray-400">({order.order_items.length} Items)</span>
                                                        </td>
                                                        <td className="p-4 md:p-6">
                                                            <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${getOrderStatusTone(order.status)}`}>
                                                                {formatOrderStatus(order.status)}
                                                            </span>
                                                        </td>
                                                        <td className="p-4 text-right md:p-6">
                                                            <Link href={`/account/orders/${order.id}`} className="inline-flex items-center rounded-lg bg-orange-50 px-4 py-2 text-sm font-bold text-[#F58220] transition-colors hover:bg-orange-100 dark:bg-orange-950/20 dark:hover:bg-orange-950/30">
                                                                Details
                                                                <ChevronRight className="ml-1 h-4 w-4" />
                                                            </Link>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}
                            {/* Pagination (Client side logic needed for real pagination, keeping simpler for now) */}
                            {orders && orders.length > 10 && (
                                <div className="flex items-center justify-center gap-2 border-t border-gray-100 p-4 dark:border-zinc-800 sm:p-6">
                                    <button disabled className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-300 transition-colors disabled:opacity-50 dark:bg-zinc-800">
                                        <ChevronLeft className="h-5 w-5" />
                                    </button>
                                    <button className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F58220] font-bold text-white shadow-sm">
                                        1
                                    </button>
                                    <button disabled className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-300 transition-colors dark:bg-zinc-800">
                                        <ChevronRight className="h-5 w-5" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </main>
                </div>
            </div>
        </div>
    )
}
