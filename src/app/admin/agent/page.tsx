import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { saveAgentAssignmentSettings } from "./actions"
import { assignWaitingOrder } from "../agent-assignments/actions"

export default async function AdminAgentPage({ searchParams }: {
    searchParams: Promise<{ result?: string; settings?: string }>
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect("/login")
    const { data: role } = await supabase.rpc("get_my_role")
    if (!["admin", "sub_admin", "supa_admin"].includes(String(role))) redirect("/account")

    const canEdit = role === "admin" || role === "supa_admin"
    const [ordersResult, agentsResult, settingsResult, params] = await Promise.all([
        supabase.from("orders").select("id,created_at,merchant:merchant_id(full_name,address)")
            .eq("status", "awaiting_agent_acceptance").eq("payment_status", "paid")
            .is("assigned_agent_id", null).order("created_at", { ascending: true }).limit(100),
        supabase.rpc("list_agents_ready_for_assignment"),
        supabase.from("agent_assignment_settings")
            .select("coverage_radius_km,active_order_limit,offer_timeout_seconds").eq("singleton", true).single(),
        searchParams,
    ])
    const { data: orders, error: orderError } = ordersResult
    const { data: agents, error: agentError } = agentsResult
    const { data: settings } = settingsResult
    const { result } = params
    const queue = (orders ?? []) as Array<{ id: string; created_at: string; merchant: { full_name: string | null; address: string | null } | { full_name: string | null; address: string | null }[] | null }>
    const availableAgents = (agents ?? []) as Array<{ agent_id: string; name: string }>

    return (
        <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
            {canEdit && <Link href="/admin/settings" className="text-sm underline underline-offset-4">Platform settings</Link>}
            <h1 className="text-2xl font-bold">Agent</h1>
            <section className="space-y-3 rounded-2xl border bg-card p-4 sm:p-5" aria-labelledby="agent-settings-title">
                <h2 id="agent-settings-title" className="text-lg font-semibold">Order assignment settings</h2>
                {params.settings === "saved" && <p role="status" className="text-sm">Assignment settings saved.</p>}
                {params.settings === "error" && <p role="alert" className="text-sm text-destructive">Settings couldn’t be saved. Check the values and try again.</p>}
                {settings ? (
                    <form action={saveAgentAssignmentSettings} className="space-y-4">
                        <fieldset disabled={!canEdit} className="grid gap-4 sm:grid-cols-3">
                            <label className="grid content-start gap-1 text-sm font-medium">Pickup coverage (km)
                                <input name="radius" type="number" min="1" max="100" required defaultValue={settings.coverage_radius_km} className="min-h-11 w-full rounded-lg border bg-background px-3" />
                                <span className="text-xs font-normal text-muted-foreground">Distance from the agent’s pin to the merchant pickup.</span>
                            </label>
                            <label className="grid content-start gap-1 text-sm font-medium">Maximum active orders
                                <input name="capacity" type="number" min="1" max="100" required defaultValue={settings.active_order_limit} className="min-h-11 w-full rounded-lg border bg-background px-3" />
                                <span className="text-xs font-normal text-muted-foreground">Includes outstanding offers.</span>
                            </label>
                            <label className="grid content-start gap-1 text-sm font-medium">Time to accept (seconds)
                                <input name="timeout" type="number" min="30" max="900" required defaultValue={settings.offer_timeout_seconds} className="min-h-11 w-full rounded-lg border bg-background px-3" />
                                <span className="text-xs font-normal text-muted-foreground">Applies to new offers.</span>
                            </label>
                        </fieldset>
                        {canEdit && <Button type="submit">Save settings</Button>}
                    </form>
                ) : <p role="alert" className="text-sm">Settings couldn’t load. Refresh to try again.</p>}
            </section>
            <h2 className="text-lg font-semibold">Orders waiting for an agent</h2>
            <p className="text-sm text-muted-foreground">Paid orders waiting for an agent. Choose an on-duty agent who can handle the pickup.</p>
            {result === "assigned" && <p role="status" className="rounded-xl border bg-card p-3 text-sm">Order offered to the agent.</p>}
            {result === "unavailable" && <p role="alert" className="rounded-xl border bg-card p-3 text-sm">The order or agent is no longer available. Check the list and try again.</p>}
            {(orderError || agentError) && <p role="alert" className="rounded-xl border bg-card p-3 text-sm">Some assignment data couldn’t load. Refresh to try again.</p>}
            {!orderError && queue.length === 0 && <p className="rounded-xl border bg-card p-4 text-sm">No paid orders are waiting.</p>}
            {!agentError && queue.length > 0 && availableAgents.length === 0 && <p className="rounded-xl border bg-card p-4 text-sm">No on-duty agents with a confirmed pin and available capacity.</p>}
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
