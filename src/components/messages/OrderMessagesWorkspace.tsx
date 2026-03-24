import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { OrderMessagesClient } from "@/components/messages/OrderMessagesClient"
import {
    getDefaultChatChannel,
    type ChatWorkspace,
    type OrderChatChannel,
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
    const selectedThread =
        threads.find((thread) => thread.order_id === requestedOrderId) ??
        threads[0] ??
        null
    const workspaceDefaultChannel = getDefaultChatChannel(workspace)
    const requestedChannelValue = requestedChannel === "ops" || requestedChannel === "customer"
        ? requestedChannel
        : null
    const selectedChannel = selectedThread
        ? ((requestedChannelValue && selectedThread.accessible_channels.includes(requestedChannelValue as OrderChatChannel)
            ? requestedChannelValue
            : selectedThread.accessible_channels.includes(workspaceDefaultChannel)
                ? workspaceDefaultChannel
                : selectedThread.accessible_channels[0] ?? "customer") as OrderChatChannel)
        : workspaceDefaultChannel

    let messages: OrderChatMessage[] = []
    let participants: OrderChatParticipant[] = []
    let messagesError: string | null = null
    let participantsError: string | null = null

    if (selectedThread) {
        const [
            { data: messagesData, error: nextMessagesError },
            { data: participantsData, error: nextParticipantsError },
        ] = await Promise.all([
            supabase.rpc("get_order_chat_messages", {
                p_order_id: selectedThread.order_id,
                p_channel: selectedChannel,
            }),
            supabase.rpc("get_order_chat_participants", {
                p_order_id: selectedThread.order_id,
                p_channel: selectedChannel,
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
            selectedOrderId={selectedThread?.order_id ?? null}
            selectedChannel={selectedChannel}
            messages={messages}
            participants={participants}
            threadsError={threadsError?.message ?? null}
            messagesError={messagesError}
            participantsError={participantsError}
        />
    )
}
