"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MapPin, Navigation, Package, Clock, ShoppingBag, AlertTriangle } from "lucide-react"
import { acceptOrder, getNearbyOrders } from "@/app/actions/riderActions"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { formatKobo } from "@/lib/money"

interface NearbyDelivery {
    id: string
    total_amount: number | null
    merchant_name: string | null
    merchant_address: string | null
    created_at: string
}

export default function RiderDeliveriesPage() {
    const [orders, setOrders] = useState<NearbyDelivery[]>([])
    const [loading, setLoading] = useState(true)
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
    const [accepting, setAccepting] = useState<string | null>(null)
    const [hasActiveMission, setHasActiveMission] = useState(false)
    const [locationError, setLocationError] = useState<string | null>(null)
    const [userId, setUserId] = useState<string | null>(null)
    const router = useRouter()
    const [supabase] = useState(() => createClient())
    const refreshTimeoutRef = useRef<number | null>(null)

    const checkActiveMission = useCallback(async (targetUserId?: string | null) => {
        const nextUserId = targetUserId ?? userId

        if (!nextUserId) {
            setHasActiveMission(false)
            return
        }

        const { data } = await supabase
            .from("orders")
            .select("id")
            .eq("rider_id", nextUserId)
            .in("status", ["ready_for_pickup", "out_for_delivery"])
            .limit(1)

        setHasActiveMission((data?.length ?? 0) > 0)
    }, [supabase, userId])

    useEffect(() => {
        let cancelled = false

        const initUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()

            if (!cancelled) {
                setUserId(user?.id ?? null)
                await checkActiveMission(user?.id ?? null)
            }
        }

        void initUser()

        return () => {
            cancelled = true
        }
    }, [checkActiveMission, supabase])

    const loadOrders = useCallback(async (lat: number, lng: number) => {
        setLoading(true)
        try {
            const data = await getNearbyOrders(lat, lng) as NearbyDelivery[] | []
            setOrders(data)
        } catch (error) {
            console.error("Load Orders Exception:", error)
            toast.error("Failed to load orders")
        } finally {
            setLoading(false)
        }
    }, [])

    const requestLocation = useCallback(() => {
        if (!("geolocation" in navigator)) {
            setLocation(null)
            setOrders([])
            setLocationError("Location access is required to show nearby deliveries.")
            setLoading(false)
            toast.warning("Geolocation is not supported on this device.")
            return
        }

        setLoading(true)
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords
                const nextLocation = { lat: latitude, lng: longitude }
                setLocation(nextLocation)
                setLocationError(null)
                await loadOrders(nextLocation.lat, nextLocation.lng)
            },
            () => {
                setLocation(null)
                setOrders([])
                setLocationError("Enable location access to see deliveries near you.")
                setLoading(false)
                toast.warning("Location is unavailable. Turn location back on to load nearby deliveries.")
            },
            { enableHighAccuracy: false, maximumAge: 60000, timeout: 15000 }
        )
    }, [loadOrders])

    useEffect(() => {
        requestLocation()
    }, [requestLocation])

    useEffect(() => {
        if (!userId) {
            return
        }

        const refreshQueue = () => {
            if (refreshTimeoutRef.current !== null) {
                window.clearTimeout(refreshTimeoutRef.current)
            }

            refreshTimeoutRef.current = window.setTimeout(() => {
                refreshTimeoutRef.current = null
                void checkActiveMission(userId)

                if (location) {
                    void loadOrders(location.lat, location.lng)
                }
            }, 200)
        }

        const channel = supabase
            .channel(`rider-deliveries-${userId}`)
            .on("postgres_changes", {
                event: "*",
                schema: "public",
                table: "orders",
                filter: `rider_id=eq.${userId}`,
            }, refreshQueue)
            .on("postgres_changes", {
                event: "*",
                schema: "public",
                table: "orders",
                filter: "status=eq.ready_for_pickup",
            }, refreshQueue)
            .subscribe()

        return () => {
            if (refreshTimeoutRef.current !== null) {
                window.clearTimeout(refreshTimeoutRef.current)
            }

            supabase.removeChannel(channel)
        }
    }, [checkActiveMission, loadOrders, location, supabase, userId])

    const handleAccept = async (orderId: string) => {
        setAccepting(orderId)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                toast.error("You must be logged in")
                return
            }

            const result = await acceptOrder(orderId, user.id)
            if (result.success) {
                toast.success("Order accepted. Head to the merchant.")
                setOrders((prev) => prev.filter((order) => order.id !== orderId))
                setHasActiveMission(true)
                router.push("/rider")
            } else {
                toast.error(result.message || "Failed to accept order")
            }
        } catch {
            toast.error("Something went wrong")
        } finally {
            setAccepting(null)
        }
    }

    if (loading) {
        return (
            <div className="flex min-h-[50vh] flex-col items-center justify-center text-gray-500">
                <Navigation className="mb-4 h-10 w-10 animate-bounce text-[#F58220]" />
                <p>Loading nearby deliveries...</p>
            </div>
        )
    }

    return (
        <div className="mx-auto max-w-4xl space-y-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-bold">
                        <ShoppingBag className="h-6 w-6 text-[#F58220]" />
                        Available Deliveries
                    </h1>
                    <p className="text-sm text-muted-foreground">Accept one delivery at a time from this queue.</p>
                </div>

                <div className="flex items-center gap-3">
                    <Badge variant="outline" className="gap-1">
                        <MapPin className="h-3 w-3" />
                        {location ? "Within 5km" : "Location required"}
                    </Badge>
                </div>
            </div>

            {hasActiveMission && (
                <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/10">
                    <CardContent className="flex items-start gap-3 p-4 text-sm text-amber-800 dark:text-amber-200">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                        <div className="space-y-3">
                            <p>You already have an active mission. Complete it before accepting another delivery.</p>
                            <Button size="sm" className="bg-[#F58220] text-white hover:bg-[#E57210]" onClick={() => router.push("/rider")}>
                                Open active mission
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {locationError && (
                <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/10">
                    <CardContent className="flex items-start gap-3 p-4 text-sm text-orange-800 dark:text-orange-200">
                        <MapPin className="mt-0.5 h-5 w-5 shrink-0" />
                        <div className="space-y-3">
                            <p>{locationError}</p>
                            <Button size="sm" variant="outline" onClick={requestLocation}>
                                Retry location
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {orders.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <Package className="mb-4 h-12 w-12 text-gray-300" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">No orders found</h3>
                        <p className="mt-1 max-w-sm text-gray-500">
                            {locationError
                                ? "Turn location access back on to load nearby deliveries."
                                : "There are no orders ready for pickup near you right now."}
                        </p>
                        <Button
                            variant="outline"
                            className="mt-4"
                            onClick={() => {
                                if (location) {
                                    void loadOrders(location.lat, location.lng)
                                    return
                                }

                                requestLocation()
                            }}
                        >
                            Refresh
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 xl:grid-cols-2">
                    {orders.map((order, index) => (
                        <Card key={order.id} className="border-orange-100 shadow-sm">
                            <CardHeader className="space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Badge className="bg-[#F58220] text-white hover:bg-[#E57210]">
                                                {index === 0 ? "Latest request" : `Queue #${index + 1}`}
                                            </Badge>
                                            <Badge variant="outline" className="border-orange-200 text-orange-700">
                                                Order #{String(order.id).slice(0, 8)}
                                            </Badge>
                                        </div>
                                        <CardTitle className="text-2xl font-bold text-[#F58220]">
                                            {formatKobo(order.total_amount ?? 0)}
                                        </CardTitle>
                                        <p className="mt-1 text-sm font-medium text-gray-500">
                                            {order.merchant_name}
                                        </p>
                                    </div>
                                    <Badge className="border-green-200 bg-green-100 text-green-700 hover:bg-green-100">
                                        Ready for pickup
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="rounded-2xl bg-muted/40 p-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Pickup</p>
                                    <p className="mt-2 text-sm text-foreground">{order.merchant_address}</p>
                                </div>

                                <div className="rounded-2xl bg-muted/40 p-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Dropoff</p>
                                    <p className="mt-2 text-sm text-muted-foreground">Customer location is shared after claim.</p>
                                </div>

                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Clock className="h-4 w-4" />
                                    <span>
                                        Placed {new Date(order.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                </div>

                                <Button
                                    className="h-11 w-full bg-[#F58220] font-semibold text-white hover:bg-[#E57210]"
                                    onClick={() => handleAccept(order.id)}
                                    disabled={accepting === order.id || hasActiveMission}
                                >
                                    {accepting === order.id ? "Accepting..." : "Accept delivery"}
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
