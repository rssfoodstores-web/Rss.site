import { createClient } from "@/lib/supabase/server"
import { notFound, redirect } from "next/navigation"
import { OrderDetailClient } from "./OrderDetailClient"

// Force recompile

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect("/login")
    }

    // Fetch Order
    const { data: order } = await supabase
        .from("orders")
        .select(`
            *,
            order_items (
                *,
                products (
                    id,
                    name,
                    price,
                    image_url
                )
            ),
            rider:rider_id (
                full_name,
                phone,
                avatar_url
            ),
            agent:assigned_agent_id (
                full_name,
                phone,
                avatar_url
            )
        `)
        .eq("id", id)
        .eq("customer_id", user.id) // Security check
        .single()

    if (!order) {
        return notFound()
    }

    return (
        <OrderDetailClient order={order} user={user} />
    )
}
