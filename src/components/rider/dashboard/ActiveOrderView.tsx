"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { MapPin, Phone, MessageSquare, Box, Truck, XCircle, Navigation } from "lucide-react"
import type { Database } from "@/types/database.types"
import { releaseStalePickup, reportDeliveryIssue, verifyDelivery } from "@/app/actions/riderActions"
import { toast } from "sonner"
import { useState } from "react"
import { motion } from "framer-motion"
import { useRouter } from "next/navigation"
import { formatKobo } from "@/lib/money"
import { buildRiderNavigationUrl, parseCoordinates, type Coordinates } from "@/lib/directions"
import { formatOrderStatus, getOrderStatusTone } from "@/lib/orders"
import { RiderRouteMap } from "@/components/rider/dashboard/RiderRouteMap"

type Order = Database["public"]["Tables"]["orders"]["Row"] & {
    order_items: (Database["public"]["Tables"]["order_items"]["Row"] & {
        products: Database["public"]["Tables"]["products"]["Row"] | null
    })[]
}

interface ActiveOrderViewProps {
    order: Order
    merchant: { name: string; address: string; phone: string | null; location?: unknown | null } | null
    currentLocation?: Coordinates | null
    gpsAccuracy?: number | null
    gpsUpdatedAt?: number | null
}

function normalizeDeliveryContacts(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return []
    }

    return Array.from(new Set(
        value
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim())
            .filter(Boolean)
    )).slice(0, 3)
}

function phoneHref(value: string): string | null {
    const normalized = value.replace(/[^\d+]/g, "")
    if (!/^\+?\d{7,15}$/.test(normalized)) {
        return null
    }

    return `tel:${normalized}`
}

function deliveryAddressLabel(value: unknown): string | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null
    }

    const snapshot = value as Record<string, unknown>
    const addressLabel = typeof snapshot.address_label === "string" ? snapshot.address_label.trim() : ""

    return addressLabel || null
}

export function ActiveOrderView({ order, merchant, currentLocation = null, gpsAccuracy = null, gpsUpdatedAt = null }: ActiveOrderViewProps) {
    const [deliveryOtp, setDeliveryOtp] = useState("")
    const [loading, setLoading] = useState(false)
    const [releasing, setReleasing] = useState(false)
    const [issueLoading, setIssueLoading] = useState(false)
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
    const savedDeliveryAddress = deliveryAddressLabel(order.delivery_address_snapshot)
    const deliveryAddress = savedDeliveryAddress
        ?? (deliveryCoordinates
            ? `Pinned location: ${deliveryCoordinates.lat.toFixed(5)}, ${deliveryCoordinates.lng.toFixed(5)}`
            : "Customer location is unavailable")

    const customerContacts = normalizeDeliveryContacts(order.contact_numbers)
    const callPhone = isPickupPhase ? merchant?.phone ?? null : customerContacts[0] ?? null
    const activeDestination = isPickupPhase ? merchantCoordinates : deliveryCoordinates
    const navigationUrl = activeDestination
        ? buildRiderNavigationUrl(activeDestination, currentLocation, typeof navigator !== "undefined" ? navigator.userAgent : "")
        : null
    const gpsAgeSeconds = gpsUpdatedAt ? Math.max(0, Math.round((Date.now() - gpsUpdatedAt) / 1000)) : null
    const gpsIsStale = gpsAgeSeconds === null || gpsAgeSeconds > 60
    const gpsIsPoor = gpsAccuracy !== null && gpsAccuracy > 100

    const handleCall = () => {
        if (!callPhone) {
            toast.error("No phone number is available for this stop.")
            return
        }

        const href = phoneHref(callPhone)
        if (!href) {
            toast.error("This phone number is not valid.")
            return
        }

        window.location.href = href
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

    const handleDeliveryIssue = async (action: "failed" | "reschedule" | "return_to_merchant") => {
        const labels = { failed: "failed delivery", reschedule: "rescheduling", return_to_merchant: "return to merchant" }
        const reason = window.prompt(`Reason for ${labels[action]}:`)?.trim()
        if (!reason) return
        const scheduledAt = action === "reschedule"
            ? window.prompt("New delivery date and time (for example 2026-10-06 14:00):")?.trim() ?? null
            : null
        if (action === "reschedule" && !scheduledAt) return

        setIssueLoading(true)
        try {
            const result = await reportDeliveryIssue(order.id, action, reason, scheduledAt)
            if (result.success) {
                toast.success(result.message)
                router.refresh()
            } else {
                toast.error(result.message ?? "Unable to update delivery status.")
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Unable to update delivery status.")
        } finally {
            setIssueLoading(false)
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
                    <div className={`rounded-lg border p-3 text-sm ${gpsIsStale || gpsIsPoor ? "border-amber-300 bg-amber-50 text-amber-900" : "border-green-200 bg-green-50 text-green-900"}`}>
                        <p className="font-semibold">{gpsIsStale ? "GPS location needs attention" : gpsIsPoor ? "GPS accuracy is poor" : "GPS location is active"}</p>
                        <p className="mt-1 text-xs">
                            {gpsIsStale ? "Keep this page open and enable precise location services." : gpsIsPoor ? `Accuracy is approximately ${Math.round(gpsAccuracy ?? 0)} metres. Move outdoors or enable precise GPS.` : `Accuracy is approximately ${Math.round(gpsAccuracy ?? 0)} metres.`}
                        </p>
                    </div>
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
                                className="h-8 bg-[#F58220] text-xs text-white hover:bg-[#E57210]"
                                asChild={Boolean(navigationUrl)}
                                disabled={!navigationUrl}
                            >
                                {navigationUrl ? (
                                    <a href={navigationUrl} target="_blank" rel="noreferrer">
                                        <Navigation className="mr-2 h-3 w-3" />
                                        {isPickupPhase ? "Navigate to merchant" : "Navigate to customer"}
                                    </a>
                                ) : (
                                    <span><Navigation className="mr-2 h-3 w-3" />Location unavailable</span>
                                )}
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
                        {!isPickupPhase && customerContacts.length > 0 ? (
                            <div className="ml-8 rounded-xl border border-green-200 bg-green-50/70 p-3 dark:border-green-900/40 dark:bg-green-950/20">
                                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-green-800 dark:text-green-200">
                                    Delivery contacts
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {customerContacts.map((number, index) => {
                                        const href = phoneHref(number)

                                        return href ? (
                                            <a
                                                key={`${number}-${index}`}
                                                href={href}
                                                className="rounded-full border border-green-200 bg-white px-3 py-1.5 text-sm font-semibold text-green-800 hover:bg-green-100 dark:border-green-800 dark:bg-green-950/40 dark:text-green-100"
                                            >
                                                {index === 0 ? "Primary: " : `Alternative ${index}: `}{number}
                                            </a>
                                        ) : (
                                            <span key={`${number}-${index}`} className="rounded-full border border-red-200 px-3 py-1.5 text-sm text-red-700">
                                                Invalid number: {number}
                                            </span>
                                        )
                                    })}
                                </div>
                            </div>
                        ) : null}
                        <RiderRouteMap
                            riderLocation={currentLocation}
                            pickupLocation={merchantCoordinates}
                            dropoffLocation={deliveryCoordinates}
                            pickupLabel={merchant?.name ?? "Merchant pickup"}
                            dropoffLabel="Customer dropoff"
                            activeStop={isPickupPhase ? "pickup" : "dropoff"}
                        />
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
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                                <Button variant="outline" className="text-xs" onClick={() => handleDeliveryIssue("failed")} disabled={issueLoading || loading}>
                                    Report failed delivery
                                </Button>
                                <Button variant="outline" className="text-xs" onClick={() => handleDeliveryIssue("reschedule")} disabled={issueLoading || loading}>
                                    Reschedule
                                </Button>
                                <Button variant="outline" className="text-xs text-red-700" onClick={() => handleDeliveryIssue("return_to_merchant")} disabled={issueLoading || loading}>
                                    Return to merchant
                                </Button>
                            </div>
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

