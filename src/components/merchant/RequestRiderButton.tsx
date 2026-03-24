"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { requestRider } from "@/app/actions/orderActions"
import { toast } from "sonner"
import { Truck } from "lucide-react"

export function RequestRiderButton({ orderId }: { orderId: string }) {
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const handleRequest = async () => {
        setLoading(true)
        try {
            const result = await requestRider(orderId)
            if (result.success) {
                toast.success("Rider request opened. Nearby riders can now see this order.")
                router.refresh()
            } else {
                toast.error(result.message || "Failed to request rider")
            }
        } catch {
            toast.error("Something went wrong")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Button onClick={handleRequest} disabled={loading} className="bg-[#F58220] hover:bg-[#d9721a] text-white font-bold">
            <Truck className="mr-2 h-4 w-4" />
            {loading ? "Requesting..." : "Request Rider"}
        </Button>
    )
}
