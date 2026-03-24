"use client"

import { useState } from "react"
import { ProfileSidebar } from "@/components/account/ProfileSidebar"
import { Package, Search, Truck, CheckCircle2, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface TrackOrderStep {
    completed: boolean
    current?: boolean
    date: string
    label: string
}

interface TrackedOrder {
    date: string
    estimate: string
    id: string
    status: string
    steps: TrackOrderStep[]
}

export default function TrackOrderPage() {
    const [orderId, setOrderId] = useState("")
    const [searching, setSearching] = useState(false)
    const [order, setOrder] = useState<TrackedOrder | null>(null)

    const handleTrack = (e: React.FormEvent) => {
        e.preventDefault()
        if (!orderId) return
        setSearching(true)
        // Simulate search
        setTimeout(() => {
            setOrder({
                id: orderId,
                status: "In Transit",
                date: "2024-01-22",
                estimate: "Jan 25, 2024",
                steps: [
                    { label: "Order Placed", date: "Jan 22, 10:30 AM", completed: true },
                    { label: "Processing", date: "Jan 22, 02:15 PM", completed: true },
                    { label: "Shipped", date: "Jan 23, 09:00 AM", completed: true },
                    { label: "In Transit", date: "Expected Jan 24", completed: false, current: true },
                    { label: "Delivered", date: "Expected Jan 25", completed: false },
                ]
            })
            setSearching(false)
        }, 1000)
    }

    return (
        <div className="min-h-screen bg-gray-50/50 py-6 dark:bg-black sm:py-8 lg:py-12">
            <div className="container mx-auto px-4 sm:px-6">
                <div className="mb-6 font-poppins sm:mb-8">
                    <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">Track Order</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 sm:text-base">Enter your order ID to see real-time delivery status.</p>
                </div>

                <div className="flex flex-col gap-5 sm:gap-6 lg:flex-row lg:gap-8">
                    <aside className="w-full flex-shrink-0 lg:sticky lg:top-4 lg:z-10 lg:w-80">
                        <ProfileSidebar />
                    </aside>
                    <main className="min-w-0 flex-1 space-y-6">
                        {/* Search Card */}
                        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
                            <form onSubmit={handleTrack} className="flex flex-col md:flex-row gap-4">
                                <div className="flex-1 relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                                    <Input
                                        placeholder="Enter Order ID (e.g. RSS-12345)"
                                        className="h-14 pl-12 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-gray-100 dark:border-zinc-700 font-bold"
                                        value={orderId}
                                        onChange={(e) => setOrderId(e.target.value)}
                                    />
                                </div>
                                <Button
                                    className="bg-[#F58220] hover:bg-[#F58220]/90 h-14 px-10 rounded-2xl font-bold text-lg text-white shadow-lg shadow-orange-500/20"
                                    disabled={searching}
                                >
                                    {searching ? "Searching..." : "Track Now"}
                                </Button>
                            </form>
                        </div>

                        {order ? (
                            <div className="animate-in fade-in slide-in-from-bottom-4 overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                                <div className="flex flex-col items-start justify-between gap-4 border-b border-gray-100 bg-gray-50/50 p-5 dark:border-zinc-800 dark:bg-zinc-800/50 md:flex-row md:items-center sm:p-8">
                                    <div>
                                        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">Order ID</p>
                                        <h3 className="text-2xl font-extrabold text-[#F58220]">{order.id}</h3>
                                    </div>
                                    <div className="text-left md:text-right">
                                        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">Estimated Delivery</p>
                                        <p className="text-lg font-bold">{order.estimate}</p>
                                    </div>
                                </div>

                                <div className="p-5 sm:p-8">
                                    <div className="relative">
                                        {/* Vertical line */}
                                        <div className="absolute left-[19px] top-2 bottom-2 w-0.5 bg-gray-100 dark:bg-zinc-800"></div>

                                        <div className="space-y-10 relative">
                                            {order.steps.map((step, idx) => (
                                                <div key={idx} className="flex gap-6 items-start">
                                                    <div className={cn(
                                                        "h-10 w-10 rounded-full flex items-center justify-center relative z-10 shrink-0",
                                                        step.completed ? "bg-green-500 text-white" :
                                                            step.current ? "bg-[#F58220] text-white shadow-lg shadow-orange-500/30 ring-4 ring-orange-100 dark:ring-orange-900/20" :
                                                                "bg-gray-100 dark:bg-zinc-800 text-gray-400"
                                                    )}>
                                                        {step.completed ? <CheckCircle2 className="h-5 w-5" /> :
                                                            step.current ? <Truck className="h-5 w-5" /> :
                                                                <Clock className="h-5 w-5" />}
                                                    </div>
                                                    <div>
                                                        <h4 className={cn(
                                                            "font-bold text-lg mb-0.5",
                                                            step.completed ? "text-gray-900 dark:text-white" :
                                                                step.current ? "text-[#F58220]" :
                                                                    "text-gray-400"
                                                        )}>
                                                            {step.label}
                                                        </h4>
                                                        <p className="text-sm text-gray-500">{step.date}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-12 border border-gray-100 dark:border-zinc-800 shadow-sm text-center">
                                <div className="h-20 w-20 bg-gray-50 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-300">
                                    <Package className="h-10 w-10" />
                                </div>
                                <h3 className="text-xl font-bold mb-2">Ready to track?</h3>
                                <p className="text-gray-500 max-w-sm mx-auto">
                                    Enter your order identifier from your confirmation email to see where your package is.
                                </p>
                            </div>
                        )}
                    </main>
                </div>
            </div>
        </div>
    )
}
