import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { AgentWorkingLocation } from "@/components/agent/AgentWorkingLocation"
import { AccountInProcess } from "@/components/access/AccountInProcess"
import { AccountWorkspaceShell } from "@/components/account/AccountWorkspaceShell"
import { RouteRefreshBridge } from "@/components/realtime/RouteRefreshBridge"
import { createClient } from "@/lib/supabase/server"
import { getOperationalApprovalStatus } from "@/lib/operationalAccess"

export const metadata: Metadata = {
    robots: {
        follow: false,
        index: false,
    },
}

export default async function AgentLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect("/login")
    }

    const approvalStatus = await getOperationalApprovalStatus(supabase, "agent", user.id)

    const workingLocation = approvalStatus === "approved"
        ? await supabase.from("agent_work_settings").select("latitude,longitude,accuracy_metres,on_duty").eq("agent_id", user.id).maybeSingle()
        : null

    return (
        <AccountWorkspaceShell role="agent" approved={approvalStatus === "approved"} name={user.user_metadata?.full_name} avatarUrl={user.user_metadata?.avatar_url}>
            {approvalStatus !== "approved" ? (
                <AccountInProcess roleLabel="agent" status={approvalStatus} embedded />
            ) : (
                <>
                    <RouteRefreshBridge
                        channelName={`agent-live-${user.id}`}
                        subscriptions={[
                            {
                                table: "orders",
                                filter: `assigned_agent_id=eq.${user.id}`,
                            },
                            {
                                table: "notifications",
                                filter: `user_id=eq.${user.id}`,
                            },
                        ]}
                    />
                    <AgentWorkingLocation settings={workingLocation?.data ?? null} unavailable={Boolean(workingLocation?.error)} />
                    {children}
                </>
            )}
        </AccountWorkspaceShell>
    )
}
