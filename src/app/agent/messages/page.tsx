import { OrderMessagesWorkspace } from "@/components/messages/OrderMessagesWorkspace"

export default function AgentMessagesPage({
    searchParams,
}: {
    searchParams: Promise<{ order?: string; channel?: string }>
}) {
    return <OrderMessagesWorkspace workspace="agent" searchParams={searchParams} />
}
