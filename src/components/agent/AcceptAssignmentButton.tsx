"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { acceptAgentAssignment } from "@/app/actions/orderActions"

export function AcceptAssignmentButton({ orderId }: { orderId: string }) {
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const handleAccept = async () => {
        setLoading(true)

        try {
            const result = await acceptAgentAssignment(orderId)

            if (result.success) {
                toast.success("Assignment accepted and forwarded to the merchant.")
                router.refresh()
                return
            }

            toast.error(result.message ?? "Unable to accept assignment.")
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Something went wrong")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Button onClick={handleAccept} disabled={loading} className="bg-[#F58220] hover:bg-[#E57210] text-white">
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {loading ? "Accepting..." : "Accept Assignment"}
        </Button>
    )
}
