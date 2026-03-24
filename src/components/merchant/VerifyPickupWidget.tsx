"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { verifyMerchantPickup } from "@/app/actions/orderActions"
import { toast } from "sonner"
import { CheckCircle2, Loader2 } from "lucide-react"

export function VerifyPickupWidget({ orderId }: { orderId: string }) {
    const [otp, setOtp] = useState("")
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const handleVerify = async () => {
        if (otp.length !== 4) {
            toast.error("Please enter a valid 4-digit code")
            return
        }

        setLoading(true)
        try {
            const result = await verifyMerchantPickup(orderId, otp)
            if (result.success) {
                toast.success("Pickup Verified! Order status updated.")
                router.refresh()
            } else {
                toast.error(result.message || "Verification failed")
            }
        } catch (error) {
            toast.error("Something went wrong")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-3">
            <h3 className="font-bold text-blue-900 dark:text-blue-100 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                Verify Rider Pickup
            </h3>
            <p className="text-sm text-blue-700 dark:text-blue-300">
                Ask the rider for their <strong>Pickup Code</strong> and enter it below to release the order.
            </p>
            <div className="flex gap-2">
                <Input
                    placeholder="0 0 0 0"
                    className="flex-1 font-mono text-center tracking-widest text-lg font-bold bg-white dark:bg-black"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    maxLength={4}
                />
                <Button onClick={handleVerify} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
                </Button>
            </div>
        </div>
    )
}
