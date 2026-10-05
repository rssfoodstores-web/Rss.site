"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { RiderRouteMap } from "@/components/rider/dashboard/RiderRouteMap"
import { parseCoordinates } from "@/lib/directions"
import { formatOrderStatus, getOrderStatusTone } from "@/lib/orders"

type TrackingOrder = {
    id: string
    status: string
    delivery_location: unknown
    rider_id: string | null
    rider: { id: string; full_name: string | null; location: unknown } | null
    merchant: { id: string; full_name: string | null; address: string | null; location: unknown } | null
}

export function AdminTrackingClient({ orders }: { orders: TrackingOrder[] }) {
    const [items, setItems] = useState(orders)
    const [selectedId, setSelectedId] = useState(orders[0]?.id ?? null)
    const supabase = useMemo(() => createClient(), [])

    useEffect(() => {
        const refresh = async () => {
            const riderIds = items.map((item) => item.rider_id).filter(Boolean) as string[]
            if (!riderIds.length) return
            const { data } = await supabase.from("profiles").select("id,location").in("id", riderIds)
            if (!data) return
            const locations = new Map((data as Array<{ id: string; location: unknown }>).map((row) => [row.id, row.location]))
            setItems((current) => current.map((item) => item.rider_id && locations.has(item.rider_id)
                ? { ...item, rider: item.rider ? { ...item.rider, location: locations.get(item.rider_id) } : item.rider }
                : item))
        }
        const timer = window.setInterval(() => void refresh(), 15000)
        void refresh()
        return () => window.clearInterval(timer)
    }, [items, supabase])

    const selected = items.find((item) => item.id === selectedId) ?? items[0]

    return (
        <main className="min-h-screen bg-gray-50 p-6 dark:bg-black">
            <div className="mx-auto max-w-7xl space-y-6">
                <div><h1 className="text-3xl font-bold">Live delivery tracking</h1><p className="text-gray-500">Monitor active riders and delivery destinations.</p></div>
                <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
                    <Card><CardHeader><CardTitle>Active deliveries ({items.length})</CardTitle></CardHeader><CardContent className="space-y-2">
                        {items.map((item) => <button key={item.id} onClick={() => setSelectedId(item.id)} className={`w-full rounded-lg border p-3 text-left ${item.id === selected?.id ? "border-orange-500 bg-orange-50" : "border-gray-200"}`}><div className="font-semibold">#{item.id.slice(0, 8)}</div><Badge className={`mt-2 border ${getOrderStatusTone(item.status)}`}>{formatOrderStatus(item.status)}</Badge><div className="mt-2 text-xs text-gray-500">{item.rider?.full_name ?? "Rider"}</div></button>)}
                        {!items.length && <p className="text-sm text-gray-500">No active rider deliveries.</p>}
                    </CardContent></Card>
                    <Card><CardHeader><CardTitle>{selected ? `Order #${selected.id.slice(0, 8)}` : "No delivery selected"}</CardTitle></CardHeader><CardContent>{selected ? <RiderRouteMap riderLocation={parseCoordinates(selected.rider?.location)} pickupLocation={parseCoordinates(selected.merchant?.location)} dropoffLocation={parseCoordinates(selected.delivery_location)} pickupLabel={selected.merchant?.full_name ?? "Merchant"} dropoffLabel="Customer" activeStop={selected.status === "ready_for_pickup" ? "pickup" : "dropoff"} /> : <p className="text-sm text-gray-500">Active deliveries will appear here.</p>}</CardContent></Card>
                </div>
            </div>
        </main>
    )
}

