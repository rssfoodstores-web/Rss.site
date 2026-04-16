"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { verifyMerchantPickup } from "@/app/actions/orderActions"
import { toast } from "sonner"
import { ShieldCheck, Truck, Clock } from "lucide-react"

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
    const [orders, setOrders] = useState<PickupOrder[]>(initialOrders)
    const [otpInputs, setOtpInputs] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState<string | null>(null)
    const router = useRouter()

    const handleVerify = async (orderId: string) => {
        const otp = otpInputs[orderId]
        if (!otp || otp.length !== 4) {
            toast.error("Please enter the 4-digit Pickup Code")
            return
        }

        setLoading(orderId)
        try {
            const result = await verifyMerchantPickup(orderId, otp)
            if (result.success) {
                toast.success("Rider Verified! Hand over the package.")
                setOrders((prev) => prev.filter((order) => order.id !== orderId))
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
        <Card className="mb-8 overflow-hidden border-[#F58220] bg-orange-50/50 dark:bg-orange-950/10">
            <CardHeader className="border-b border-[#F58220]/20 bg-[#F58220]/10 pb-4">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-[#F58220]" />
                    <CardTitle className="text-lg font-bold text-gray-900 dark:text-white">
                        Verify Rider Pickup
                    </CardTitle>
                </div>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                    {orders.length} order{orders.length > 1 ? "s" : ""} waiting for pickup. Ask Rider for their code.
                </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
                <div className="divide-y divide-gray-100 dark:divide-zinc-800">
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
                                                Rider Arrived
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
                                        placeholder="0 0 0 0"
                                        className="w-24 border-orange-200 text-center font-mono font-bold tracking-widest focus:border-[#F58220]"
                                        maxLength={4}
                                        value={otpInputs[order.id] || ""}
                                        onChange={(event) => setOtpInputs((prev) => ({ ...prev, [order.id]: event.target.value }))}
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
            </CardContent>
        </Card>
    )
}
