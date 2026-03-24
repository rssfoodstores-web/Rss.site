"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { confirmMerchantOrder } from "@/app/actions/orderActions"

export function ConfirmOrderButton({ orderId }: { orderId: string }) {
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const handleConfirm = async () => {
        setLoading(true)

        try {
            const result = await confirmMerchantOrder(orderId)

            if (result.success) {
                toast.success("Order confirmed. You can now prepare it for rider pickup.")
                router.refresh()
                return
            }

            toast.error(result.message ?? "Unable to confirm order.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Button onClick={handleConfirm} disabled={loading} className="bg-green-600 hover:bg-green-700 text-white font-bold">
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {loading ? "Confirming..." : "Confirm Order"}
        </Button>
    )
}
