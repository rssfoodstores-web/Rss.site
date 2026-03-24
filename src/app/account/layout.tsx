import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { RouteRefreshBridge } from "@/components/realtime/RouteRefreshBridge"

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
                    {
                        table: "orders",
                        filter: `customer_id=eq.${user.id}`,
                    },
                ]}
            />
            {children}
        </>
    )
}
