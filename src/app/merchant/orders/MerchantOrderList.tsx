"use client"

import { createClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import Link from "next/link"
import { Clock, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatOrderStatus, getOrderOperationalHint, getOrderStatusTone } from "@/lib/orders"

interface MerchantOrderListProps {
    orders: {
        id: string
        customer: string
        date: string
        total: string
        items: number
        status: string
        rider_id?: string
    }[]
    merchantId: string
}

export function MerchantOrderList({ orders, merchantId }: MerchantOrderListProps) {
    const [supabase] = useState(() => createClient())

    useEffect(() => {
        const channel = supabase
            .channel(`merchant-orders-${merchantId}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "orders",
                    filter: `merchant_id=eq.${merchantId}`,
                },
                (payload: {
                    eventType: string
                    new: { id: string; status: string; rider_id: string | null }
                    old: { status: string; rider_id: string | null }
                }) => {
                    if (payload.eventType === "UPDATE") {
                        const newRiderId = payload.new.rider_id
                        const oldRiderId = payload.old.rider_id

                        if (newRiderId && !oldRiderId) {
                            toast.success(`Rider accepted request for Order #${payload.new.id.slice(0, 8)}`)
                        }
                    } else if (payload.eventType === "INSERT") {
                        toast.info("New order received!")
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [merchantId, supabase])

    if (!orders || orders.length === 0) {
        return (
            <div className="p-12 text-center text-gray-400 bg-white dark:bg-zinc-900 rounded-3xl border border-dashed border-gray-200">
                No orders found.
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {orders.map((order) => {
                const statusHint = getOrderOperationalHint(order.status, {
                    riderAssigned: Boolean(order.rider_id),
                })

                return (
                    <div
                        key={order.id}
                        className="group flex flex-col gap-4 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:border-[#F58220]/30 dark:border-zinc-800 dark:bg-zinc-900 sm:p-6"
                    >
                        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex w-full min-w-0 items-center gap-4 sm:w-auto sm:gap-6">
                                <div
                                    className={cn(
                                        "flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.25rem] transition-transform group-hover:scale-110 sm:h-16 sm:w-16 sm:rounded-[1.5rem]",
                                        order.status === "completed" || order.status === "delivered"
                                            ? "bg-green-50 text-green-500"
                                            : order.status === "processing" || order.status === "out_for_delivery"
                                                ? "bg-blue-50 text-blue-500"
                                                : "bg-orange-50 text-[#F58220]"
                                    )}
                                >
                                    <Clock className="h-7 w-7 sm:h-8 sm:w-8" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h4 className="mb-1 text-lg font-black uppercase text-gray-900 dark:text-white sm:text-xl">
                                        #{order.id.slice(0, 8)}
                                    </h4>
                                    <p className="text-gray-400 font-medium text-sm">
                                        Customer: <span className="text-gray-900 dark:text-white">{order.customer}</span> • {order.items} items
                                    </p>
                                </div>
                            </div>

                            <div className="flex w-full flex-col gap-4 sm:w-auto sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                                <div className="text-left sm:text-right">
                                    <p className="mb-1 text-xl font-black text-gray-900 dark:text-white">{order.total}</p>
                                    <p className="text-gray-400 text-sm font-bold uppercase tracking-widest">{order.date}</p>
                                </div>
                                <div className="flex items-center justify-between gap-4 sm:justify-start">
                                    <span
                                        className={cn(
                                            "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border",
                                            getOrderStatusTone(order.status)
                                        )}
                                    >
                                        {formatOrderStatus(order.status)}
                                    </span>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="rounded-xl hover:bg-orange-50 text-gray-300 hover:text-[#F58220]"
                                        asChild
                                    >
                                        <Link href={`/merchant/orders/${order.id}`}>
                                            <Eye className="h-6 w-6" />
                                        </Link>
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {statusHint && (
                            <div className="rounded-2xl bg-gray-50 dark:bg-zinc-800/80 px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                                {statusHint}
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
