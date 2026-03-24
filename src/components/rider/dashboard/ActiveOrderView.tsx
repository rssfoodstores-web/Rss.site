"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { MapPin, Phone, MessageSquare, Box, Truck, Navigation, XCircle } from "lucide-react"
import type { Database } from "@/types/database.types"
import { releaseStalePickup, verifyDelivery } from "@/app/actions/riderActions"
import { toast } from "sonner"
import { useState } from "react"
import { motion } from "framer-motion"
import { useRouter } from "next/navigation"
import { formatKobo } from "@/lib/money"
import { buildNavigationUrl, parseCoordinates, type Coordinates } from "@/lib/directions"
import { formatOrderStatus, getOrderStatusTone } from "@/lib/orders"

type Order = Database["public"]["Tables"]["orders"]["Row"] & {
    order_items: (Database["public"]["Tables"]["order_items"]["Row"] & {
        products: Database["public"]["Tables"]["products"]["Row"] | null
    })[]
}

interface ActiveOrderViewProps {
    order: Order
    merchant: { name: string; address: string; phone: string | null; location?: unknown | null } | null
    currentLocation?: Coordinates | null
}

export function ActiveOrderView({ order, merchant, currentLocation = null }: ActiveOrderViewProps) {
    const [deliveryOtp, setDeliveryOtp] = useState("")
    const [loading, setLoading] = useState(false)
    const [releasing, setReleasing] = useState(false)
    const router = useRouter()

    const currentStatus = String(order.status)
    const isPickupPhase = currentStatus === "ready_for_pickup"

    const handleVerifyDelivery = async () => {
        if (deliveryOtp.length !== 4) {
            toast.error("Please enter a valid 4-digit code")
            return
        }

        setLoading(true)

        try {
            const result = await verifyDelivery(order.id, deliveryOtp)

            if (result.success) {
                toast.success("Delivery verified and settlement completed.")
                router.refresh()
                return
            }

            toast.error(result.message ?? "Failed to verify delivery.")
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to verify delivery.")
        } finally {
            setLoading(false)
        }
    }

    const deliveryCoordinates = parseCoordinates(order.delivery_location)
    const merchantCoordinates = parseCoordinates(merchant?.location ?? null)
    let deliveryAddress = "Customer location shared after claim"
    if (deliveryCoordinates) {
        deliveryAddress = `Lat ${deliveryCoordinates.lat.toFixed(4)}, Lng ${deliveryCoordinates.lng.toFixed(4)}`
    }

    const navigationUrl = buildNavigationUrl({
        origin: currentLocation,
        destination: isPickupPhase
            ? {
                coordinates: merchantCoordinates,
                address: merchant?.address && merchant.address !== "Address hidden"
                    ? merchant.address
                    : null,
            }
            : {
                coordinates: deliveryCoordinates,
                address: deliveryCoordinates ? deliveryAddress : null,
            },
    })

    const callPhone = isPickupPhase ? merchant?.phone ?? null : null

    const handleOpenNavigation = () => {
        if (!navigationUrl) {
            toast.error("No destination is available for navigation yet.")
            return
        }

        window.open(navigationUrl, "_blank", "noopener,noreferrer")
    }

    const handleCall = () => {
        if (!callPhone) {
            toast.error("No phone number is available for this stop.")
            return
        }

        window.location.href = `tel:${callPhone}`
    }

    const handleReleasePickup = async () => {
        setReleasing(true)

        try {
            const result = await releaseStalePickup(order.id)

            if (result.success) {
                toast.success(result.message ?? "Pickup assignment released.")
                router.refresh()
                return
            }

            toast.error(result.message ?? "Unable to release pickup assignment.")
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Unable to release pickup assignment.")
        } finally {
            setReleasing(false)
        }
    }

    return (
        <div className="w-full max-w-md mx-auto space-y-4">
            <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="flex items-center justify-between bg-card border border-border p-4 rounded-xl shadow-lg"
            >
                <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${isPickupPhase ? "bg-blue-500/20 text-blue-500" : "bg-green-500/20 text-green-500"}`}>
                        {isPickupPhase ? <Box className="h-5 w-5" /> : <Truck className="h-5 w-5" />}
                    </div>
                    <div>
                        <h2 className="text-foreground font-bold">{isPickupPhase ? "Pickup Phase" : "Delivery Phase"}</h2>
                        <p className="text-muted-foreground text-xs">{isPickupPhase ? "Merchant handoff in progress" : "Head to customer"}</p>
                        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            Order #{order.id.slice(0, 8)}
                        </p>
                    </div>
                </div>
                <Badge className={`border ${getOrderStatusTone(currentStatus)}`}>
                    {formatOrderStatus(currentStatus)}
                </Badge>
            </motion.div>

            <Card className="border-border bg-card/50 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="text-lg text-card-foreground">
                        {isPickupPhase ? "Merchant Pickup" : "Customer Dropoff"}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-4">
                        <div className="flex items-start gap-3">
                            <MapPin className="h-5 w-5 text-[#F58220] mt-1 shrink-0" />
                            <div>
                                <h3 className="text-foreground font-medium">
                                    {isPickupPhase ? merchant?.name ?? "Merchant pickup" : "Customer location"}
                                </h3>
                                <p className="text-muted-foreground text-sm">
                                    {isPickupPhase ? merchant?.address ?? "Address hidden" : deliveryAddress}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2 pl-8">
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs"
                                onClick={handleOpenNavigation}
                                disabled={!navigationUrl}
                            >
                                <Navigation className="h-3 w-3 mr-2 text-blue-500" />
                                Navigation
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs"
                                onClick={handleCall}
                                disabled={!callPhone}
                            >
                                <Phone className="h-3 w-3 mr-2" />
                                Call
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
                                <Link href={`/rider/messages?order=${order.id}`}>
                                    <MessageSquare className="h-3 w-3 mr-2" />
                                    Chat
                                </Link>
                            </Button>
                        </div>
                    </div>

                    <Separator className="bg-border" />

                    {isPickupPhase ? (
                        <div className="space-y-4">
                            <div className="bg-blue-900/20 border border-blue-900/50 rounded-lg p-4 text-center space-y-3">
                                <p className="text-blue-200 text-sm">Show this code to the merchant</p>
                                <div className="text-4xl font-mono font-bold text-white tracking-widest">{order.pickup_code}</div>
                                <p className="text-zinc-500 text-xs">Merchant must verify this code to release the order.</p>
                                <p className="text-xs text-blue-100/80">
                                    The rider app does not confirm pickup. This screen will switch to delivery mode after the merchant verifies the code.
                                </p>
                            </div>
                            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-left text-sm text-amber-900">
                                <p className="font-semibold">Stale test pickup?</p>
                                <p className="mt-1">
                                    If you claimed this order by mistake and the merchant has not verified pickup, release it here so it returns to the rider queue.
                                </p>
                                <Button
                                    variant="destructive"
                                    className="mt-3 w-full"
                                    onClick={handleReleasePickup}
                                    disabled={releasing}
                                >
                                    <XCircle className="mr-2 h-4 w-4" />
                                    {releasing ? "Releasing..." : "Release stale pickup"}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="bg-[#F58220]/10 border border-[#F58220]/30 rounded-lg p-4 text-center space-y-2">
                                <p className="text-[#F58220] text-sm font-medium">Ask customer for delivery code</p>
                                <Input
                                    placeholder="0 0 0 0"
                                    className="text-center text-2xl tracking-[1em] font-bold h-14 bg-background border-input text-foreground"
                                    maxLength={4}
                                    value={deliveryOtp}
                                    onChange={(event) => setDeliveryOtp(event.target.value)}
                                />
                            </div>
                            <Button
                                className="w-full bg-green-600 hover:bg-green-700 text-white h-12 text-lg font-bold"
                                onClick={handleVerifyDelivery}
                                disabled={loading || deliveryOtp.length !== 4}
                            >
                                {loading ? "Verifying..." : "Complete Delivery"}
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card className="border-border bg-muted/30">
                <CardContent className="p-4">
                    <h4 className="text-muted-foreground text-sm font-medium mb-3">Order Items</h4>
                    <ul className="space-y-2">
                        {order.order_items.map((item, index) => (
                            <li key={index} className="flex justify-between text-foreground text-sm">
                                <span>{item.quantity}x {item.products?.name || "Unknown item"}</span>
                                <span className="text-muted-foreground">{formatKobo(item.total_price ?? 0)}</span>
                            </li>
                        ))}
                    </ul>
                </CardContent>
            </Card>
        </div>
    )
}
