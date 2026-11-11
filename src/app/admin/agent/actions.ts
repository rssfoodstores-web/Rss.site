"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export async function saveAgentAssignmentSettings(form: FormData) {
    const radius = Number(form.get("radius"))
    const capacity = Number(form.get("capacity"))
    const timeout = Number(form.get("timeout"))
    if (![radius, capacity, timeout].every(Number.isInteger) ||
        radius < 1 || radius > 100 || capacity < 1 || capacity > 100 || timeout < 30 || timeout > 900) {
        redirect("/admin/agent?settings=error")
    }

    const supabase = await createClient()
    const { data: role } = await supabase.rpc("get_my_role")
    if (role !== "admin" && role !== "supa_admin") redirect("/admin/agent")

    const { data, error } = await supabase.from("agent_assignment_settings")
        .update({ coverage_radius_km: radius, active_order_limit: capacity, offer_timeout_seconds: timeout })
        .eq("singleton", true).select("singleton").single()
    revalidatePath("/admin/agent")
    redirect(!error && data ? "/admin/agent?settings=saved" : "/admin/agent?settings=error")
}
