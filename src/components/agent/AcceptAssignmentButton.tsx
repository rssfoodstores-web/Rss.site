"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { acceptAgentAssignment } from "@/app/actions/orderActions"

export function AcceptAssignmentButton({ orderId, expiresAt }: { orderId: string; expiresAt: string | null }) {
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const [expiredOffer, setExpiredOffer] = useState<string | null>(null)
    const expired = expiresAt !== null && expiredOffer === expiresAt

    useEffect(() => {
        if (!expiresAt) return
        const timer = window.setTimeout(() => setExpiredOffer(expiresAt), Math.max(0, Date.parse(expiresAt) - Date.now()))
        return () => window.clearTimeout(timer)
    }, [expiresAt])

    const handleAccept = async () => {
        if (expired) return
        setLoading(true)

        try {
            const result = await acceptAgentAssignment(orderId)

            if (result.success) {
                toast.success("Assignment accepted and forwarded to the merchant.")
                router.refresh()
                return
            }

            toast.error(result.message ?? "Unable to accept assignment.")
            router.refresh()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Something went wrong")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="grid gap-1">
            <Button onClick={handleAccept} disabled={loading || expired} className="bg-[#F58220] hover:bg-[#E57210] text-white">
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {expired ? "Offer expired" : loading ? "Accepting…" : "Accept assignment"}
            </Button>
            {expiresAt && !expired && <p className="text-xs text-muted-foreground">
                Accept by {new Intl.DateTimeFormat("en-NG", { timeZone: "Africa/Lagos", hour: "numeric", minute: "2-digit", second: "2-digit" }).format(new Date(expiresAt))} WAT
            </p>}
        </div>
    )
}
