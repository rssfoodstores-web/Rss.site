import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { AccountInProcess } from "@/components/access/AccountInProcess"
import { AccountWorkspaceShell } from "@/components/account/AccountWorkspaceShell"
import { MerchantRealtimeBridge } from "@/components/merchant/MerchantRealtimeBridge"
import { createClient } from "@/lib/supabase/server"
import { getOperationalApprovalStatus } from "@/lib/operationalAccess"

export const metadata: Metadata = {
    robots: {
        follow: false,
        index: false,
    },
}

export default async function MerchantLayout({
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

    const approvalStatus = await getOperationalApprovalStatus(supabase, "merchant", user.id)

    return (
        <AccountWorkspaceShell>
            {approvalStatus !== "approved" ? (
                <AccountInProcess roleLabel="merchant" status={approvalStatus} embedded />
            ) : (
                <>
                    <MerchantRealtimeBridge merchantId={user.id} />
                    {children}
                </>
            )}
        </AccountWorkspaceShell>
    )
}
