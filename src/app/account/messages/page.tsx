import { AccountWorkspaceShell } from "@/components/account/AccountWorkspaceShell"
import { OrderMessagesWorkspace } from "@/components/messages/OrderMessagesWorkspace"

export default function AccountMessagesPage({
    searchParams,
}: {
    searchParams: Promise<{ order?: string; channel?: string }>
}) {
    return (
        <AccountWorkspaceShell>
            <OrderMessagesWorkspace workspace="customer" searchParams={searchParams} />
        </AccountWorkspaceShell>
    )
}
