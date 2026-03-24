"use client"

import { createClient } from "@/lib/supabase/client"
import { startTransition, useEffect, useState, useTransition } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import Link from "next/link"
import { ProfileSidebar } from "@/components/account/ProfileSidebar"
import { CustomerDeliveryCodeWidget } from "@/components/account/CustomerDeliveryCodeWidget"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { OrderRatingWidget as RatingWidget } from "@/components/account/OrderRatingWidget"
import { cancelUnpaidOrder } from "@/app/actions/orderActions"
import { Package, CheckCircle2, MapPin, MessageSquare, Phone, User, ChevronLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatKobo } from "@/lib/money"
import { formatOrderStatus, formatPaymentStatus, getCustomerOrderTimeline, getOrderStatusTone, getPaymentStatusTone } from "@/lib/orders"

interface OrderPerson {
    full_name: string | null
    phone: string | null
    avatar_url: string | null
}

interface OrderItemProduct {
    id: string
    name: string | null
    image_url: string | null
}

interface OrderItem {
    id: string
    quantity: number
    price_per_unit: number
    total_price: number | null
    products: OrderItemProduct | null
}

interface OrderDeliveryLocation {
    address?: string
}

interface OrderDetail {
    delivery_fee_kobo: number | null
    id: string
    payment_status: string | null
    points_discount_kobo: number | null
    points_redeemed: number | null
    status: string
    subtotal_amount_kobo: number | null
    total_amount: number
    delivery_code: string | null
    delivery_location: OrderDeliveryLocation | null
    order_items: OrderItem[]
    rider: OrderPerson | null
    agent: OrderPerson | null
}

interface ViewerUser {
    id: string
}

interface OrderDetailClientProps {
    order: OrderDetail
    user: ViewerUser
}

export function OrderDetailClient({ order, user }: OrderDetailClientProps) {
    const [supabase] = useState(() => createClient())
    const router = useRouter()
    const [isCancelling, startCancelling] = useTransition()

    useEffect(() => {
        const channel = supabase
            .channel(`order-detail-${order.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'orders',
                    filter: `id=eq.${order.id}`
                },
                (payload: { new: { status: string }; old: { status: string } }) => {
                    const newStatus = payload.new.status
                    const oldStatus = payload.old.status

                    if (newStatus !== oldStatus) {
                        toast.success(`Order status updated to: ${formatOrderStatus(newStatus)}`)
                        startTransition(() => {
                            router.refresh()
                        })
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [order.id, router, supabase])

    // Helper to determine step status
    const timelineSteps = getCustomerOrderTimeline(String(order.status)) as string[]

    const getStepStatus = (stepName: string) => {
        const currentIdx = timelineSteps.indexOf(order.status)
        const stepIdx = timelineSteps.indexOf(stepName)

        if (currentIdx > stepIdx) return "completed"
        if (currentIdx === stepIdx) return "current"
        return "pending"
    }

    // Explicit steps for timeline
    const steps = timelineSteps.map((status) => ({
        label: formatOrderStatus(status),
        status,
    }))
    const isPendingPayment = order.status === "pending" && order.payment_status === "pending"

    const handleCancelPendingOrder = () => {
        startCancelling(async () => {
            const result = await cancelUnpaidOrder(order.id)

            if (result.success) {
                toast.success(result.message ?? "Pending order cancelled.")
                router.refresh()
                return
            }

            toast.error(result.message ?? "Unable to cancel unpaid order.")
        })
    }

    return (
        <div className="min-h-screen bg-gray-50/50 py-6 dark:bg-black sm:py-8 lg:py-12">
            <div className="container mx-auto px-4 sm:px-6">
                <div className="mb-6 sm:mb-8">
                    <Link href="/account/orders" className="inline-flex items-center text-sm text-gray-500 hover:text-[#F58220] mb-4">
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Back to Orders
                    </Link>
                    <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">Order Details</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 sm:text-base">Manage and track order #{order.id.slice(0, 8)}</p>
                </div>

                <div className="flex flex-col gap-5 sm:gap-6 lg:flex-row lg:gap-8">
                    <aside className="w-full flex-shrink-0 lg:w-80">
                        <ProfileSidebar />
                    </aside>
                    <main className="min-w-0 flex-1 space-y-6">

                        <CustomerDeliveryCodeWidget
                            deliveryCode={order.delivery_code}
                            status={order.status}
                        />

                        {/* 1.5 Rate Order Widget (When Delivered) */}
                        {(order.status === 'delivered' || order.status === 'completed') && (
                            <RatingWidget
                                orderId={order.id}
                                riderName={order.rider?.full_name ?? undefined}
                                items={order.order_items
                                    .filter((item) => item.products?.id)
                                    .map((item) => ({
                                        id: item.products?.id ?? item.id,
                                        name: item.products?.name ?? "Item"
                                    }))}
                            />
                        )}

                        {/* 2. Order Status & Rider */}
                        <Card className="border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
                            <CardHeader className="border-b border-gray-50 dark:border-zinc-800 pb-4">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                    <CardTitle>Total: {formatKobo(order.total_amount)}</CardTitle>
                                    <div className="flex flex-wrap gap-2">
                                        <span className={cn(
                                            "px-3 py-1 rounded-full text-xs font-bold uppercase border",
                                            getOrderStatusTone(order.status)
                                        )}>
                                            {formatOrderStatus(order.status)}
                                        </span>
                                        <span className={cn(
                                            "px-3 py-1 rounded-full text-xs font-bold uppercase border",
                                            getPaymentStatusTone(order.payment_status)
                                        )}>
                                            {formatPaymentStatus(order.payment_status)}
                                        </span>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-6">
                                <div className="mb-6 grid gap-3 sm:grid-cols-3">
                                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/40">
                                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-400">Subtotal</p>
                                        <p className="mt-2 text-lg font-bold text-gray-900 dark:text-white">{formatKobo(order.subtotal_amount_kobo ?? order.total_amount)}</p>
                                    </div>
                                    <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-300">Reward discount</p>
                                        <p className="mt-2 text-lg font-bold text-emerald-700 dark:text-emerald-300">
                                            {order.points_discount_kobo && order.points_discount_kobo > 0 ? `-${formatKobo(order.points_discount_kobo)}` : formatKobo(0)}
                                        </p>
                                        <p className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-300/80">
                                            {order.points_redeemed && order.points_redeemed > 0
                                                ? `${order.points_redeemed.toLocaleString()} points used`
                                                : "No reward points applied"}
                                        </p>
                                    </div>
                                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/40">
                                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-400">Delivery fee</p>
                                        <p className="mt-2 text-lg font-bold text-gray-900 dark:text-white">{formatKobo(order.delivery_fee_kobo ?? 0)}</p>
                                    </div>
                                </div>

                                {isPendingPayment ? (
                                    <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                            <div>
                                                <p className="font-semibold text-amber-900 dark:text-amber-100">Payment is still pending.</p>
                                                <p className="mt-1 text-sm text-amber-800/80 dark:text-amber-200/80">
                                                    Cancel this order if you want to release any reward points reserved for it and start over.
                                                </p>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="rounded-full border-amber-300 bg-white text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-transparent dark:text-amber-200"
                                                onClick={handleCancelPendingOrder}
                                                disabled={isCancelling}
                                            >
                                                {isCancelling ? "Cancelling..." : "Cancel pending order"}
                                            </Button>
                                        </div>
                                    </div>
                                ) : null}

                                {order.agent && (
                                    <div className="mb-6 rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                                            <div className="flex items-center gap-4">
                                                <div className="h-14 w-14 rounded-full bg-orange-100 flex items-center justify-center text-[#F58220] overflow-hidden">
                                                    {order.agent.avatar_url ? (
                                                        <Image src={order.agent.avatar_url} alt="Agent" width={56} height={56} className="h-full w-full object-cover" />
                                                    ) : (
                                                        <User className="h-7 w-7" />
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-bold text-gray-900 dark:text-white text-lg">{order.agent.full_name || "Assigned Agent"}</h4>
                                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-[#F58220] uppercase tracking-wide">Agent</span>
                                                    </div>
                                                    <p className="text-sm text-gray-500">This agent is coordinating your order.</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-2 lg:ml-auto">
                                                {order.agent.phone && (
                                                    <Button size="sm" variant="outline" className="rounded-full border-orange-200 text-[#F58220] hover:bg-orange-50" asChild>
                                                        <a href={`tel:${order.agent.phone}`}>
                                                            <Phone className="h-4 w-4 mr-2" />
                                                            Call Agent
                                                        </a>
                                                    </Button>
                                                )}
                                                <Button size="sm" className="rounded-full bg-[#F58220] hover:bg-[#E57210]" asChild>
                                                    <Link href={`/account/messages?order=${order.id}`}>
                                                        <MessageSquare className="h-4 w-4 mr-2" />
                                                        Message Agent
                                                    </Link>
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Rider Info if exists */}
                                {order.rider && (
                                    <div className="mb-8 p-4 bg-gray-50 dark:bg-zinc-800 rounded-xl flex items-center gap-4 border border-gray-100 dark:border-zinc-700">
                                        <div className="h-14 w-14 rounded-full bg-orange-100 flex items-center justify-center text-[#F58220] overflow-hidden">
                                            {order.rider.avatar_url ? (
                                                <Image src={order.rider.avatar_url} alt="Rider" width={56} height={56} className="h-full w-full object-cover" />
                                            ) : (
                                                <User className="h-7 w-7" />
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-bold text-gray-900 dark:text-white text-lg">{order.rider.full_name || "Assigned Rider"}</h4>
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 uppercase tracking-wide">Verified</span>
                                            </div>
                                            <p className="text-sm text-gray-500">Your delivery partner</p>
                                        </div>
                                        {order.rider.phone && (
                                            <Button size="sm" className="rounded-full bg-[#F58220] hover:bg-[#E57210]" asChild>
                                                <a href={`tel:${order.rider.phone}`}>
                                                    <Phone className="h-4 w-4 mr-2" />
                                                    Call Rider
                                                </a>
                                            </Button>
                                        )}
                                    </div>
                                )}

                                {/* Timeline */}
                                <div className="space-y-8 relative pl-4">
                                    <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-gray-100 dark:bg-zinc-800" />
                                    {steps.map((step, idx) => {
                                        const status = getStepStatus(step.status)
                                        return (
                                            <div key={idx} className="flex gap-4 items-start relative z-10">
                                                <div className={cn(
                                                    "h-6 w-6 rounded-full flex items-center justify-center shrink-0 border-2",
                                                    status === 'completed' ? "bg-green-500 border-green-500 text-white" :
                                                        status === 'current' ? "bg-white dark:bg-zinc-900 border-[#F58220] text-[#F58220]" :
                                                            "bg-gray-100 dark:bg-zinc-800 border-transparent text-gray-300"
                                                )}>
                                                    {status === 'completed' && <CheckCircle2 className="h-3 w-3" />}
                                                    {status === 'current' && <div className="h-2 w-2 rounded-full bg-[#F58220]" />}
                                                </div>
                                                <div>
                                                    <h4 className={cn(
                                                        "text-sm font-bold",
                                                        status === 'completed' || status === 'current' ? "text-gray-900 dark:text-white" : "text-gray-400"
                                                    )}>
                                                        {step.label}
                                                    </h4>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </CardContent>
                        </Card>

                        {/* 3. Items List */}
                        <Card className="border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
                            <CardHeader>
                                <CardTitle>Items</CardTitle>
                            </CardHeader>
                            <CardContent className="divide-y divide-gray-50 dark:divide-zinc-800">
                                {order.order_items.map((item) => (
                                    <div key={item.id} className="py-4">
                                        <div className="flex gap-4">
                                            <div className="h-16 w-16 bg-gray-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center overflow-hidden shrink-0">
                                                {item.products?.image_url ?
                                                    <Image src={item.products.image_url} alt={item.products.name ?? "Product"} width={64} height={64} className="h-full w-full object-cover" />
                                                    : <Package className="h-8 w-8 text-gray-400" />
                                                }
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h4 className="font-bold text-gray-900 dark:text-white">{item.products?.name}</h4>
                                                        <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                                                    </div>
                                                    <p className="text-sm font-bold text-[#F58220]">{formatKobo(item.total_price ?? item.price_per_unit * item.quantity)}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>

                        {/* 4. Delivery Address */}
                        <Card className="border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
                            <CardHeader>
                                <CardTitle>Delivery Details</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-start gap-3">
                                    <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                                    <div>
                                        <h4 className="font-medium text-gray-900 dark:text-white">Delivery Address</h4>
                                        <p className="text-gray-500 text-sm mt-1">
                                            {user ? order.delivery_location?.address || "Address details hidden" : "Address details hidden"}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                    </main>
                </div>
            </div>
        </div>
    )
}
