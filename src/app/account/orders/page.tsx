import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { formatOrderStatus } from "@/lib/orders"
import { cn } from "@/lib/utils"
import { CustomerOrderWorkspace, type CustomerDelivery } from "./CustomerOrderWorkspace"

const pastStatuses = new Set(["completed", "delivered", "cancelled", "refunded", "returned_to_merchant"])
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
type OrderRow = { id: string; status: string | null }
type Group = { id: string; order_ids: string[] }
type Person = { full_name: string | null; phone: string | null; avatar_url: string | null }
type Relation<T> = T | T[] | null
type DeliveryRow = OrderRow & {
    total_amount: number; delivery_address_snapshot: { address_label?: string } | null
    agent: Relation<Person>; rider: Relation<Person>
    order_items: { quantity: number; products: Relation<{ name: string | null }> }[] | null
}
const first = <T,>(value: Relation<T>) => Array.isArray(value) ? value[0] ?? null : value

function statusLabel(rows: OrderRow[]) {
    const status = rows[0]?.status
    if (rows.every((row) => row.status === status)) return formatOrderStatus(status)
    const delivered = rows.filter((row) => ["completed", "delivered"].includes(row.status ?? "")).length
    if (delivered) return `${delivered} of ${rows.length} delivered`
    return rows.some((row) => row.status === "out_for_delivery") ? "Part of your order is on the way" : "Deliveries at different stages"
}

export default async function CustomerOrdersPage({ searchParams }: {
    searchParams: Promise<{ orderId?: string; order?: string }>
}) {
    const params = await searchParams
    const requested = params.orderId ?? params.order
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect("/login")

    const { data, error } = await supabase.from("orders").select("id,status")
        .eq("customer_id", user.id).order("created_at", { ascending: false }).order("id")
    const rows = (data ?? []) as OrderRow[]
    const selectedId = typeof requested === "string" && uuid.test(requested) ? requested.toLowerCase() : null
    const batches = Array.from({ length: Math.ceil(rows.length / 80) }, (_, index) =>
        rows.slice(index * 80, (index + 1) * 80).map(({ id }) => id))
    const groupResults = await Promise.all(batches.map((batch) => supabase.from("delivery_checkout_groups").select("id,order_ids")
        .eq("customer_id", user.id).overlaps("order_ids", batch)))
    const groups = groupResults.flatMap(({ data }) => (data ?? []) as Group[])
    const groupByOrder = new Map(groups.flatMap((group) => group.order_ids.map((id) => [id, group] as const)))
    const orders = new Map<string, { id: string; deliveryIds: string[]; rows: OrderRow[] }>()
    for (const row of rows) {
        const group = groupByOrder.get(row.id)
        const id = group?.id ?? row.id
        const current = orders.get(id)
        if (current) current.rows.push(row)
        else orders.set(id, { id, deliveryIds: group?.order_ids ?? [row.id], rows: [row] })
    }
    const entries = [...orders.values()]
    const active = entries.filter((entry) => entry.rows.some((row) => !pastStatuses.has(row.status ?? "")))
    const past = entries.filter((entry) => entry.rows.every((row) => pastStatuses.has(row.status ?? "")))
    const selected = selectedId ? entries.find((entry) => entry.id === selectedId || entry.deliveryIds.includes(selectedId)) : active[0] ?? past[0]
    const ids = selected?.deliveryIds ?? (selectedId ? [selectedId] : [])
    const [details, secrets] = ids.length ? await Promise.all([
        supabase.from("orders").select(`
            id,status,total_amount,delivery_address_snapshot,
            agent:assigned_agent_id(full_name,phone,avatar_url),rider:rider_id(full_name,phone,avatar_url),
            order_items(quantity,products(name))
        `).eq("customer_id", user.id).in("id", ids),
        supabase.from("order_delivery_secrets").select("order_id,delivery_code")
            .eq("customer_id", user.id).in("order_id", ids),
    ]) : [null, null]
    const detailById = new Map(((details?.data ?? []) as DeliveryRow[]).map((row) => [row.id, row]))
    const codeById = new Map((secrets?.data ?? []).map((row) => [row.order_id, row.delivery_code as string]))
    const deliveries = ids.flatMap((id): CustomerDelivery[] => {
        const row = detailById.get(id)
        if (!row) return []
        return [{
            id, status: row.status, total: row.total_amount, address: row.delivery_address_snapshot?.address_label ?? null,
            agent: first(row.agent), rider: first(row.rider), code: row.status === "out_for_delivery" ? codeById.get(id) ?? null : null,
            items: (row.order_items ?? []).map((item) => ({ quantity: item.quantity, name: first(item.products)?.name ?? "Item" })),
        }]
    })
    function queue(entries: typeof active) {
        return entries.map((entry) => <Link key={entry.id} scroll={false} href={`/account/orders?orderId=${entry.deliveryIds[0]}`}
            aria-current={entry.id === selected?.id ? "page" : undefined}
            className={cn("block min-w-0 rounded-xl border bg-card px-3 py-2 text-sm hover:border-orange-400",
                entry.id === selected?.id && "border-orange-400 bg-orange-50 dark:bg-orange-950/40")}>
            <strong>#{entry.deliveryIds[0].slice(0, 8).toUpperCase()}</strong>
            <span className="block text-muted-foreground">{statusLabel(entry.rows)}</span>
        </Link>)
    }

    return <div className="min-w-0 space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
        {(error || groupResults.some((result) => result.error)) && <p role="alert" className="rounded-xl border p-3 text-sm">Some orders couldn’t load. Refresh to try again.</p>}
        {entries.length === 0 && !ids.length && !error ? <div className="rounded-2xl border bg-card p-5">
            <p>No orders yet.</p><Link className="underline" href="/">Browse products</Link>
        </div> : <div className="grid min-w-0 gap-4 xl:grid-cols-[13rem_minmax(0,1fr)]">
            <nav aria-label="Choose an order" className="min-w-0 space-y-2">
                <h2 className="font-semibold">Active orders</h2>
                {active.length ? queue(active) : <p className="text-sm text-muted-foreground">No active orders.</p>}
                {past.length > 0 && <details key={selected?.id} open={past.some(({ id }) => id === selected?.id) || undefined}>
                    <summary className="cursor-pointer py-2 text-sm font-semibold">Past orders</summary>
                    <div className="space-y-2">{queue(past)}</div>
                </details>}
            </nav>
            {deliveries.length ? <CustomerOrderWorkspace key={deliveries[0].id} deliveries={deliveries} hasEmail={Boolean(user.email)}
                title={statusLabel(deliveries)} /> :
                <p className="rounded-xl border bg-card p-4" role="status">{details?.error ? "Order details couldn’t load. Try again." : "Choose an available order."}</p>}
        </div>}
    </div>
}
