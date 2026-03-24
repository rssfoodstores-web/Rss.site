import { OrderMessagesWorkspace } from "@/components/messages/OrderMessagesWorkspace"

export default function MerchantMessagesPage({
    searchParams,
}: {
    searchParams: Promise<{ order?: string; channel?: string }>
}) {
    return <OrderMessagesWorkspace workspace="merchant" searchParams={searchParams} />
}
