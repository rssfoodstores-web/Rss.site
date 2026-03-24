"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { verifyMerchantPickup } from "@/app/actions/orderActions"
import { toast } from "sonner"
import { ShieldCheck, Truck, Package, Clock } from "lucide-react"
import type { Database } from "@/types/database.types"

// We can define a lighter type here since we just need basic info
type Order = Database["public"]["Tables"]["orders"]["Row"] & {
    order_items: (Database["public"]["Tables"]["order_items"]["Row"] & {
        products: Database["public"]["Tables"]["products"]["Row"] | null
    })[]
    rider_profiles?: {
        full_name: string | null
        id_card_url: string | null
    } | null // If we join this
}

interface VerifyRiderWidgetProps {
    orders: any[] // Using any mainly to avoid deep type gymnastics for now, but ideally strict
}

export function VerifyRiderWidget({ orders: initialOrders }: VerifyRiderWidgetProps) {
    const [orders, setOrders] = useState(initialOrders)
    const [otpInputs, setOtpInputs] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState<string | null>(null) // orderId trying to verify
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
                setOrders(prev => prev.filter(o => o.id !== orderId))
                router.refresh()
            } else {
                toast.error(result.message)
            }
        } catch (error) {
            toast.error("Failed to verify. Try again.")
        } finally {
            setLoading(null)
        }
    }

    if (orders.length === 0) return null

    return (
        <Card className="border-[#F58220] bg-orange-50/50 dark:bg-orange-950/10 mb-8 overflow-hidden">
            <CardHeader className="bg-[#F58220]/10 border-b border-[#F58220]/20 pb-4">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-[#F58220]" />
                    <CardTitle className="text-lg font-bold text-gray-900 dark:text-white">
                        Verify Rider Pickup
                    </CardTitle>
                </div>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                    {orders.length} order{orders.length > 1 ? 's' : ''} waiting for pickup. Ask Rider for their code.
                </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
                <div className="divide-y divide-gray-100 dark:divide-zinc-800">
                    {orders.map((order) => (
                        <div key={order.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            {/* Order Info */}
                            <div className="flex items-start gap-4">
                                <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                                    <Truck className="h-5 w-5 text-[#F58220]" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className="font-bold text-sm text-gray-900 dark:text-white">
                                            #{order.id.slice(0, 8)}
                                        </h4>
                                        <Badge variant="outline" className="text-xs border-orange-200 text-orange-600 bg-orange-50">
                                            Rider Arrived
                                        </Badge>
                                    </div>
                                    <div className="text-sm text-gray-500 mb-1 flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        <span>Accepted {new Date(order.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <div className="text-sm text-gray-500 mb-2">
                                        Rider: <span className="font-medium text-gray-900 dark:text-white">{order.rider?.full_name || "Assigned rider"}</span>
                                        {order.rider?.phone && (
                                            <a href={`tel:${order.rider.phone}`} className="ml-2 text-blue-600 hover:underline">
                                                {order.rider.phone}
                                            </a>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {order.order_items.map((item: any) => (
                                            <span key={item.id} className="text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-gray-600 dark:text-gray-300">
                                                {item.quantity}x {item.products?.name}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Verification Input */}
                            <div className="flex items-center gap-2 w-full md:w-auto">
                                <Input
                                    placeholder="0 0 0 0"
                                    className="w-24 text-center tracking-widest font-mono font-bold border-orange-200 focus:border-[#F58220]"
                                    maxLength={4}
                                    value={otpInputs[order.id] || ""}
                                    onChange={(e) => setOtpInputs(prev => ({ ...prev, [order.id]: e.target.value }))}
                                />
                                <Button
                                    className="bg-[#F58220] hover:bg-[#E57210] text-white min-w-[100px]"
                                    disabled={loading === order.id}
                                    onClick={() => handleVerify(order.id)}
                                >
                                    {loading === order.id ? "Checking..." : "Verify"}
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
