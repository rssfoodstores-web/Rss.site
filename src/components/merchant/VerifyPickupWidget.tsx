"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { verifyMerchantPickup } from "@/app/actions/orderActions"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

export function VerifyPickupWidget({ orderId, orderHref }: { orderId: string; orderHref: string }) {
    const [otp, setOtp] = useState("")
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const handleVerify = async () => {
        if (loading || otp.length !== 4) return

        setLoading(true)
        try {
            const result = await verifyMerchantPickup(orderId, otp)
            if (result.success) {
                toast.success("Pickup Verified! Order status updated.")
                if (new URLSearchParams(window.location.search).get("order") === orderId) router.refresh()
                else router.replace(orderHref, { scroll: false })
            } else {
                toast.error(result.message || "Verification failed")
            }
        } catch {
            toast.error("Something went wrong")
        } finally {
            setLoading(false)
        }
    }

    return (
        <form className="space-y-2 pt-1" onSubmit={(event) => { event.preventDefault(); void handleVerify() }}>
            <label htmlFor="merchant-pickup-code" className="text-sm font-medium">Rider’s 4-digit pickup code</label>
            <div className="flex flex-wrap gap-2">
                <Input
                    id="merchant-pickup-code"
                    inputMode="numeric"
                    autoComplete="off"
                    className="min-h-11 w-24 bg-background text-center text-base tracking-widest"
                    value={otp}
                    disabled={loading}
                    onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 4))}
                />
                <Button type="submit" disabled={loading || otp.length !== 4} className="min-h-11 bg-[#F58220] text-gray-950 hover:bg-orange-400">
                    {loading ? <><Loader2 className="size-4 animate-spin" aria-hidden="true" /> Verifying…</> : "Verify pickup"}
                </Button>
            </div>
        </form>
    )
}
