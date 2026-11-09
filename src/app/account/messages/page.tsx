import { OrderMessagesWorkspace } from "@/components/messages/OrderMessagesWorkspace"

export default function AccountMessagesPage({
    searchParams,
}: {
    searchParams: Promise<{ order?: string; channel?: string }>
}) {
    return (
        <div className="container mx-auto px-4 py-6 sm:px-6">
            <OrderMessagesWorkspace workspace="customer" searchParams={searchParams} />
        </div>
    )
}
