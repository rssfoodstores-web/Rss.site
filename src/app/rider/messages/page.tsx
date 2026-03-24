import { OrderMessagesWorkspace } from "@/components/messages/OrderMessagesWorkspace"

export default function RiderMessagesPage({
    searchParams,
}: {
    searchParams: Promise<{ order?: string; channel?: string }>
}) {
    return <OrderMessagesWorkspace workspace="rider" searchParams={searchParams} />
}
