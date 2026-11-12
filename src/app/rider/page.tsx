import { redirect } from "next/navigation"
import { RiderMissionControl } from "@/components/rider/dashboard/RiderMissionControl"
import { parseCoordinates } from "@/lib/directions"
import type { RiderDelivery } from "@/lib/riderDeliveries"
import { createClient } from "@/lib/supabase/server"

const activeStatuses = ["ready_for_pickup", "out_for_delivery", "return_in_transit", "delivery_failed", "rescheduled"]
const completedStatuses = ["completed", "delivered"]
type Relation<T> = T | T[] | null
type Person = { full_name: string | null; phone: string | null }

interface AssignedOrder {
    id: string
    merchant_id: string | null
    status: string | null
    pickup_code: string | null
    delivery_location: unknown
    delivery_address_snapshot: { address_label?: string } | null
    contact_numbers: unknown
    customer: Relation<Person>
    agent: Relation<Person>
    order_financials: Relation<{ rider_share_kobo: number }>
    order_items: { id: string; quantity: number; products: Relation<{ name: string | null }> }[] | null
}

function first<T>(value: Relation<T>) {
    return Array.isArray(value) ? value[0] ?? null : value
}

export default async function RiderDashboard() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect("/login")
    const riderId = user.id
    const lagosDate = new Intl.DateTimeFormat("sv-SE", { timeZone: "Africa/Lagos" }).format(new Date())
    const today = new Date(`${lagosDate}T00:00:00+01:00`).toISOString()

    const [assigned, recent, trips, wallet] = await Promise.all([
        supabase.from("orders").select(`
            id,merchant_id,status,pickup_code,delivery_location,delivery_address_snapshot,contact_numbers,
            customer:customer_id(full_name,phone),agent:assigned_agent_id(full_name,phone),
            order_financials(rider_share_kobo),order_items(id,quantity,products(name))
        `).eq("rider_id", riderId).in("status", activeStatuses)
            .order("rider_assigned_at", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }),
        supabase.from("orders").select("id,merchant_id,created_at,delivery_verified_at,order_financials(rider_share_kobo)")
            .eq("rider_id", riderId).in("status", completedStatuses)
            .order("delivery_verified_at", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }).limit(8),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("rider_id", riderId)
            .in("status", completedStatuses).gte("delivery_verified_at", today),
        supabase.from("wallets").select("id,balance").eq("owner_id", riderId).eq("type", "rider").maybeSingle(),
    ])
    const orders = (assigned.data ?? []) as AssignedOrder[]
    const recentOrders = recent.data ?? []
    const merchantIds = Array.from(new Set([...orders, ...recentOrders].map((order) => order.merchant_id)
        .filter((id): id is string => typeof id === "string")))
    const [merchants, profiles, earnings] = await Promise.all([
        merchantIds.length ? supabase.from("merchants").select("id,store_name,business_address,phone,location").in("id", merchantIds) : null,
        merchantIds.length ? supabase.from("profiles").select("id,full_name,address,phone,location").in("id", merchantIds) : null,
        wallet.data ? supabase.from("ledger_entries").select("amount").eq("wallet_id", wallet.data.id)
            .eq("description", "Rider payout for order").gte("created_at", today).gt("amount", 0) : null,
    ])
    const shops = new Map((merchants?.data ?? []).map((row) => [row.id, row]))
    const people = new Map((profiles?.data ?? []).map((row) => [row.id, row]))
    function pickup(id: string | null): RiderDelivery["pickup"] {
        const shop = id ? shops.get(id) : undefined
        const person = id ? people.get(id) : undefined
        return {
            name: shop?.store_name || person?.full_name || "Merchant",
            address: shop?.business_address || person?.address || null,
            phone: shop?.phone || person?.phone || null,
            coordinates: parseCoordinates(shop?.location) ?? parseCoordinates(person?.location),
        }
    }
    const deliveries: RiderDelivery[] = orders.map((order) => {
        const customer = first(order.customer)
        const agent = first(order.agent)
        const phones = Array.isArray(order.contact_numbers)
            ? [...new Set(order.contact_numbers.filter((number): number is string => typeof number === "string" && Boolean(number.trim())).map((number) => number.trim()))]
            : []
        return {
            id: order.id,
            status: order.status,
            pickupCode: order.status === "ready_for_pickup" ? order.pickup_code : null,
            pickup: pickup(order.merchant_id),
            dropoff: { name: customer?.full_name || "Customer", phone: phones[0] ?? customer?.phone ?? null,
                address: order.delivery_address_snapshot?.address_label || null, coordinates: parseCoordinates(order.delivery_location) },
            backupPhones: phones.slice(1),
            agent: agent ? { name: agent.full_name || "Coordinating agent", phone: agent.phone } : null,
            payout: first(order.order_financials)?.rider_share_kobo ?? null,
            items: (order.order_items ?? []).map((item) => ({
                id: item.id, name: first(item.products)?.name || "Item", quantity: item.quantity,
            })),
        }
    })
    const history = recentOrders.map((order) => ({
        id: order.id,
        merchantName: pickup(order.merchant_id).name,
        payout: first(order.order_financials)?.rider_share_kobo ?? null,
        date: order.delivery_verified_at ?? order.created_at,
    }))

    return <RiderMissionControl riderId={riderId} deliveries={deliveries} history={history}
        assignmentsUnavailable={Boolean(assigned.error)} historyUnavailable={Boolean(recent.error)}
        trips={trips.count} balance={wallet.error ? null : wallet.data?.balance ?? 0}
        earnings={wallet.error || earnings?.error ? null : (earnings?.data ?? []).reduce((sum, entry) => sum + Number(entry.amount), 0)} />
}
