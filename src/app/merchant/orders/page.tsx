import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { MerchantOrdersWorkspace, type MerchantOrderDetail, type MerchantOrderSummary, type MerchantOrdersView } from "@/components/merchant/MerchantOrdersWorkspace"
import type { OrderChatThread } from "@/lib/orderChat"

const orderIdPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
const confirmationStatus = "awaiting_merchant_confirmation"
const pastStatuses = ["completed", "delivered", "cancelled", "refunded", "returned_to_merchant"]
const pageSize = 12
type OrderGroup = "priority" | "ongoing" | "past"

const detailColumns = `
    id, status, payment_status, created_at, rider_id, assigned_agent_id, total_amount,
    delivery_location, delivery_address_snapshot,
    order_items (id, quantity, price_per_unit, products(name)),
    customer:customer_id (full_name, phone),
    agent:assigned_agent_id (full_name, phone),
    rider:rider_id (full_name, phone)
`

export default async function MerchantOrdersPage({ searchParams }: {
    searchParams: Promise<{ order?: string; view?: string; page?: string }>
}) {
    const { order, view, page } = await searchParams
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect("/login")
    const merchantId = user.id

    const requestedOrder = typeof order === "string" && orderIdPattern.test(order) ? order.toLowerCase() : null
    const detailQuery = (id: string) => supabase.from("orders").select(detailColumns)
        .eq("merchant_id", merchantId).eq("id", id).maybeSingle()
    const requestedDetail = requestedOrder ? Promise.resolve(detailQuery(requestedOrder)) : null
    const orderStatus = view === "active" || view === "past" ? null : (await requestedDetail)?.data?.status
    const activeView: MerchantOrdersView = view === "past" || (view !== "active" && orderStatus && pastStatuses.includes(orderStatus)) ? "past" : "active"
    const requestedPage = typeof page === "string" && /^\d{1,6}$/.test(page) ? Math.max(1, Number(page)) : 1
    const groups: OrderGroup[] = activeView === "past" ? ["past"] : ["priority", "ongoing"]
    function listQuery(group: OrderGroup, head = false) {
        const query = supabase.from("orders").select("id,status,rider_id", { count: "exact", head })
            .eq("merchant_id", merchantId)
        if (group === "past") return query.in("status", pastStatuses)
        if (group === "priority") return query.eq("status", confirmationStatus)
        return query.not("status", "in", `(${pastStatuses.join(",")})`).neq("status", confirmationStatus)
    }
    const listRows = (group: OrderGroup, from: number, to: number) => listQuery(group)
        .order("created_at", { ascending: false, nullsFirst: false }).order("id").range(from, to)
    const counts = await Promise.all(groups.map((group) => requestedPage === 1
        ? listRows(group, 0, pageSize - 1) : listQuery(group, true)))
    const total = counts.reduce((sum, result) => sum + (result.count ?? 0), 0)
    const pageCount = Math.max(1, Math.ceil(total / pageSize))
    const pageNumber = Math.min(requestedPage, pageCount)
    let skip = (pageNumber - 1) * pageSize
    let remaining = pageSize
    const ranges = requestedPage === 1 ? [] : groups.flatMap((group, index) => {
        const count = counts[index].count ?? 0
        const start = Math.min(skip, count)
        const take = Math.min(remaining, count - start)
        skip -= start
        remaining -= take
        return take > 0 ? [listRows(group, start, start + take - 1)] : []
    })
    const results = requestedPage === 1 ? counts : await Promise.all(ranges)
    const orders = results.flatMap((result) => (result.data ?? []) as MerchantOrderSummary[]).slice(0, pageSize)
    const listError = [...counts, ...results].some((result) => result.error && result.error.code !== "PGRST103")

    const visibleIds = Array.from(new Set([...orders.map(({ id }) => id), ...(requestedOrder ? [requestedOrder] : [])]))
    const [selectedResult, threadResult] = await Promise.all([
        order ? requestedDetail : orders[0] ? detailQuery(orders[0].id) : null,
        visibleIds.length ? supabase.rpc("list_order_chat_threads").eq("merchant_id", merchantId).in("order_id", visibleIds) : null,
    ])
    const selected = (selectedResult?.data ?? null) as MerchantOrderDetail | null
    const unread: Record<string, { ops: number; customer: number }> = {}
    for (const thread of (threadResult?.data ?? []) as Pick<OrderChatThread, "order_id" | "ops_unread_count" | "customer_unread_count">[]) {
        unread[thread.order_id] = { ops: Number(thread.ops_unread_count) || 0, customer: Number(thread.customer_unread_count) || 0 }
    }

    return <MerchantOrdersWorkspace orders={orders} selected={selected} unread={unread}
        view={activeView} page={pageNumber} pageCount={pageCount} total={total}
        listError={listError} selectionError={Boolean(selectedResult?.error)}
        selectionMissing={Boolean(order && !selected && !selectedResult?.error)} />
}
