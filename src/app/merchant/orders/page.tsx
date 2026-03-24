import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { AlertCircle } from "lucide-react"
import { MerchantOrderList } from "./MerchantOrderList"
import { formatKobo } from "@/lib/money"

interface MerchantOrderRow {
    id: string
    total_amount: number
    status: string
    created_at: string | null
    rider_id: string | null
    order_items: { quantity: number }[]
    customer: { full_name: string | null }[] | null
}

export default async function MerchantOrdersPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect("/login")
    }

    const { data, error } = await supabase
        .from("orders")
        .select(`
            id,
            total_amount,
            status,
            created_at,
            rider_id,
            order_items (
                quantity
            ),
            customer:customer_id (
                full_name
            )
        `)
        .eq("merchant_id", user.id)
        .order("created_at", { ascending: false })

    const orders = ((data ?? []) as unknown as MerchantOrderRow[]).map((order) => ({
        id: order.id,
        customer: order.customer?.[0]?.full_name ?? "Customer",
        date: order.created_at ? new Date(order.created_at).toLocaleDateString() : "Pending",
        total: formatKobo(order.total_amount),
        items: order.order_items.reduce((sum, item) => sum + item.quantity, 0),
        status: order.status,
        rider_id: order.rider_id ?? undefined,
    }))

    return (
        <div className="space-y-8">
            <div>
                <h1 className="mb-2 text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl">Orders</h1>
                <p className="text-gray-500 font-medium">Track and manage your incoming customer orders.</p>
            </div>

            {error ? (
                <div className="p-12 text-center text-red-500 bg-white dark:bg-zinc-900 rounded-3xl border border-dashed border-red-200">
                    <AlertCircle className="h-12 w-12 mx-auto mb-4" />
                    <h3 className="text-lg font-bold mb-2">Error Loading Orders</h3>
                    <p>{error.message}</p>
                </div>
            ) : (
                <MerchantOrderList orders={orders} merchantId={user.id} />
            )}
        </div>
    )
}
