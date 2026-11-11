import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { assignWaitingOrder } from "./actions"

export default async function AgentAssignmentsPage({ searchParams }: {
    searchParams: Promise<{ result?: string }>
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect("/login")
    const { data: role } = await supabase.rpc("get_my_role")
    if (!["admin", "sub_admin", "supa_admin"].includes(String(role))) redirect("/account")

    const [{ data: orders, error: orderError }, { data: agents, error: agentError }, { result }] = await Promise.all([
        supabase.from("orders").select("id,created_at,merchant:merchant_id(full_name,address)")
            .eq("status", "awaiting_agent_acceptance").eq("payment_status", "paid")
            .is("assigned_agent_id", null).order("created_at", { ascending: true }).limit(100),
        supabase.rpc("list_agents_ready_for_assignment"),
        searchParams,
    ])
    const queue = (orders ?? []) as Array<{ id: string; created_at: string; merchant: { full_name: string | null; address: string | null } | { full_name: string | null; address: string | null }[] | null }>
    const availableAgents = (agents ?? []) as Array<{ agent_id: string; name: string }>

    return (
        <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
            <h1 className="text-2xl font-bold">Agent assignments</h1>
            <p className="text-sm text-muted-foreground">Paid orders waiting for an agent. Choose an on-duty agent who can handle the pickup.</p>
            {result === "assigned" && <p role="status" className="rounded-xl border bg-card p-3 text-sm">Order offered to the agent.</p>}
            {result === "unavailable" && <p role="alert" className="rounded-xl border bg-card p-3 text-sm">The order or agent is no longer available. Check the list and try again.</p>}
            {(orderError || agentError) && <p role="alert" className="rounded-xl border bg-card p-3 text-sm">Some assignment data couldn’t load. Refresh to try again.</p>}
            {!orderError && queue.length === 0 && <p className="rounded-xl border bg-card p-4 text-sm">No paid orders are waiting.</p>}
            {!agentError && queue.length > 0 && availableAgents.length === 0 && <p className="rounded-xl border bg-card p-4 text-sm">No on-duty agents with a confirmed pin. Ask an approved agent to set their pin and go on duty.</p>}
            <ul className="space-y-3">
                {queue.map((order) => {
                    const merchant = Array.isArray(order.merchant) ? order.merchant[0] : order.merchant
                    const orderLabel = order.id.slice(0, 8).toUpperCase()
                    return (
                        <li key={order.id} className="space-y-3 rounded-xl border bg-card p-4">
                            <div><h2 className="font-semibold">Order #{orderLabel}</h2><p className="text-sm text-muted-foreground">
                                {[merchant?.full_name, merchant?.address].filter(Boolean).join(" · ") || "Pickup details unavailable"}
                            </p></div>
                            {availableAgents.length > 0 && !agentError && (
                                <form action={assignWaitingOrder} className="flex flex-wrap items-end gap-2">
                                    <input name="orderId" type="hidden" value={order.id} />
                                    <label className="grid gap-1 text-sm">
                                        Choose an agent for order #{orderLabel}
                                        <select name="agentId" required defaultValue="" className="min-h-11 min-w-0 rounded-lg border bg-background px-3">
                                            <option value="" disabled>Select agent</option>
                                            {availableAgents.map((agent) => <option key={agent.agent_id} value={agent.agent_id}>{agent.name}</option>)}
                                        </select>
                                    </label>
                                    <Button type="submit">Offer order</Button>
                                </form>
                            )}
                        </li>
                    )
                })}
            </ul>
        </main>
    )
}
