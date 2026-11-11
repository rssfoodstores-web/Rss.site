import { OrderMessagesWorkspace } from "@/components/messages/OrderMessagesWorkspace"

export default function AccountMessagesPage({
    searchParams,
}: {
    searchParams: Promise<{ order?: string; channel?: string }>
}) {
    return <OrderMessagesWorkspace workspace="customer" searchParams={searchParams} />
}
