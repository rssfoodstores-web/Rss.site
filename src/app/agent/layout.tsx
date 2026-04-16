import type { Metadata } from "next"
import { redirect } from "next/navigation"
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

    return (
        <AccountWorkspaceShell>
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
                    {children}
                </>
            )}
        </AccountWorkspaceShell>
    )
}
