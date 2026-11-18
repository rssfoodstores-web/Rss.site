import { redirect } from "next/navigation"
import { CustomerAccount } from "@/components/account/AccountUpdates"
import { createClient } from "@/lib/supabase/server"
import { PromotionPlacement } from "@/components/promotions/PromotionPlacement"

export default async function AccountPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect("/login")

    const [{ data: profile }, { data: updates }, { data: orders }] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
        supabase.from("notifications").select("*").eq("user_id", user.id)
            .or("read.is.null,read.eq.false").order("created_at", { ascending: false }).limit(12),
        supabase.from("orders").select("id,status").eq("customer_id", user.id)
            .in("status", ["awaiting_agent_acceptance", "awaiting_merchant_confirmation", "processing", "ready_for_pickup", "out_for_delivery", "rescheduled"])
            .order("created_at", { ascending: false }).limit(20),
    ])

    return <div className="space-y-5"><PromotionPlacement placement="customer_overview" /><CustomerAccount name={profile?.full_name?.trim().split(/\s+/)[0] || "there"} updates={updates ?? []} orders={orders ?? []} /></div>
}
