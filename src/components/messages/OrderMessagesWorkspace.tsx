import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { OrderMessagesClient } from "@/components/messages/OrderMessagesClient"
import {
    getDefaultChatChannel,
    type ChatWorkspace,
    type OrderChatMessage,
    type OrderChatParticipant,
    type OrderChatThread,
} from "@/lib/orderChat"

interface OrderMessagesWorkspaceProps {
    workspace: ChatWorkspace
    searchParams: Promise<{ order?: string; channel?: string }>
}

export async function OrderMessagesWorkspace({
    workspace,
    searchParams,
}: OrderMessagesWorkspaceProps) {
    const { order: requestedOrderId, channel: requestedChannel } = await searchParams
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect("/login")
    }

    const { data: threadsData, error: threadsError } = await supabase.rpc("list_order_chat_threads")
    const threads = ((threadsData ?? []) as unknown as OrderChatThread[])
    const selectedThread = threads.find((thread) => thread.order_id === requestedOrderId)
    const requested = requestedChannel === "ops" || requestedChannel === "customer" ? requestedChannel : null
    const selectedChannel = requested ?? getDefaultChatChannel(workspace)
    const unavailable = Boolean(requestedOrderId && (!selectedThread ||
        (requestedChannel && !requested) ||
        (requested && !selectedThread.accessible_channels.includes(requested))))
    const availableChannel = selectedThread?.accessible_channels.includes(selectedChannel)
        ? selectedChannel : selectedThread?.accessible_channels[0] ?? selectedChannel

    let messages: OrderChatMessage[] = []
    let participants: OrderChatParticipant[] = []
    let messagesError: string | null = null
    let participantsError: string | null = null

    if (selectedThread && !unavailable) {
        const [
            { data: messagesData, error: nextMessagesError },
            { data: participantsData, error: nextParticipantsError },
        ] = await Promise.all([
            supabase.rpc("get_order_chat_messages", {
                p_order_id: selectedThread.order_id,
                p_channel: availableChannel,
            }),
            supabase.rpc("get_order_chat_participants", {
                p_order_id: selectedThread.order_id,
                p_channel: availableChannel,
            }),
        ])

        messages = ((messagesData ?? []) as unknown as OrderChatMessage[])
        participants = ((participantsData ?? []) as unknown as OrderChatParticipant[])
        messagesError = nextMessagesError?.message ?? null
        participantsError = nextParticipantsError?.message ?? null
    }

    return (
        <OrderMessagesClient
            workspace={workspace}
            currentUserId={user.id}
            threads={threads}
            selectedOrderId={unavailable ? null : selectedThread?.order_id ?? null}
            unavailable={unavailable}
            selectedChannel={availableChannel}
            messages={messages}
            participants={participants}
            threadsError={threadsError?.message ?? null}
            messagesError={messagesError}
            participantsError={participantsError}
        />
    )
}
