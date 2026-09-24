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

    // Fetch the order and its customer-only delivery secret separately. The
    // secret is never stored on the rider-readable orders row.
    const [{ data: order }, { data: deliverySecret }] = await Promise.all([
        supabase
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
            .eq("customer_id", user.id)
            .single(),
        supabase
            .from("order_delivery_secrets")
            .select("delivery_code")
            .eq("order_id", id)
            .eq("customer_id", user.id)
            .maybeSingle(),
    ])

    if (!order) {
        return notFound()
    }

    return (
        <OrderDetailClient
            order={{ ...order, delivery_code: deliverySecret?.delivery_code ?? null }}
            user={user}
        />
    )
}
