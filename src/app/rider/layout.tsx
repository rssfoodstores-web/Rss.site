import { AccountInProcess } from "@/components/access/AccountInProcess"
import { AccountWorkspaceShell } from "@/components/account/AccountWorkspaceShell"
import { RouteRefreshBridge } from "@/components/realtime/RouteRefreshBridge"
import { createClient } from "@/lib/supabase/server"
import { getOperationalApprovalStatus } from "@/lib/operationalAccess"
import { redirect } from "next/navigation"

export default async function RiderLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect("/login")
    }

    const approvalStatus = await getOperationalApprovalStatus(supabase, "rider", user.id)

    return (
        <AccountWorkspaceShell>
            {approvalStatus !== "approved" ? (
                <AccountInProcess roleLabel="rider" status={approvalStatus} embedded />
            ) : (
                <>
                    <RouteRefreshBridge
                        channelName={`rider-live-${user.id}`}
                        subscriptions={[
                            {
                                table: "orders",
                                filter: `rider_id=eq.${user.id}`,
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
