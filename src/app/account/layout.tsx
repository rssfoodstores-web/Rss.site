import { AccountWorkspaceShell } from "@/components/account/AccountWorkspaceShell"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { RouteRefreshBridge } from "@/components/realtime/RouteRefreshBridge"

export const metadata: Metadata = {
    robots: {
        follow: false,
        index: false,
    },
}

export default async function AccountLayout({
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

    return (
        <>
            <RouteRefreshBridge
                channelName={`account-orders-${user.id}`}
                subscriptions={[
                    { table: "notifications", filter: `user_id=eq.${user.id}` },
                    {
                        table: "orders",
                        filter: `customer_id=eq.${user.id}`,
                    },
                ]}
            />
            <AccountWorkspaceShell role="customer" name={user.user_metadata?.full_name} avatarUrl={user.user_metadata?.avatar_url}>{children}</AccountWorkspaceShell>
        </>
    )
}
