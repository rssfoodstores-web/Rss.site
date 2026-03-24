"use client"

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MapPin, Clock, Package } from "lucide-react"
import type { Database } from "@/types/database.types"
import { acceptOrder } from "@/app/actions/riderActions"
import { toast } from "sonner"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { parseCoordinates } from "@/lib/directions"
import { formatKobo } from "@/lib/money"

interface MissionCardOrder {
    id: string
    total_amount: number | null
    delivery_location: Database["public"]["Tables"]["orders"]["Row"]["delivery_location"]
    created_at: string | null
}

interface MissionCardProps {
    order: MissionCardOrder
    riderId: string
    merchantName?: string
    merchantAddress?: string
    queueIndex?: number
}

export function MissionCard({
    order,
    riderId,
    merchantName,
    merchantAddress: merchantAddressProp,
    queueIndex = 0,
}: MissionCardProps) {
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const handleAccept = async () => {
        setLoading(true)
        try {
            const result = await acceptOrder(order.id, riderId)
            if (result.success) {
                toast.success("Delivery accepted. Head to the merchant.")
                router.refresh()
                return
            }

            toast.error(result.message ?? "Failed to accept order")
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to accept order")
        } finally {
            setLoading(false)
        }
    }

    const deliveryCoordinates = parseCoordinates(order.delivery_location)
    const deliveryAddress = deliveryCoordinates
        ? `Lat ${deliveryCoordinates.lat.toFixed(4)}, Lng ${deliveryCoordinates.lng.toFixed(4)}`
        : "Customer location shared after claim"

    return (
        <Card className="border-orange-100 shadow-sm">
            <CardHeader className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge className="bg-[#F58220] text-white hover:bg-[#E57210]">Ready now</Badge>
                            <Badge variant="outline" className="border-orange-200 text-orange-700">
                                {queueIndex === 0 ? "Latest request" : `Queue #${queueIndex + 1}`}
                            </Badge>
                        </div>
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            Order #{order.id.slice(0, 8)}
                        </p>
                        <CardTitle className="mt-3 text-2xl font-bold text-foreground">
                            {formatKobo(order.total_amount ?? 0)}
                        </CardTitle>
                    </div>
                    <div className="rounded-2xl bg-orange-50 p-3 text-[#F58220]">
                        <Package className="h-5 w-5" />
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                <div className="rounded-2xl bg-muted/40 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Pickup</p>
                    <p className="mt-2 font-semibold text-foreground">{merchantName || "Merchant pickup"}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{merchantAddressProp || "Store address unavailable"}</p>
                </div>

                <div className="rounded-2xl bg-muted/40 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Dropoff</p>
                    <p className="mt-2 text-sm text-muted-foreground">{deliveryAddress}</p>
                </div>

                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-[#F58220]" />
                        <span>{new Date(order.created_at ?? Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-[#F58220]" />
                        <span>One active job at a time</span>
                    </div>
                </div>
            </CardContent>

            <CardFooter>
                <Button
                    onClick={handleAccept}
                    disabled={loading}
                    className="h-11 w-full bg-[#F58220] font-semibold text-white hover:bg-[#E57210]"
                >
                    {loading ? "Accepting..." : "Accept delivery"}
                </Button>
            </CardFooter>
        </Card>
    )
}
