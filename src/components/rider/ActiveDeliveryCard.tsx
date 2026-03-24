"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Phone, CheckCircle2, Package } from "lucide-react"
import { verifyDelivery } from "@/app/actions/riderActions"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"

interface ActiveDeliveryOrder {
    id: string
    status: string
    pickup_verified_at?: string | null
    pickup_code?: string | null
}

export function ActiveDeliveryCard({ order }: { order: ActiveDeliveryOrder }) {
    const [otp, setOtp] = useState("")
    const [loading, setLoading] = useState(false)

    // Check status to determine what to show
    const isPickupPending = order.status === 'processing' && !order.pickup_verified_at
    const isDeliveryPending = order.status === 'out_for_delivery'

    // We only handle Delivery Verification here. Pickup verification is done by the MERCHANT on their dashboard.
    // Wait, the rider app should logically show the PICKUP CODE to the rider so they can show it to the merchant? 
    // "Ask Rider for their code" -> Merchant enters code. 
    // Yes, VerifyRiderWidget says "Ask Rider for their code".
    // So Rider needs to see their Pickup Code.

    const handleVerifyDelivery = async () => {
        if (otp.length !== 4) {
            toast.error("Enter the 4-digit Delivery Code from the customer")
            return
        }
        setLoading(true)
        try {
            const result = await verifyDelivery(order.id, otp)
            if (result.success) {
                toast.success("Delivery Completed! Funds added to wallet.")
            } else {
                toast.error(result.message)
            }
        } catch {
            toast.error("Failed to verify delivery")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card className="border-[#F58220] mb-6 overflow-hidden shadow-lg">
            <CardHeader className="bg-[#F58220] text-white">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <CardTitle className="text-xl">Active Delivery</CardTitle>
                        <CardDescription className="text-orange-100">
                            Order #{order.id.slice(0, 8)}
                        </CardDescription>
                    </div>
                    <Badge className="bg-white/20 text-white border-none hover:bg-white/30">
                        {order.status.replace(/_/g, " ")}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-6 p-4 sm:p-6">

                {/* Pickup Phase Info */}
                {isPickupPending && (
                    <div className="bg-orange-50 dark:bg-orange-950/30 p-4 rounded-xl border border-orange-100 dark:border-orange-900">
                        <h4 className="font-bold text-[#F58220] mb-2 flex items-center gap-2">
                            <Package className="h-5 w-5" />
                            Pickup Code
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                            Show this code to the merchant to confirm pickup.
                        </p>
                        <div className="rounded-lg border border-dashed border-gray-300 bg-white py-2 text-center font-mono text-2xl font-bold tracking-[0.35em] dark:bg-black sm:text-3xl sm:tracking-[0.5em]">
                            {order.pickup_code}
                        </div>
                    </div>
                )}

                {/* Delivery Phase Info */}
                {isDeliveryPending && (
                    <div className="space-y-4">
                        <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-xl border border-blue-100 dark:border-blue-900">
                            <h4 className="font-bold text-blue-600 mb-2 flex items-center gap-2">
                                <CheckCircle2 className="h-5 w-5" />
                                Confirm Delivery
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                Ask the customer for their Delivery Code to complete the order.
                            </p>
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <Input
                                    placeholder="0 0 0 0"
                                    className="text-center font-mono text-lg tracking-widest font-bold"
                                    maxLength={4}
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                />
                                <Button
                                    className="w-full bg-blue-600 text-white hover:bg-blue-700 sm:w-auto sm:min-w-[100px]"
                                    onClick={handleVerifyDelivery}
                                    disabled={loading}
                                >
                                    {loading ? "Verifying..." : "Confirm"}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Locations */}
                <div className="space-y-4 pt-2">
                    {/* We need merchant info here, but `orders` table doesn't have it directly joined in the simple query usually. 
                        Ideally we fetch it. For now let's hope it's passed or we implement fetching details.
                     */}
                </div>

                {/* Customer Contact */}
                <div className="flex flex-col gap-3 sm:flex-row">
                    <Button variant="outline" className="flex-1 gap-2 border-green-200 text-green-700 hover:bg-green-50">
                        <Phone className="h-4 w-4" /> Call Customer
                    </Button>
                    {/* Add Chat/Message button later */}
                </div>
            </CardContent>
        </Card>
    )
}
