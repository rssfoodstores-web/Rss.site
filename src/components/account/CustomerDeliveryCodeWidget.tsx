"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Lock, Copy, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useState } from "react"
import { cn } from "@/lib/utils"

interface CustomerDeliveryCodeWidgetProps {
    deliveryCode: string | null
    status: string
}

export function CustomerDeliveryCodeWidget({ deliveryCode, status }: CustomerDeliveryCodeWidgetProps) {
    const [copied, setCopied] = useState(false)

    // Only show if order is active and code exists
    // We show it for 'out_for_delivery' primarily.
    // If 'delivered', maybe we show "Delivered" state instead.

    if (status === 'delivered') {
        return (
            <Card className="bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-900 mb-6">
                <CardContent className="flex items-center gap-4 p-6">
                    <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                        <h3 className="font-bold text-green-700 dark:text-green-400 text-lg">Order Delivered</h3>
                        <p className="text-green-600/80 dark:text-green-500 text-sm">Hope you enjoy your purchase!</p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    // If no code or not in relevant status, don't show anything (or maybe show "Processing" state)
    if (!deliveryCode || (status !== 'out_for_delivery' && status !== 'processing' && status !== 'ready_for_pickup')) {
        return null
    }

    const handleCopy = () => {
        if (deliveryCode) {
            navigator.clipboard.writeText(deliveryCode)
            setCopied(true)
            toast.success("Code copied to clipboard")
            setTimeout(() => setCopied(false), 2000)
        }
    }

    return (
        <Card className="border-[#F58220] bg-orange-50/50 dark:bg-orange-950/10 mb-6 overflow-hidden">
            <CardHeader className="bg-[#F58220]/10 border-b border-[#F58220]/20 pb-4">
                <div className="flex items-center gap-2">
                    <Lock className="h-5 w-5 text-[#F58220]" />
                    <CardTitle className="text-lg font-bold text-gray-900 dark:text-white">
                        Secure Delivery Code
                    </CardTitle>
                </div>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                    Share this code with the rider <strong>only when they arrive</strong> with your package.
                </CardDescription>
            </CardHeader>
            <CardContent className="p-6 text-center">
                <div
                    onClick={handleCopy}
                    className="cursor-pointer group relative inline-flex items-center justify-center gap-4 bg-white dark:bg-zinc-900 border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-xl py-4 px-8 min-w-[200px] hover:border-[#F58220] transition-colors"
                >
                    <span className="font-mono text-4xl font-bold tracking-[0.5em] text-gray-900 dark:text-white pl-4">
                        {deliveryCode}
                    </span>
                    <Button size="icon" variant="ghost" className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-gray-400" />}
                    </Button>
                </div>
                <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                    Tap to copy
                </p>
            </CardContent>
        </Card>
    )
}
