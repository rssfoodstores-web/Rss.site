import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AdminTrackingClient } from "./AdminTrackingClient"

export default async function AdminTrackingPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect("/login")
    const { data: role } = await supabase.rpc("get_my_role")
    if (!role || !["admin", "sub_admin", "supa_admin"].includes(String(role))) redirect("/account")

    const { data: orders } = await supabase
        .from("orders")
        .select("id,status,delivery_location,rider_id,merchant_id,rider:rider_id(id,full_name,location),merchant:merchant_id(id,full_name,address,location)")
        .in("status", ["ready_for_pickup", "out_for_delivery", "return_in_transit"])
        .not("rider_id", "is", null)
        .order("created_at", { ascending: false })

    return <AdminTrackingClient orders={(orders ?? []) as unknown as Parameters<typeof AdminTrackingClient>[0]["orders"]} />
}

