"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { verifyMerchantPickup } from "@/app/actions/orderActions"
import { toast } from "sonner"
import { ArrowRight, Truck, Clock } from "lucide-react"

type Relation<T> = T | T[] | null

interface PickupOrder {
    id: string
    updated_at: string | null
    order_items: Array<{
        id: string
        quantity: number
        products: Relation<{
            name: string | null
        }>
    }>
    rider: Relation<{
        full_name: string | null
        phone: string | null
    }>
}

interface VerifyRiderWidgetProps {
    orders: PickupOrder[]
}

function firstRelation<T>(value: Relation<T>): T | null {
    if (Array.isArray(value)) {
        return value[0] ?? null
    }

    return value ?? null
}

export function VerifyRiderWidget({ orders: initialOrders }: VerifyRiderWidgetProps) {
    const [verifiedIds, setVerifiedIds] = useState<string[]>([])
    const orders = initialOrders.filter((order) => !verifiedIds.includes(order.id))
    const [otpInputs, setOtpInputs] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState<string | null>(null)
    const router = useRouter()

    const handleVerify = async (orderId: string) => {
        const otp = otpInputs[orderId]
        if (!otp || !/^\d{4}$/.test(otp)) {
            toast.error("Please enter the 4-digit Pickup Code")
            return
        }

        setLoading(orderId)
        try {
            const result = await verifyMerchantPickup(orderId, otp)
            if (result.success) {
                toast.success("Rider Verified! Hand over the package.")
                setVerifiedIds((prev) => [...prev, orderId])
                router.refresh()
            } else {
                toast.error(result.message)
            }
        } catch {
            toast.error("Failed to verify. Try again.")
        } finally {
            setLoading(null)
        }
    }

    if (orders.length === 0) return null

    return (
        <section aria-labelledby="merchant-pickup-title" className="overflow-hidden rounded-3xl border border-orange-100 bg-gradient-to-br from-orange-100/75 via-orange-50 to-card p-4 dark:border-orange-900 dark:from-orange-950/65 dark:via-orange-950/25 sm:p-6">
            <div className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-orange-200/80 text-orange-900 dark:bg-orange-900 dark:text-orange-200">
                    <Truck className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wider text-orange-800 dark:text-orange-300">Ready for pickup</p>
                    <h2 id="merchant-pickup-title" className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
                        {orders.length === 1 ? `Verify the rider for order #${orders[0].id.slice(0, 8).toUpperCase()}` : `Verify riders for ${orders.length} pickups`}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">Confirm the rider’s pickup code before handing over the order.</p>
                </div>
            </div>
            <details className="mt-4">
                <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl bg-[#F58220] px-4 py-2 text-sm font-bold text-orange-950 [&::-webkit-details-marker]:hidden">
                    {orders.length === 1 ? "Verify rider" : "Open pickups"} <ArrowRight className="size-4" aria-hidden="true" />
                </summary>
                <div className="mt-3 divide-y overflow-hidden rounded-2xl border bg-card">
                    {orders.map((order) => {
                        const rider = firstRelation(order.rider)

                        return (
                            <div key={order.id} className="flex flex-col justify-between gap-4 p-4 md:flex-row md:items-center">
                                <div className="flex items-start gap-4">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100 dark:bg-zinc-800">
                                        <Truck className="h-5 w-5 text-[#F58220]" />
                                    </div>
                                    <div>
                                        <div className="mb-1 flex items-center gap-2">
                                            <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                                                #{order.id.slice(0, 8)}
                                            </h4>
                                            <Badge variant="outline" className="border-orange-200 bg-orange-50 text-xs text-orange-600">
                                                Ready for pickup
                                            </Badge>
                                        </div>
                                        <div className="mb-1 flex items-center gap-1 text-sm text-gray-500">
                                            <Clock className="h-3 w-3" />
                                            <span>
                                                Accepted {order.updated_at
                                                    ? new Date(order.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                                                    : "recently"}
                                            </span>
                                        </div>
                                        <div className="mb-2 text-sm text-gray-500">
                                            Rider: <span className="font-medium text-gray-900 dark:text-white">{rider?.full_name || "Assigned rider"}</span>
                                            {rider?.phone ? (
                                                <a href={`tel:${rider.phone}`} className="ml-2 text-blue-600 hover:underline">
                                                    {rider.phone}
                                                </a>
                                            ) : null}
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {order.order_items.map((item) => (
                                                <span key={item.id} className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-zinc-800 dark:text-gray-300">
                                                    {item.quantity}x {firstRelation(item.products)?.name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex w-full items-center gap-2 md:w-auto">
                                    <Input
                                        aria-label={`Pickup code for order ${order.id.slice(0, 8)}`}
                                        inputMode="numeric"
                                        placeholder="0 0 0 0"
                                        className="w-24 border-orange-200 text-center font-mono font-bold tracking-widest focus:border-[#F58220]"
                                        maxLength={4}
                                        value={otpInputs[order.id] || ""}
                                        onChange={(event) => setOtpInputs((prev) => ({ ...prev, [order.id]: event.target.value.replace(/\D/g, "") }))}
                                    />
                                    <Button
                                        className="min-w-[100px] bg-[#F58220] text-white hover:bg-[#E57210]"
                                        disabled={loading === order.id}
                                        onClick={() => handleVerify(order.id)}
                                    >
                                        {loading === order.id ? "Checking..." : "Verify"}
                                    </Button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </details>
        </section>
    )
}
