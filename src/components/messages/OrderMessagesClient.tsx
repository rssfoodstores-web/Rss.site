"use client"

import Link from "next/link"
import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowRight, ChevronDown, ChevronUp, Inbox, Menu, MessageSquare, Phone, Send, Users } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Sheet,
    SheetClose,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { markOrderChatRead, sendOrderMessage } from "@/app/actions/messageActions"
import { createClient } from "@/lib/supabase/client"
import {
    formatChatChannelLabel,
    formatChatRoleLabel,
    getDefaultChatChannel,
    getChatWorkspaceCopy,
    getOrderDetailHref,
    getOrderMessagesHref,
    getThreadParticipantSummary,
    type ChatWorkspace,
    type OrderChatChannel,
    type OrderChatMessage,
    type OrderChatParticipant,
    type OrderChatThread,
} from "@/lib/orderChat"
import { formatKobo } from "@/lib/money"
import { formatOrderStatus, getOrderStatusTone } from "@/lib/orders"
import { cn } from "@/lib/utils"

interface OrderMessagesClientProps {
    workspace: ChatWorkspace
    currentUserId: string
    threads: OrderChatThread[]
    selectedOrderId: string | null
    selectedChannel: OrderChatChannel
    messages: OrderChatMessage[]
    participants: OrderChatParticipant[]
    threadsError: string | null
    messagesError: string | null
    participantsError: string | null
}

function getWorkspaceOrdersHref(workspace: ChatWorkspace) {
    switch (workspace) {
        case "customer":
            return "/account/orders"
        case "merchant":
            return "/merchant/orders"
        case "agent":
            return "/agent/orders"
        case "rider":
            return "/rider/deliveries"
    }
}

function formatStamp(value: string | null) {
    if (!value) {
        return "-"
    }

    return new Date(value).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })
}

function formatShortStamp(value: string | null) {
    if (!value) {
        return ""
    }

    const date = new Date(value)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()

    if (isToday) {
        return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    }

    return date.toLocaleDateString([], { month: "short", day: "numeric" })
}

function initials(name: string | null) {
    return name
        ? name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("")
        : "?"
}

function getChannelUnreadCount(thread: OrderChatThread, channel: OrderChatChannel) {
    return channel === "ops" ? thread.ops_unread_count : thread.customer_unread_count
}

function getParticipantDisplayName(participant: OrderChatParticipant) {
    if (participant.is_current_user) {
        return "You"
    }

    return participant.full_name ?? formatChatRoleLabel(participant.role)
}

export function OrderMessagesClient({
    workspace,
    currentUserId,
    threads,
    selectedOrderId,
    selectedChannel,
    messages,
    participants,
    threadsError,
    messagesError,
    participantsError,
}: OrderMessagesClientProps) {
    const router = useRouter()
    const supabase = useRef(createClient()).current
    const [draft, setDraft] = useState("")
    const [sending, setSending] = useState(false)
    const [showParticipants, setShowParticipants] = useState(false)
    const [, startTransition] = useTransition()
    const endRef = useRef<HTMLDivElement | null>(null)
    const lastReadKey = useRef<string | null>(null)
    const copy = getChatWorkspaceCopy(workspace)
    const selectedThread = threads.find((thread) => thread.order_id === selectedOrderId) ?? null
    const selectedChannelUnreadCount = selectedThread ? getChannelUnreadCount(selectedThread, selectedChannel) : 0
    const unreadThreads = threads.filter((thread) => thread.unread_count > 0).length
    const unreadMessages = threads.reduce((sum, thread) => sum + thread.unread_count, 0)
    const otherParticipants = participants.filter((participant) => !participant.is_current_user)
    const talkingToSummary = otherParticipants.length
        ? otherParticipants
            .map((participant) => `${formatChatRoleLabel(participant.role)}: ${participant.full_name ?? "Pending"}`)
            .join(" | ")
        : "No one else yet."

    useEffect(() => {
        const channel = supabase.channel(`order-messages-${workspace}-${currentUserId}`)

        channel.on(
            "postgres_changes",
            { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${currentUserId}` },
            () => {
                startTransition(() => router.refresh())
            }
        )

        channel.on(
            "postgres_changes",
            { event: "*", schema: "public", table: "order_messages" },
            () => {
                startTransition(() => router.refresh())
            }
        )

        channel.subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [currentUserId, router, supabase, startTransition, workspace])

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages, selectedChannel, selectedOrderId])

    useEffect(() => {
        setDraft("")
    }, [selectedChannel, selectedOrderId])

    useEffect(() => {
        if (!selectedThread || selectedChannelUnreadCount < 1) {
            return
        }

        const nextKey = `${selectedThread.order_id}:${selectedChannel}:${selectedChannelUnreadCount}`
        if (lastReadKey.current === nextKey) {
            return
        }

        lastReadKey.current = nextKey

        void markOrderChatRead(selectedThread.order_id, selectedChannel)
            .then((result) => {
                if (!result.success) {
                    lastReadKey.current = null
                    return
                }

                startTransition(() => router.refresh())
            })
            .catch(() => {
                lastReadKey.current = null
            })
    }, [router, selectedChannel, selectedChannelUnreadCount, selectedThread, startTransition])

    async function handleSendMessage(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (!selectedThread || !draft.trim()) {
            return
        }

        setSending(true)

        try {
            const result = await sendOrderMessage(selectedThread.order_id, selectedChannel, draft)
            if (!result.success) {
                toast.error(result.message ?? "Message could not be sent.")
                return
            }

            setDraft("")
            startTransition(() => router.refresh())
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Message could not be sent.")
        } finally {
            setSending(false)
        }
    }

    const renderThreadList = (closeOnSelect = false) => (
        <>
            <div className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                Order Threads
            </div>
            <div className="max-h-[520px] overflow-y-auto xl:max-h-[calc(560px-36px)]">
                {threads.map((thread) => {
                    const threadLink = (
                        <Link
                            href={getOrderMessagesHref(
                                workspace,
                                thread.order_id,
                                thread.accessible_channels.includes(selectedChannel)
                                    ? selectedChannel
                                    : thread.accessible_channels[0] ?? getDefaultChatChannel(workspace)
                            )}
                            className={cn(
                                "flex items-start gap-3 border-b border-gray-50 px-4 py-3 transition-colors",
                                thread.order_id === selectedOrderId
                                    ? "bg-orange-50/80 dark:bg-orange-500/10"
                                    : "hover:bg-gray-50 dark:border-zinc-800/50 dark:hover:bg-zinc-900"
                            )}
                        >
                            <div className={cn(
                                "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                                thread.order_id === selectedOrderId
                                    ? "bg-[#F58220] text-white"
                                    : "bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400"
                            )}>
                                #{thread.order_id.slice(0, 4)}
                            </div>

                            <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 truncate">
                                        <span className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                                            {getThreadParticipantSummary(thread, workspace)}
                                        </span>
                                    </div>
                                    <span className="shrink-0 text-[11px] text-gray-400">
                                        {formatShortStamp(thread.last_message_at ?? thread.order_created_at)}
                                    </span>
                                </div>

                                <div className="mt-0.5 flex items-center gap-1.5">
                                    <Badge className={`h-[18px] border px-1.5 text-[10px] leading-none ${getOrderStatusTone(thread.order_status)}`}>
                                        {formatOrderStatus(thread.order_status)}
                                    </Badge>
                                    <span className="text-[11px] text-gray-400">{formatKobo(thread.total_amount)}</span>
                                </div>

                                <p className="mt-1 line-clamp-1 text-xs text-gray-500">
                                    {thread.last_message_preview ?? "No messages yet"}
                                </p>
                            </div>

                            {thread.unread_count > 0 && (
                                <span className="mt-1 flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-[#F58220] px-1.5 text-[11px] font-bold text-white">
                                    {thread.unread_count}
                                </span>
                            )}
                        </Link>
                    )

                    if (closeOnSelect) {
                        return (
                            <SheetClose asChild key={thread.order_id}>
                                {threadLink}
                            </SheetClose>
                        )
                    }

                    return <div key={thread.order_id}>{threadLink}</div>
                })}
            </div>
        </>
    )

    if (threads.length === 0) {
        return (
            <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-2xl border border-orange-100 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-950">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-50 text-[#F58220] dark:bg-orange-500/10">
                    <Inbox className="h-7 w-7" />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">No order chats yet</h2>
                    <p className="mt-1 max-w-md text-sm text-gray-500">{threadsError ?? copy.description}</p>
                </div>
                <Button asChild size="sm" className="bg-[#F58220] hover:bg-[#E57210]">
                    <Link href={getWorkspaceOrdersHref(workspace)}>
                        Open orders
                        <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Link>
                </Button>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-0 overflow-hidden rounded-2xl border border-orange-100 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-3 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <MessageSquare className="h-5 w-5 text-[#F58220]" />
                    <h1 className="text-base font-bold text-gray-900 dark:text-white">{copy.title}</h1>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 sm:justify-end">
                    <span>{threads.length} thread{threads.length !== 1 ? "s" : ""}</span>
                    {unreadMessages > 0 ? (
                        <>
                            <span className="text-gray-300 dark:text-zinc-600">|</span>
                            <span className="font-semibold text-[#F58220]">
                                {unreadMessages} unread in {unreadThreads} thread{unreadThreads !== 1 ? "s" : ""}
                            </span>
                        </>
                    ) : null}
                </div>
            </div>

            {threadsError ? (
                <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-600 dark:bg-red-500/10 dark:text-red-400">
                    {threadsError}
                </div>
            ) : null}

            <div className="grid min-h-[560px] grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)]">
                <div className="border-b border-gray-100 xl:hidden dark:border-zinc-800">
                    <div className="flex items-center justify-between gap-3 px-4 py-3">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">
                                Current thread
                            </p>
                            <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                                {selectedThread ? `#${selectedThread.order_id.slice(0, 8)}` : "Choose a thread"}
                            </p>
                        </div>

                        <Sheet>
                            <SheetTrigger asChild>
                                <Button variant="outline" className="h-10 rounded-xl border-gray-200 px-4 dark:border-zinc-700">
                                    <Menu className="mr-2 h-4 w-4" />
                                    Threads
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="w-[92vw] max-w-sm overflow-y-auto p-0">
                                <SheetHeader className="border-b border-gray-100 px-5 py-5 dark:border-zinc-800">
                                    <SheetTitle>Order threads</SheetTitle>
                                    <SheetDescription>
                                        Switch between conversations without losing the current chat.
                                    </SheetDescription>
                                </SheetHeader>
                                {renderThreadList(true)}
                            </SheetContent>
                        </Sheet>
                    </div>
                </div>

                <div className="hidden border-r border-gray-100 dark:border-zinc-800 xl:block">
                    {renderThreadList()}
                </div>

                {selectedThread ? (
                    <div className="flex min-w-0 flex-col">
                        <div className="border-b border-gray-100 px-4 py-3 dark:border-zinc-800">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-sm font-bold text-gray-900 dark:text-white">
                                            #{selectedThread.order_id.slice(0, 8)}
                                        </span>
                                        <Badge className={`h-[18px] border px-1.5 text-[10px] leading-none ${getOrderStatusTone(selectedThread.order_status)}`}>
                                            {formatOrderStatus(selectedThread.order_status)}
                                        </Badge>
                                    </div>
                                    <p className="mt-0.5 text-xs text-gray-400">{talkingToSummary}</p>
                                </div>

                                <div className="flex flex-col gap-2 sm:items-end">
                                    <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                        {selectedThread.accessible_channels.map((channelOption) => (
                                            <Button
                                                key={channelOption}
                                                asChild
                                                size="sm"
                                                variant={channelOption === selectedChannel ? "default" : "ghost"}
                                                className={cn(
                                                    "h-7 shrink-0 rounded-full px-3 text-xs",
                                                    channelOption === selectedChannel
                                                        ? "bg-[#F58220] text-white hover:bg-[#E57210]"
                                                        : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                                                )}
                                            >
                                                <Link href={getOrderMessagesHref(workspace, selectedThread.order_id, channelOption)}>
                                                    {formatChatChannelLabel(channelOption)}
                                                    {getChannelUnreadCount(selectedThread, channelOption) > 0 ? (
                                                        <span className="ml-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-black/15 px-1 text-[10px] font-bold">
                                                            {getChannelUnreadCount(selectedThread, channelOption)}
                                                        </span>
                                                    ) : null}
                                                </Link>
                                            </Button>
                                        ))}
                                    </div>

                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 gap-1 rounded-full px-2 text-xs text-gray-500"
                                            onClick={() => setShowParticipants((current) => !current)}
                                        >
                                            <Users className="h-3.5 w-3.5" />
                                            {showParticipants ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                        </Button>

                                        <Button asChild variant="ghost" size="sm" className="h-7 rounded-full px-2 text-xs text-gray-500">
                                            <Link href={getOrderDetailHref(workspace, selectedThread.order_id)}>
                                                View order <ArrowRight className="ml-1 h-3 w-3" />
                                            </Link>
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {showParticipants ? (
                            <div className="border-b border-gray-100 bg-gray-50/80 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/50">
                                {participantsError ? (
                                    <p className="text-xs text-red-500">{participantsError}</p>
                                ) : (
                                    <div className="flex flex-wrap gap-3">
                                        {participants.map((participant) => (
                                            <div key={`${participant.profile_id}-${participant.role}`} className="flex items-center gap-2">
                                                <Avatar className="h-7 w-7">
                                                    <AvatarImage src={participant.avatar_url ?? undefined} />
                                                    <AvatarFallback className="bg-[#F58220]/10 text-[10px] text-[#F58220]">
                                                        {initials(participant.full_name)}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="text-xs">
                                                    <span className="font-medium text-gray-900 dark:text-white">
                                                        {getParticipantDisplayName(participant)}
                                                    </span>
                                                    <span className="ml-1 text-gray-400">
                                                        ({formatChatRoleLabel(participant.role)})
                                                    </span>
                                                </div>
                                                {participant.phone ? (
                                                    <a href={`tel:${participant.phone}`} className="text-[#F58220] hover:text-[#E57210]">
                                                        <Phone className="h-3 w-3" />
                                                    </a>
                                                ) : null}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : null}

                        {messagesError ? (
                            <div className="border-b border-red-100 bg-red-50 px-4 py-2 text-xs text-red-600 dark:bg-red-500/10 dark:text-red-400">
                                {messagesError}
                            </div>
                        ) : null}

                        <div
                            className="flex-1 overflow-y-auto bg-gray-50/50 px-4 py-4 dark:bg-black/20"
                            style={{ maxHeight: showParticipants ? "380px" : "420px", minHeight: "300px" }}
                        >
                            {messages.length ? (
                                <div className="space-y-3">
                                    {messages.map((message) => (
                                        <div key={message.id} className={cn("flex", message.is_mine ? "justify-end" : "justify-start")}>
                                            <div
                                                className={cn(
                                                    "max-w-[88%] rounded-2xl px-3.5 py-2.5 shadow-sm sm:max-w-[80%]",
                                                    message.is_mine
                                                        ? "bg-[#F58220] text-white"
                                                        : "bg-white dark:bg-zinc-900"
                                                )}
                                            >
                                                <div
                                                    className={cn(
                                                        "mb-1 flex items-center gap-1.5 text-[11px]",
                                                        message.is_mine ? "text-white/70" : "text-gray-400"
                                                    )}
                                                >
                                                    <span className="font-semibold">
                                                        {message.is_mine ? "You" : message.sender_name ?? formatChatRoleLabel(message.sender_role)}
                                                    </span>
                                                    <span>|</span>
                                                    <span>{formatStamp(message.created_at)}</span>
                                                </div>
                                                <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.body}</p>
                                            </div>
                                        </div>
                                    ))}
                                    <div ref={endRef} />
                                </div>
                            ) : (
                                <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                                    <MessageSquare className="h-8 w-8 text-gray-300 dark:text-zinc-600" />
                                    <p className="text-sm font-medium text-gray-400">No messages yet</p>
                                    <p className="text-xs text-gray-400">Start the conversation below.</p>
                                </div>
                            )}
                        </div>

                        <form onSubmit={handleSendMessage} className="border-t border-gray-100 px-4 py-3 dark:border-zinc-800">
                            <div className="flex items-end gap-2">
                                <Textarea
                                    value={draft}
                                    onChange={(event) => setDraft(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter" && !event.shiftKey) {
                                            event.preventDefault()
                                            if (draft.trim() && !sending) {
                                                void handleSendMessage(event as unknown as React.FormEvent<HTMLFormElement>)
                                            }
                                        }
                                    }}
                                    placeholder={selectedChannel === "ops" ? "Internal ops message..." : "Type a message..."}
                                    className="min-h-[44px] max-h-[100px] flex-1 resize-none rounded-xl border-gray-200 text-sm dark:border-zinc-700"
                                    maxLength={2000}
                                    rows={1}
                                />
                                <Button
                                    type="submit"
                                    size="sm"
                                    className="h-[44px] w-[44px] shrink-0 rounded-xl bg-[#F58220] p-0 hover:bg-[#E57210]"
                                    disabled={sending || draft.trim().length === 0}
                                >
                                    <Send className="h-4 w-4" />
                                </Button>
                            </div>
                            <p className="mt-1.5 text-[11px] text-gray-400">
                                {formatChatChannelLabel(selectedChannel)} | #{selectedThread.order_id.slice(0, 8)}
                                {" | "}Enter to send, Shift+Enter for new line
                            </p>
                        </form>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
                        <MessageSquare className="h-10 w-10 text-gray-200 dark:text-zinc-700" />
                        <p className="text-sm text-gray-500">Select an order thread to start chatting</p>
                    </div>
                )}
            </div>
        </div>
    )
}
