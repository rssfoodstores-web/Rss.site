"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

export async function assignWaitingOrder(form: FormData) {
    const orderId = form.get("orderId")
    const agentId = form.get("agentId")
    const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
    if (typeof orderId !== "string" || typeof agentId !== "string" || !uuid.test(orderId) || !uuid.test(agentId)) {
        redirect("/admin/agent-assignments?result=unavailable")
    }

    const supabase = await createClient()
    const { data, error } = await supabase.rpc("assign_waiting_order_to_agent", { p_order_id: orderId, p_agent_id: agentId })
    revalidatePath("/admin/agent-assignments")
    redirect(`/admin/agent-assignments?result=${!error && data?.success ? "assigned" : "unavailable"}`)
}
