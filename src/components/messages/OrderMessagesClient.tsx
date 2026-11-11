"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowRight, MessageCircle, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { markOrderChatRead, sendOrderMessage } from "@/app/actions/messageActions"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/context/UserContext"
import {
    formatChatChannelLabel, formatChatRoleLabel, getDefaultChatChannel, getMessagesInboxHref,
    getOrderDetailHref, getOrderMessagesHref, type ChatWorkspace, type OrderChatChannel,
    type OrderChatMessage, type OrderChatParticipant, type OrderChatThread,
} from "@/lib/orderChat"
import { formatOrderStatus } from "@/lib/orders"
import { cn } from "@/lib/utils"

interface Props {
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
    unavailable: boolean
}

const orderPaths = { customer: "/account/orders", merchant: "/merchant/orders", agent: "/agent/orders", rider: "/rider/deliveries" }

function unread(thread: OrderChatThread, channel: OrderChatChannel) {
    return channel === "ops" ? thread.ops_unread_count : thread.customer_unread_count
}

function getThreadChannel(thread: OrderChatThread, workspace: ChatWorkspace): OrderChatChannel {
    const latest = thread.last_message_channel
    const channels = thread.accessible_channels
    if (latest && channels.includes(latest) && unread(thread, latest)) return latest
    return channels.find((channel) => unread(thread, channel) > 0) ??
        (latest && channels.includes(latest) ? latest : channels[0] ?? getDefaultChatChannel(workspace))
}

function shortTime(value: string) {
    return new Date(value).toLocaleString("en-NG", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

type PendingMessage = { id: string; body: string; state: "sending" | "failed" | "sent" }

export function OrderMessagesClient({
    workspace, currentUserId, threads, selectedOrderId, selectedChannel,
    messages, participants, threadsError, messagesError, participantsError, unavailable,
}: Props) {
    const router = useRouter()
    const { refreshUnreadCount } = useUser()
    const [supabase] = useState(createClient)
    const [filter, setFilter] = useState<"all" | "unread">("all")
    const [drafts, setDrafts] = useState<Record<string, string>>({})
    const [outbox, setOutbox] = useState<Record<string, PendingMessage>>({})
    const [readError, setReadError] = useState<string | null>(null)
    const [readAttempt, retryRead] = useState(0)
    const [atBottom, setAtBottom] = useState(true)
    const scrollArea = useRef<HTMLDivElement>(null)
    const latestMarker = useRef<HTMLDivElement>(null)
    const scrolledThread = useRef("")
    const nearBottom = useRef(true)
    const lastRead = useRef("")
    const pendingSends = useRef(new Set<string>())
    const thread = threads.find((entry) => entry.order_id === selectedOrderId)
    const conversationKey = thread ? `${thread.order_id}:${selectedChannel}` : ""
    const draft = drafts[conversationKey] ?? ""
    const pending = outbox[conversationKey]
    const pendingVisible = pending && !messages.some((message) => message.id === pending.id)
    const latestId = messages.at(-1)?.id
    const inbox = getMessagesInboxHref(workspace)
    const showConversation = Boolean(thread || unavailable)
    const visibleThreads = threads.filter((entry) => filter === "all" || entry.unread_count > 0)

    useEffect(() => {
        let timer: number | undefined
        function refresh() {
            window.clearTimeout(timer)
            timer = window.setTimeout(() => router.refresh(), 180)
        }
        const channel = supabase.channel(`order-messages-${workspace}-${currentUserId}`)
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "order_messages" }, refresh)
            .subscribe((status: string) => { if (status === "SUBSCRIBED") refresh() })
        window.addEventListener("online", refresh)
        window.addEventListener("focus", refresh)
        return () => {
            window.clearTimeout(timer)
            window.removeEventListener("online", refresh)
            window.removeEventListener("focus", refresh)
            void supabase.removeChannel(channel)
        }
    }, [currentUserId, router, supabase, workspace])

    useEffect(() => {
        const area = scrollArea.current
        if (!area) return
        if (scrolledThread.current !== conversationKey || nearBottom.current) {
            area.scrollTop = area.scrollHeight
            nearBottom.current = true
        }
        scrolledThread.current = conversationKey
        setAtBottom(nearBottom.current)
    }, [conversationKey, latestId, pendingVisible])

    useEffect(() => {
        if (!selectedOrderId || !latestId || messagesError || !atBottom) return
        const marker = `${conversationKey}:${latestId}`
        const target = latestMarker.current
        if (!target) return
        let visible = false
        let active = true
        let inFlight = false
        async function acknowledge() {
            const area = scrollArea.current
            if (!active || !visible || inFlight || !area || area.getClientRects().length === 0 ||
                document.visibilityState !== "visible" || !nearBottom.current ||
                !selectedOrderId || !latestId || lastRead.current === marker) return
            inFlight = true
            try {
                const result = await markOrderChatRead(selectedOrderId, selectedChannel, latestId)
                if (!result.success) throw new Error("Read status could not be saved.")
                if (active) {
                    lastRead.current = marker
                    setReadError(null)
                    router.refresh()
                }
                void refreshUnreadCount(currentUserId)
            } catch {
                if (active) setReadError(marker)
            } finally {
                inFlight = false
            }
        }
        const observer = new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting
            if (visible) void acknowledge()
        })
        observer.observe(target)
        document.addEventListener("visibilitychange", acknowledge)
        window.addEventListener("online", acknowledge)
        return () => {
            active = false
            observer.disconnect()
            document.removeEventListener("visibilitychange", acknowledge)
            window.removeEventListener("online", acknowledge)
        }
    }, [atBottom, conversationKey, currentUserId, latestId, messagesError, readAttempt, refreshUnreadCount, router, selectedChannel, selectedOrderId])

    async function send(retry?: PendingMessage) {
        if (!selectedOrderId || pendingSends.current.has(conversationKey)) return
        const body = retry?.body ?? draft.trim()
        if (!body) return
        const message = { id: retry?.id ?? crypto.randomUUID(), body }
        pendingSends.current.add(conversationKey)
        setOutbox((current) => ({ ...current, [conversationKey]: { ...message, state: "sending" } }))
        if (!retry) setDrafts((current) => ({ ...current, [conversationKey]: "" }))
        try {
            const result = await sendOrderMessage(selectedOrderId, selectedChannel, body, message.id)
            if (!result.success) throw new Error("Send failed")
            setOutbox((current) => ({ ...current, [conversationKey]: { ...message, state: "sent" } }))
            router.refresh()
        } catch {
            setOutbox((current) => ({ ...current, [conversationKey]: { ...message, state: "failed" } }))
        } finally {
            pendingSends.current.delete(conversationKey)
        }
    }

    function jumpToLatest() {
        const area = scrollArea.current
        if (area) area.scrollTop = area.scrollHeight
        nearBottom.current = true
        setAtBottom(true)
    }

    return (
        <div className="grid min-w-0 overflow-hidden rounded-2xl border bg-card xl:grid-cols-[minmax(15rem,20rem)_minmax(0,1fr)]">
            <section className={cn("min-w-0 xl:border-r", showConversation && "hidden xl:block")} aria-labelledby="inbox-title">
                <div className="border-b p-4">
                    <h1 id="inbox-title" className="text-xl font-bold tracking-tight">Messages</h1>
                    <div className="mt-3 flex gap-2" aria-label="Filter conversations" role="group">
                        <Button variant={filter === "all" ? "secondary" : "ghost"} aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All</Button>
                        <Button variant={filter === "unread" ? "secondary" : "ghost"} aria-pressed={filter === "unread"} onClick={() => setFilter("unread")}>
                            Unread{threads.some((entry) => entry.unread_count > 0) ? ` (${threads.filter((entry) => entry.unread_count > 0).length})` : ""}
                        </Button>
                    </div>
                </div>
                {threadsError ? (
                    <div className="space-y-2 p-4 text-sm"><p role="alert">Conversations couldn’t load.</p><Button variant="outline" onClick={() => router.refresh()}>Try again</Button></div>
                ) : visibleThreads.length === 0 ? (
                    <div className="space-y-2 p-4 text-sm text-muted-foreground">
                        <p>{filter === "unread" ? "You’re all caught up." : "No order conversations yet."}</p>
                        {filter === "all" && <Link className="font-medium underline" href={orderPaths[workspace]}>View orders</Link>}
                    </div>
                ) : (
                    <ul className="max-h-[36rem] divide-y overflow-y-auto">
                        {visibleThreads.map((entry) => {
                            const channel = getThreadChannel(entry, workspace)
                            const previewChannel = entry.last_message_channel
                            const selected = entry.order_id === selectedOrderId
                            const previewMatches = !previewChannel || previewChannel === channel
                            return (
                                <li key={entry.order_id}>
                                    <Link href={getOrderMessagesHref(workspace, entry.order_id, channel)} aria-current={selected ? "page" : undefined}
                                        className={cn("flex min-h-16 items-start gap-3 px-4 py-3 hover:bg-muted/60", selected && "bg-orange-50 dark:bg-orange-950/40")}>
                                        <MessageCircle className="mt-1 size-4 shrink-0 text-orange-700 dark:text-orange-300" aria-hidden="true" />
                                        <span className="min-w-0 flex-1">
                                            <strong className="block truncate text-sm">Order #{entry.order_id.slice(0, 8).toUpperCase()}</strong>
                                            <span className="block truncate text-xs text-muted-foreground">
                                                {previewMatches ? (
                                                    <>
                                                        {previewChannel ? `${formatChatChannelLabel(previewChannel)} · ` : ""}
                                                        {entry.last_message_sender_id === currentUserId ? "You: " : entry.last_message_sender_name ? `${entry.last_message_sender_name}: ` : ""}
                                                        {entry.last_message_preview ?? "No messages yet"}
                                                    </>
                                                ) : `Unread in ${formatChatChannelLabel(channel)}`}
                                            </span>
                                            {entry.last_message_at && <span className="block text-xs text-muted-foreground">{shortTime(entry.last_message_at)}</span>}
                                        </span>
                                        {entry.unread_count > 0 && <span className="shrink-0 rounded-full bg-orange-700 px-2 py-0.5 text-xs font-semibold text-white" aria-label={`${entry.unread_count} unread`}>{entry.unread_count}</span>}
                                    </Link>
                                </li>
                            )
                        })}
                    </ul>
                )}
            </section>

            {unavailable ? (
                <section className="space-y-3 p-5">
                    <h2 className="font-semibold">{threadsError ? "Couldn’t open the conversation" : "This conversation is no longer available"}</h2>
                    {threadsError && <Button variant="outline" onClick={() => router.refresh()}>Try again</Button>}
                    <Button asChild variant="ghost"><Link href={inbox}>Back to messages</Link></Button>
                </section>
            ) : thread ? (
                <section className="flex min-w-0 flex-col" aria-labelledby="conversation-title">
                    <header className="space-y-2 border-b p-4">
                        <Link href={inbox} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium xl:hidden"><ArrowLeft className="size-4" aria-hidden="true" /> Messages</Link>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div><h2 id="conversation-title" className="font-semibold">Order #{thread.order_id.slice(0, 8).toUpperCase()}</h2><p className="text-sm text-muted-foreground">{formatOrderStatus(thread.order_status)}</p></div>
                            <Link href={getOrderDetailHref(workspace, thread.order_id)} className="inline-flex min-h-11 items-center gap-1 text-sm font-medium">
                                {workspace === "rider" ? "Rider dashboard" : "View order"} <ArrowRight className="size-4" aria-hidden="true" />
                            </Link>
                        </div>
                        {participantsError ? <p className="text-sm text-muted-foreground">Participant names are temporarily unavailable.</p> : (
                            <details className="text-sm text-muted-foreground">
                                <summary className="cursor-pointer font-medium">Participants</summary>
                                <ul className="mt-2 space-y-2">
                                    {participants.filter((person) => !person.is_current_user).map((person) => (
                                        <li key={`${person.profile_id}:${person.role}`} className="flex flex-wrap items-center gap-2">
                                            <span>{person.full_name ?? formatChatRoleLabel(person.role)} · {formatChatRoleLabel(person.role)}</span>
                                            {person.phone && <a className="font-medium underline" href={`tel:${person.phone}`}>Call</a>}
                                        </li>
                                    ))}
                                </ul>
                            </details>
                        )}
                    </header>
                    <div ref={scrollArea} onScroll={(event) => {
                        const area = event.currentTarget
                        nearBottom.current = area.scrollHeight - area.scrollTop - area.clientHeight < 32
                        setAtBottom(nearBottom.current)
                    }} className="h-[clamp(14rem,47dvh,32rem)] space-y-3 overflow-y-auto bg-muted/30 p-4" role="log" aria-label="Conversation messages">
                        {messagesError ? <p role="alert" className="text-sm">Messages couldn’t load. <button type="button" className="underline" onClick={() => router.refresh()}>Try again</button></p> :
                            messages.length === 0 && !pendingVisible ? <p className="text-sm text-muted-foreground">No messages here yet.</p> : null}
                        {messages.map((message) => (
                            <div key={message.id} className={cn("w-fit max-w-[88%] rounded-2xl border bg-card px-3 py-2", message.is_mine && "ml-auto border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/50")}>
                                <p className="text-xs text-muted-foreground">{message.is_mine ? "You" : message.sender_name ?? formatChatRoleLabel(message.sender_role)} · {shortTime(message.created_at)}</p>
                                <p className="whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">{message.body}</p>
                            </div>
                        ))}
                        {latestId && <div ref={latestMarker} className="h-px" aria-hidden="true" />}
                        {pendingVisible && (
                            <div className="ml-auto w-fit max-w-[88%] rounded-2xl border bg-card px-3 py-2">
                                <p className="whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">{pending.body}</p>
                                <p className="text-xs text-muted-foreground" role="status">{pending.state === "failed" ? "Failed to send" : pending.state === "sent" ? "Sent" : "Sending…"}</p>
                                {pending.state === "failed" && <Button variant="ghost" onClick={() => void send(pending)}>Retry</Button>}
                            </div>
                        )}
                    </div>
                    {!atBottom && <Button className="m-2 self-center" variant="outline" onClick={jumpToLatest}>Jump to latest</Button>}
                    {readError === `${conversationKey}:${latestId}` && <p role="status" className="px-4 py-2 text-sm">Read status couldn’t update. <button className="underline" type="button" onClick={() => retryRead((count) => count + 1)}>Retry</button></p>}
                    <form className="space-y-2 border-t p-3 sm:p-4" onSubmit={(event) => { event.preventDefault(); void send() }}>
                        {thread.accessible_channels.length > 1 && (
                            <nav aria-label="Conversation audience" className="flex flex-wrap gap-2">
                                {thread.accessible_channels.map((channel) => (
                                    <Button key={channel} asChild variant={channel === selectedChannel ? "secondary" : "ghost"} className="min-h-11">
                                        <Link href={getOrderMessagesHref(workspace, thread.order_id, channel)} aria-current={channel === selectedChannel ? "page" : undefined}>
                                            {formatChatChannelLabel(channel)}{unread(thread, channel) > 0 ? ` (${unread(thread, channel)})` : ""}
                                        </Link>
                                    </Button>
                                ))}
                            </nav>
                        )}
                        <p id="message-audience" className={cn("text-sm font-medium", selectedChannel === "ops" ? "text-muted-foreground" : "text-orange-900 dark:text-orange-200")}>
                            {selectedChannel === "ops" ? "Visible to the merchant, agent, and rider." : workspace === "customer" ? "Visible to you and the team handling this order." : "The customer and order team can see this."}
                        </p>
                        <div className="flex items-end gap-2">
                            <Textarea aria-label="Write a message" aria-describedby="message-audience" className="min-h-11 resize-y" maxLength={2000} rows={1} value={draft}
                                onChange={(event) => setDrafts((current) => ({ ...current, [conversationKey]: event.target.value }))} placeholder="Write a message…" />
                            <Button type="submit" className="min-h-11 shrink-0" disabled={!draft.trim() || Boolean(pendingVisible)}><Send className="size-4" aria-hidden="true" /> Send</Button>
                        </div>
                    </form>
                </section>
            ) : (
                <div className="hidden min-h-80 items-center justify-center p-5 text-sm text-muted-foreground xl:flex">Choose an order conversation.</div>
            )}
        </div>
    )
}
