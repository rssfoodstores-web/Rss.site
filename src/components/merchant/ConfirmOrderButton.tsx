"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { confirmMerchantOrder } from "@/app/actions/orderActions"

export function ConfirmOrderButton({ orderId, orderHref }: { orderId: string; orderHref: string }) {
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const handleConfirm = async () => {
        setLoading(true)

        try {
            const result = await confirmMerchantOrder(orderId)

            if (result.success) {
                toast.success("Order confirmed. You can now prepare it for rider pickup.")
                if (new URLSearchParams(window.location.search).get("order") === orderId) router.refresh()
                else router.replace(orderHref, { scroll: false })
                return
            }

            toast.error(result.message ?? "Unable to confirm order.")
        } catch {
            toast.error("Couldn’t confirm the order. Try again.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Button type="button" onClick={handleConfirm} disabled={loading} className="min-h-11 bg-[#F58220] text-gray-950 hover:bg-orange-400">
            <CheckCircle2 className="size-4" aria-hidden="true" />
            {loading ? "Confirming…" : "Confirm order"}
        </Button>
    )
}
