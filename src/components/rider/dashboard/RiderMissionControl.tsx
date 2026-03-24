"use client"

import { startTransition, useEffect, useMemo, useRef, useState } from "react"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { MissionCard } from "@/components/rider/dashboard/MissionCard"
import { ActiveOrderView } from "@/components/rider/dashboard/ActiveOrderView"
import type { Database } from "@/types/database.types"
import { saveFCMToken, updateRiderLocation, getNearbyOrders } from "@/app/actions/riderActions"
import { toast } from "sonner"
import { Bell, BellOff, MapPin, Package, Wallet, AlertTriangle, Clock3 } from "lucide-react"
import { getToken } from "firebase/messaging"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { messaging } from "@/lib/firebase/config"
import { formatKobo } from "@/lib/money"
import { formatOrderStatus, getOrderStatusTone } from "@/lib/orders"

type Order = Database["public"]["Tables"]["orders"]["Row"] & {
    order_items: (Database["public"]["Tables"]["order_items"]["Row"] & {
        products: Database["public"]["Tables"]["products"]["Row"] | null
    })[]
}

interface RecentCompletedOrder {
    id: string
    status: string | null
    total_amount: number
    payout_kobo: number
    created_at: string | null
    delivery_verified_at: string | null
    merchant_name: string
}

interface MerchantInfo {
    name: string
    address: string
    phone: string | null
    location?: unknown | null
}

interface NearbyOrderCard {
    id: string
    total_amount: number | null
    status: string | null
    created_at: string | null
    delivery_location: Database["public"]["Tables"]["orders"]["Row"]["delivery_location"]
    merchant_name: string
    merchant_address: string
}

interface NearbyOrderRpc {
    id: string
    total_amount: number | null
    status: string | null
    created_at: string | null
    delivery_location: Database["public"]["Tables"]["orders"]["Row"]["delivery_location"]
    merchant_name: string
    merchant_address: string
}

interface RiderMissionControlProps {
    riderId: string
    activeOrders: Order[]
    availableOrders: Order[]
    recentCompletedOrders: RecentCompletedOrder[]
    riderName: string
    riderAvatar?: string | null
    riderLocation?: string | null
    merchantByOrderId: Record<string, MerchantInfo | null>
    stats: {
        balance: number
        earnings: number
        trips: number
        hours: number
    }
}

function formatDateLabel(value: string | null | undefined) {
    if (!value) {
        return "Pending"
    }

    return new Date(value).toLocaleString()
}

export function RiderMissionControl({
    riderId,
    activeOrders,
    availableOrders: initialOrders,
    recentCompletedOrders,
    riderName,
    riderAvatar,
    riderLocation: initialLocation,
    merchantByOrderId,
    stats,
}: RiderMissionControlProps) {
    const router = useRouter()
    const [supabase] = useState(() => createClient())
    const [isOnline, setIsOnline] = useState(true)
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
    const [nearbyOrders, setNearbyOrders] = useState<NearbyOrderCard[]>(() =>
        initialOrders.map((order) => ({
            id: order.id,
            total_amount: order.total_amount,
            status: order.status ? String(order.status) : null,
            created_at: order.created_at,
            delivery_location: order.delivery_location,
            merchant_name: merchantByOrderId[order.id]?.name ?? "Merchant pickup",
            merchant_address: merchantByOrderId[order.id]?.address ?? "Store address unavailable",
        }))
    )
    const [notificationsEnabled, setNotificationsEnabled] = useState(
        typeof Notification !== "undefined" && Notification.permission === "granted"
    )
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(activeOrders[0]?.id ?? null)
    const hasShownLocationFallback = useRef(false)

    useEffect(() => {
        const channel = supabase
            .channel(`rider-active-order-${riderId}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "orders",
                    filter: `rider_id=eq.${riderId}`,
                },
                () => {
                    startTransition(() => {
                        router.refresh()
                    })
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [riderId, router, supabase])

    const enableNotifications = async () => {
        try {
            if (!messaging) {
                toast.error("Notifications not configured")
                return
            }

            if (typeof Notification === "undefined") {
                toast.error("Notifications are not supported on this device")
                return
            }

            const permission = await Notification.requestPermission()
            if (permission !== "granted") {
                toast.error("Permission denied")
                return
            }

            const token = await getToken(messaging, {
                vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
            })

            if (token) {
                await saveFCMToken(token)
                setNotificationsEnabled(true)
                toast.success("Notifications enabled")
            }
        } catch (error) {
            console.error("FCM Error:", error)
            toast.error("Failed to enable notifications")
        }
    }

    const hasActiveMission = activeOrders.length > 0

    useEffect(() => {
        if (!isOnline) {
            return
        }

        let watchId: number
        let active = true

        const handleLocationFailure = (message: string) => {
            if (!active) {
                return
            }

            setUserLocation(null)
            setNearbyOrders([])

            if (!hasShownLocationFallback.current) {
                toast.warning(message)
                hasShownLocationFallback.current = true
            }
        }

        if ("geolocation" in navigator) {
            watchId = navigator.geolocation.watchPosition(
                async (position) => {
                    if (!active) {
                        return
                    }

                    const { latitude, longitude } = position.coords
                    setUserLocation({ lat: latitude, lng: longitude })
                    hasShownLocationFallback.current = false
                    await updateRiderLocation(latitude, longitude)
                },
                (error) => {
                    const message = error.code === error.TIMEOUT
                        ? "Live GPS timed out. Nearby orders are paused until location comes back."
                        : "Location access failed. Nearby orders are paused until location comes back."

                    handleLocationFailure(message)
                },
                { enableHighAccuracy: false, maximumAge: 30000, timeout: 20000 }
            )
        } else {
            handleLocationFailure("Geolocation is not supported on this device.")
        }

        return () => {
            active = false
            if (watchId) {
                navigator.geolocation.clearWatch(watchId)
            }
        }
    }, [isOnline])

    useEffect(() => {
        if (!isOnline || !userLocation) {
            return
        }

        const fetchNearby = async () => {
            const orders = await getNearbyOrders(userLocation.lat, userLocation.lng) as NearbyOrderRpc[]

            const mappedOrders: NearbyOrderCard[] = orders.map((rpcOrder) => ({
                id: rpcOrder.id,
                total_amount: rpcOrder.total_amount,
                status: rpcOrder.status ? String(rpcOrder.status) : null,
                created_at: rpcOrder.created_at,
                delivery_location: rpcOrder.delivery_location,
                merchant_name: rpcOrder.merchant_name,
                merchant_address: rpcOrder.merchant_address,
            }))

            setNearbyOrders(mappedOrders)
        }

        void fetchNearby()

        const channel = supabase
            .channel("available-orders")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "orders",
                    filter: "status=eq.ready_for_pickup",
                },
                () => {
                    void fetchNearby()
                }
            )
            .subscribe()

        const interval = setInterval(() => {
            void fetchNearby()
        }, 30000)

        return () => {
            clearInterval(interval)
            supabase.removeChannel(channel)
        }
    }, [isOnline, supabase, userLocation])

    const selectedOrder = useMemo(
        () => activeOrders.find((order) => order.id === selectedOrderId) ?? activeOrders[0] ?? null,
        [activeOrders, selectedOrderId]
    )

    const selectedMerchant = selectedOrder ? merchantByOrderId[selectedOrder.id] ?? null : null
    const extraActiveAssignmentCount = Math.max(activeOrders.length - 1, 0)
    const blockedNearbyOrders = nearbyOrders.filter(
        (order) => !activeOrders.some((activeOrder) => activeOrder.id === order.id)
    )

    return (
        <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
            <Card className="border-orange-100 shadow-sm">
                <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-start gap-4 sm:items-center">
                        <div className="h-14 w-14 rounded-full bg-gradient-to-tr from-[#F58220] to-red-500 p-[2px]">
                            <img
                                src={riderAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${riderName}`}
                                alt="Avatar"
                                className="h-full w-full rounded-full bg-background object-cover"
                            />
                        </div>
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="text-xl font-bold text-foreground">{riderName}</h1>
                                <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100">
                                    Verified
                                </Badge>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {userLocation ? "Live GPS active" : (initialLocation || "Location not set")}
                            </p>
                        </div>
                    </div>

                    <div className="flex w-full flex-wrap items-center gap-3 md:w-auto md:justify-end">
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={enableNotifications}
                            className={notificationsEnabled ? "text-[#F58220]" : "text-muted-foreground"}
                        >
                            {notificationsEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                        </Button>
                        <div className="flex items-center gap-2 rounded-full border border-border px-3 py-2">
                            <span className={`text-xs font-semibold ${isOnline ? "text-green-600" : "text-gray-500"}`}>
                                {isOnline ? "Online" : "Offline"}
                            </span>
                            <Switch
                                checked={isOnline}
                                onCheckedChange={setIsOnline}
                                className="data-[state=checked]:bg-[#F58220]"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <Card className="border-orange-100">
                    <CardContent className="flex items-center gap-3 p-5">
                        <div className="rounded-2xl bg-orange-50 p-3 text-[#F58220]">
                            <Wallet className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Wallet balance</p>
                            <p className="text-2xl font-bold text-foreground">{formatKobo(stats.balance)}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-orange-100">
                    <CardContent className="flex items-center gap-3 p-5">
                        <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">
                            <Package className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Completed trips</p>
                            <p className="text-2xl font-bold text-foreground">{stats.trips}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-orange-100">
                    <CardContent className="flex items-center gap-3 p-5">
                        <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
                            <Wallet className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Today&apos;s earnings</p>
                            <p className="text-2xl font-bold text-foreground">{formatKobo(stats.earnings)}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {hasActiveMission ? (
                <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                    <section className="space-y-4">
                        <div>
                            <h2 className="text-2xl font-bold text-foreground">Active assignments</h2>
                            <p className="text-sm text-muted-foreground">
                                Select the exact order you are handling. Merchant handoff depends on the correct pickup code.
                            </p>
                        </div>

                        {extraActiveAssignmentCount > 0 && (
                            <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/10">
                                <CardContent className="flex gap-3 p-4 text-sm text-amber-800 dark:text-amber-200">
                                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                                    <div>
                                        This rider account still has {extraActiveAssignmentCount} additional open assignment{extraActiveAssignmentCount > 1 ? "s" : ""}.
                                        New rider requests will stay blocked until these pickup jobs are verified or an admin releases the stale assignments.
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {blockedNearbyOrders.length > 0 && (
                            <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/10">
                                <CardContent className="flex gap-3 p-4 text-sm text-blue-800 dark:text-blue-200">
                                    <Package className="mt-0.5 h-5 w-5 shrink-0" />
                                    <div className="space-y-2">
                                        <p>
                                            {blockedNearbyOrders.length} new delivery request{blockedNearbyOrders.length > 1 ? "s are" : " is"} waiting nearby,
                                            but this rider cannot claim another order yet.
                                        </p>
                                        <div className="space-y-1">
                                            {blockedNearbyOrders.slice(0, 3).map((order) => (
                                                <p key={order.id} className="font-medium">
                                                    Order #{String(order.id).slice(0, 8)} • {order.merchant_name ?? "Merchant pickup"}
                                                </p>
                                            ))}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        <div className="space-y-3">
                            {activeOrders.map((order) => {
                                const merchant = merchantByOrderId[order.id]
                                const isSelected = order.id === selectedOrder?.id

                                return (
                                    <button
                                        key={order.id}
                                        type="button"
                                        onClick={() => setSelectedOrderId(order.id)}
                                        className={`w-full rounded-2xl border p-4 text-left transition ${isSelected ? "border-[#F58220] bg-orange-50/70 shadow-sm" : "border-border bg-card hover:border-orange-200"}`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                                    Order #{order.id.slice(0, 8)}
                                                </p>
                                                <p className="mt-2 font-semibold text-foreground">{merchant?.name ?? "Merchant pickup"}</p>
                                            </div>
                                            <Badge className={`border ${getOrderStatusTone(String(order.status))}`}>
                                                {formatOrderStatus(String(order.status))}
                                            </Badge>
                                        </div>
                                        <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                                            <p>{merchant?.address ?? "Location hidden"}</p>
                                            <div className="flex items-center gap-2">
                                                <Clock3 className="h-4 w-4 text-[#F58220]" />
                                                <span>
                                                    Assigned {formatDateLabel(order.rider_assigned_at ?? order.created_at)}
                                                </span>
                                            </div>
                                            {String(order.status) === "ready_for_pickup" ? (
                                                <p className="font-mono text-lg font-bold tracking-[0.3em] text-[#F58220]">
                                                    {order.pickup_code}
                                                </p>
                                            ) : (
                                                <p className="text-sm font-medium text-emerald-600">
                                                    Ask customer for the delivery code at handoff.
                                                </p>
                                            )}
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </section>

                    <section className="space-y-4">
                        <div>
                            <h2 className="text-2xl font-bold text-foreground">Selected job</h2>
                            <p className="text-sm text-muted-foreground">
                                Confirm you are working on the same order number shown on the merchant screen before using the code.
                            </p>
                        </div>

                        {selectedOrder ? (
                            <ActiveOrderView order={selectedOrder} merchant={selectedMerchant} currentLocation={userLocation} />
                        ) : (
                            <Card className="border-dashed">
                                <CardContent className="p-10 text-center text-muted-foreground">
                                    No active order selected.
                                </CardContent>
                            </Card>
                        )}
                    </section>
                </div>
            ) : (
                <section className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-2xl font-bold text-foreground">Available deliveries</h2>
                            <p className="text-sm text-muted-foreground">
                                Accept one delivery at a time. New jobs appear here when they are near you.
                            </p>
                        </div>
                        <Badge variant="outline" className="gap-1">
                            <MapPin className="h-3 w-3" />
                            {userLocation ? "Location ready" : "Location required"}
                        </Badge>
                    </div>

                    {!isOnline ? (
                        <Card className="border-dashed">
                            <CardContent className="p-10 text-center text-muted-foreground">
                                Go online to receive nearby delivery requests.
                            </CardContent>
                        </Card>
                    ) : nearbyOrders.length > 0 ? (
                        <div className="grid gap-4 sm:grid-cols-2">
                            {nearbyOrders.map((order, index) => (
                                <MissionCard
                                    key={order.id}
                                    order={order}
                                    riderId={riderId}
                                    queueIndex={index}
                                    merchantName={order.merchant_name}
                                    merchantAddress={order.merchant_address}
                                />
                            ))}
                        </div>
                    ) : (
                        <Card className="border-dashed">
                            <CardContent className="p-10 text-center text-muted-foreground">
                                No delivery requests are near you right now.
                            </CardContent>
                        </Card>
                    )}
                </section>
            )}

            <section className="space-y-4">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Recent completed jobs</h2>
                    <p className="text-sm text-muted-foreground">Your latest finished deliveries and payouts.</p>
                </div>

                {recentCompletedOrders.length > 0 ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                        {recentCompletedOrders.map((order) => (
                            <Card key={order.id} className="border-orange-100">
                                <CardContent className="space-y-3 p-5">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                                Order #{order.id.slice(0, 8)}
                                            </p>
                                            <p className="mt-2 font-semibold text-foreground">{order.merchant_name}</p>
                                        </div>
                                        <Badge className={`border ${getOrderStatusTone(String(order.status))}`}>
                                            {formatOrderStatus(String(order.status))}
                                        </Badge>
                                    </div>
                                    <p className="text-lg font-bold text-[#F58220]">{formatKobo(order.payout_kobo)}</p>
                                    <p className="text-xs uppercase tracking-[0.16em] text-gray-400">Rider payout</p>
                                    <p className="text-sm text-muted-foreground">
                                        Completed {formatDateLabel(order.delivery_verified_at ?? order.created_at)}
                                    </p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <Card className="border-dashed">
                        <CardContent className="p-10 text-center text-muted-foreground">
                            No completed deliveries yet.
                        </CardContent>
                    </Card>
                )}
            </section>
        </div>
    )
}
