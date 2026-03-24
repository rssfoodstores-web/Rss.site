"use client"

import { useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

export function OrderNotifications({ merchantId }: { merchantId: string }) {
    const router = useRouter()
    const supabase = createClient()

    useEffect(() => {
        if (!merchantId) return

        console.log("Subscribing to order updates for merchant:", merchantId)

        // Subscribe to NEW records in order_items that belong to this merchant
        // We can't directly filter order_items by merchant_id easily in Realtime if the column is on product...
        // Wait, products table has merchant_id. order_items has product_id.
        // Supabase Realtime doesn't support deep joins.

        // Strategy: Subscribe to all INSERT on order_items. 
        // Then fetch the product to see if it belongs to this merchant. 
        // This is a bit noisy but works.
        // BETTER: Use a Postgres Function or Trigger that inserts into a 'notifications' table?
        // OR: Just listen to 'orders' and check if we are the merchant? No, order doesn't have merchant_id.

        // SIMPLEST VALID APPROACH GIVEN DEADLINE:
        // Listen to 'order_items' INSERT. 
        // When we get an event, we check if the product_id belongs to us.

        const channel = supabase
            .channel('merchant-order-notifications')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'order_items'
                },
                async (payload: { new: { product_id: string; quantity: number } }) => {
                    console.log('New Order Item:', payload)
                    const newItem = payload.new as any

                    // Check if this item matches our merchant's products
                    const { data: product } = await supabase
                        .from('products')
                        .select('merchant_id, name')
                        .eq('id', newItem.product_id)
                        .single()

                    if (product && product.merchant_id === merchantId) {
                        // It's for us!
                        const audio = new Audio('/notification.mp3') // You need a sound file
                        audio.play().catch(() => { }) // Ignore auto-play errors

                        toast.success("New Order Received!", {
                            description: `${product.name} x${newItem.quantity}`,
                            action: {
                                label: "View",
                                onClick: () => router.refresh()
                            },
                            duration: 8000
                        })
                        router.refresh()
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [merchantId, supabase, router])

    return null // Invisible component
}
