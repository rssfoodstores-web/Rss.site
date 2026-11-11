"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { acceptAgentAssignment, declineAgentAssignment } from "@/app/actions/orderActions"

export function AcceptAssignmentButton({ orderId, expiresAt, canDecline = false }: {
    orderId: string; expiresAt: string | null; canDecline?: boolean
}) {
    const [loading, setLoading] = useState<"accept" | "decline" | null>(null)
    const router = useRouter()
    const [expiredOffer, setExpiredOffer] = useState<string | null>(null)
    const expired = expiresAt !== null && expiredOffer === expiresAt

    useEffect(() => {
        if (!expiresAt) return
        const timer = window.setTimeout(() => {
            setExpiredOffer(expiresAt)
            router.refresh()
        }, Math.max(0, Date.parse(expiresAt) - Date.now()))
        return () => window.clearTimeout(timer)
    }, [expiresAt, router])

    const respond = async (decision: "accept" | "decline") => {
        if (expired || loading) return
        setLoading(decision)

        try {
            const result = await (decision === "accept" ? acceptAgentAssignment(orderId) : declineAgentAssignment(orderId))

            if (result.success) {
                toast.success(decision === "accept" ? "Order accepted." : "Offer declined.")
                router.refresh()
                return
            }

            toast.error(result.message ?? "Unable to respond to this offer.")
            router.refresh()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Something went wrong")
        } finally {
            setLoading(null)
        }
    }

    return (
        <div className="grid gap-2">
            <div className="flex flex-wrap gap-2">
                <Button onClick={() => void respond("accept")} disabled={!!loading || expired} className="min-h-11 bg-[#F58220] text-gray-950 hover:bg-orange-400">
                    <CheckCircle2 className="size-4" />
                    {expired ? "Offer expired" : loading === "accept" ? "Accepting…" : "Accept order"}
                </Button>
                {canDecline && <Button variant="outline" className="min-h-11" disabled={!!loading || expired} onClick={() => void respond("decline")}>
                    {loading === "decline" ? "Declining…" : "Decline"}
                </Button>}
            </div>
            {expiresAt && !expired && <p className="text-xs text-muted-foreground">
                Accept by {new Intl.DateTimeFormat("en-NG", { timeZone: "Africa/Lagos", hour: "numeric", minute: "2-digit", second: "2-digit" }).format(new Date(expiresAt))} WAT
            </p>}
        </div>
    )
}
