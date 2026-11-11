"use client"

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { MessageCircle, Phone, Send } from "lucide-react"
import { markOrderChatRead, sendOrderMessage } from "@/app/actions/messageActions"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { useUser } from "@/context/UserContext"
import { useRouter } from "next/navigation"
import { formatChatRoleLabel, type OrderChatChannel, type OrderChatMessage, type OrderChatParticipant } from "@/lib/orderChat"
import { isValidE164PhoneNumber, normalizePhoneNumber } from "@/lib/phone"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

export function OrderCall({ phone, label }: { phone: string | null | undefined; label: string }) {
    const number = phone ? normalizePhoneNumber(phone) : ""
    if (!isValidE164PhoneNumber(number)) return null
    return <Button asChild variant="outline" className="min-h-10">
        <a href={`tel:${number}`} aria-label={`Call ${label}`}><Phone className="size-4" /> Call</a>
    </Button>
}

const OpenOrderChat = createContext<((orderId: string, channel: OrderChatChannel, opener: HTMLElement) => void) | null>(null)

export type OrderChatUnread = Partial<Record<OrderChatChannel, number>>

export function OrderChatButton({ orderId, unread }: { orderId: string; unread?: OrderChatUnread }) {
    const open = useContext(OpenOrderChat)
    const count = (unread?.ops ?? 0) + (unread?.customer ?? 0)
    const channel = !unread?.ops && unread?.customer ? "customer" : "ops"
    return <Button variant="outline" className="min-h-11" onClick={(event) => open?.(orderId, channel, event.currentTarget)}>
        <MessageCircle className="size-4" /> Chat
        {count > 0 && <span className="rounded-full bg-orange-100 px-1.5 text-xs font-semibold text-orange-900">{count} new</span>}
    </Button>
}

export function OrderChatPanel({ orders, initialOrderId, children, workspace = "agent", unread }: {
    orders: { id: string; name: string }[]
    initialOrderId: string
    children: ReactNode
    workspace?: "agent" | "merchant"
    unread?: OrderChatUnread
}) {
    const [open, setOpen] = useState(false)
    const [selection, setSelection] = useState({ orderId: initialOrderId, channel: "ops" as OrderChatChannel })
    const [drafts, setDrafts] = useState<Record<string, { body: string; id: string }>>({})
    const opener = useRef<HTMLElement>(null)
    const router = useRouter()
    const orderId = orders.some((order) => order.id === selection.orderId) ? selection.orderId : initialOrderId
    const key = `${orderId}:${selection.channel}`
    const isOpen = open && (workspace === "agent" || selection.orderId === initialOrderId)

    function openChat(id: string, channel: OrderChatChannel, trigger: HTMLElement) {
        opener.current = trigger
        setSelection({ orderId: id, channel })
        setOpen(true)
    }

    return <OpenOrderChat.Provider value={openChat}>
        {children}
        {workspace === "agent" && <div className="fixed bottom-5 right-4 z-30 sm:bottom-7 sm:right-8">
            <Button onClick={(event) => openChat(initialOrderId, "ops", event.currentTarget)} className="h-12 rounded-full bg-[#F58220] px-5 text-gray-950 shadow-lg hover:bg-orange-400">
                <MessageCircle className="size-5" /> Order chat
            </Button>
        </div>}
        <Sheet open={isOpen} onOpenChange={setOpen}>
            <SheetContent className="flex h-dvh w-full flex-col gap-0 p-0 sm:max-w-md" onCloseAutoFocus={(event) => {
                event.preventDefault()
                opener.current?.focus()
            }}>
                <header className="border-b p-4 pr-12">
                    <SheetTitle>Order chat</SheetTitle>
                    <SheetDescription>{workspace === "agent" ? "Choose a merchant and conversation." : `Order #${orderId.slice(0, 8).toUpperCase()}`}</SheetDescription>
                    {orders.length > 1 && <select aria-label="Merchant" value={orderId}
                        onChange={(event) => setSelection({ ...selection, orderId: event.target.value })}
                        className="mt-3 min-h-11 w-full rounded-lg border bg-background px-3 text-sm">
                        {orders.map((order) => <option key={order.id} value={order.id}>{order.name}</option>)}
                    </select>}
                    <div className="mt-3 flex gap-2" role="group" aria-label="Conversation">
                        {(["ops", "customer"] as const).map((channel) => <Button key={channel} variant={selection.channel === channel ? "default" : "outline"}
                            aria-pressed={selection.channel === channel} onClick={() => setSelection({ orderId, channel })}>
                            {channel === "ops" ? "Order team" : "Customer"}
                            {Boolean(unread?.[channel]) && <span className="text-xs tabular-nums">· {unread?.[channel]} new</span>}
                        </Button>)}
                    </div>
                </header>
                {isOpen && <Conversation key={key} orderId={orderId} channel={selection.channel} draft={drafts[key]}
                    onRead={unread?.[selection.channel] ? router.refresh : undefined}
                    onDraft={(draft, sentId) => setDrafts((current) =>
                        sentId && current[key]?.id !== sentId ? current : { ...current, [key]: draft })} />}
            </SheetContent>
        </Sheet>
    </OpenOrderChat.Provider>
}

function Conversation({ orderId, channel, draft, onDraft, onRead }: {
    orderId: string
    channel: OrderChatChannel
    draft?: { body: string; id: string }
    onDraft: (draft: { body: string; id: string }, sentId?: string) => void
    onRead?: () => void
}) {
    const [messages, setMessages] = useState<OrderChatMessage[]>([])
    const [participants, setParticipants] = useState<OrderChatParticipant[]>([])
    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const [loadError, setLoadError] = useState(false)
    const [sendError, setSendError] = useState("")
    const [refresh, setRefresh] = useState(0)
    const { user, refreshUnreadCount } = useUser()
    const scrollArea = useRef<HTMLDivElement>(null)
    const bottom = useRef<HTMLDivElement>(null)
    const readThrough = useRef("")
    const nearBottom = useRef(true)
    const latestId = messages.at(-1)?.id

    useEffect(() => {
        const supabase = createClient()
        let disposed = false
        let request = 0
        async function load() {
            const version = ++request
            const args = { p_order_id: orderId, p_channel: channel }
            const [history, people] = await Promise.all([
                supabase.rpc("get_order_chat_messages", args).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(100),
                supabase.rpc("get_order_chat_participants", args),
            ])
            if (disposed || request !== version) return
            const failed = Boolean(history.error || people.error || !people.data?.length)
            setLoadError(failed)
            setMessages(failed ? [] : ((history.data ?? []) as OrderChatMessage[]).reverse())
            setParticipants(failed ? [] : people.data as OrderChatParticipant[])
            setLoading(false)
        }
        void load()
        const subscription = supabase.channel(`order-chat-panel:${orderId}:${channel}`)
            .on("postgres_changes", {
                event: "INSERT", schema: "public", table: "order_messages", filter: `order_id=eq.${orderId}`,
            }, () => { void load() })
            .subscribe((status: string) => { if (status === "SUBSCRIBED") void load() })
        const refreshOnReturn = () => { void load() }
        window.addEventListener("online", refreshOnReturn)
        window.addEventListener("focus", refreshOnReturn)
        return () => {
            disposed = true
            window.removeEventListener("online", refreshOnReturn)
            window.removeEventListener("focus", refreshOnReturn)
            void supabase.removeChannel(subscription)
        }
    }, [channel, orderId, refresh])

    useEffect(() => {
        const area = scrollArea.current
        if (area && nearBottom.current) area.scrollTop = area.scrollHeight
        const marker = bottom.current
        if (!latestId || loadError || !area || !marker || !user?.id) return
        const id = latestId
        const userId = user.id
        let visible = false
        function markVisible() {
            if (!visible || document.visibilityState !== "visible" || readThrough.current === id) return
            readThrough.current = id
            void markOrderChatRead(orderId, channel, id).then((result) => {
                if (result.success) {
                    void refreshUnreadCount(userId)
                    onRead?.()
                }
                if (!result.success && readThrough.current === id) readThrough.current = ""
            }).catch(() => {
                if (readThrough.current === id) readThrough.current = ""
            })
        }
        const observer = new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting
            markVisible()
        }, { root: area })
        observer.observe(marker)
        document.addEventListener("visibilitychange", markVisible)
        return () => {
            observer.disconnect()
            document.removeEventListener("visibilitychange", markVisible)
        }
    }, [channel, latestId, loadError, onRead, orderId, refreshUnreadCount, user?.id])

    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (sending || !draft?.body.trim()) return
        setSending(true)
        setSendError("")
        try {
            const result = await sendOrderMessage(orderId, channel, draft.body, draft.id)
            if (result.success) {
                nearBottom.current = true
                onDraft({ body: "", id: "" }, draft.id)
                setRefresh((version) => version + 1)
            } else {
                setSendError(result.message ?? "Message couldn’t be sent. Try again.")
            }
        } catch {
            setSendError("Message couldn’t be sent. Try again.")
        } finally {
            setSending(false)
        }
    }

    return <>
        <div className="max-h-[26dvh] shrink-0 overflow-auto border-b bg-muted/40 px-4 py-2">
            <p className="text-xs text-muted-foreground">{channel === "ops" ? "Visible to the merchant, agent and assigned rider." : "Visible to the customer and order team."}</p>
            {participants.filter((person) => !person.is_current_user).map((person) => <div key={person.profile_id} className="flex min-h-11 items-center justify-between gap-2 py-1">
                <span className="min-w-0 truncate text-sm">{person.full_name ?? formatChatRoleLabel(person.role)} <span className="text-xs text-muted-foreground">{formatChatRoleLabel(person.role)}</span></span>
                <OrderCall phone={person.phone} label={person.full_name ?? person.role} />
            </div>)}
        </div>
        <div ref={scrollArea} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4" aria-label="Messages"
            onScroll={(event) => {
                const { scrollHeight, scrollTop, clientHeight } = event.currentTarget
                nearBottom.current = scrollHeight - scrollTop - clientHeight < 48
            }}>
            {loading && <p role="status" className="text-sm text-muted-foreground">Loading conversation…</p>}
            {loadError && <div role="alert" className="space-y-2 text-sm">
                <p>Couldn’t open this conversation.</p>
                <Button variant="outline" onClick={() => setRefresh((version) => version + 1)}>Retry</Button>
            </div>}
            {!loading && !loadError && messages.length === 0 && <p className="text-sm text-muted-foreground">No messages yet.</p>}
            {messages.map((message) => <div key={message.id} className={cn("w-fit max-w-[88%] break-words rounded-2xl bg-muted px-3 py-2 text-sm", message.is_mine && "ml-auto bg-orange-100 text-orange-950")}>
                <p className="text-xs font-semibold">{message.is_mine ? "You" : message.sender_name ?? formatChatRoleLabel(message.sender_role)}</p>
                <p className="whitespace-pre-wrap">{message.body}</p>
            </div>)}
            <div ref={bottom} className="h-px" />
        </div>
        <form onSubmit={submit} className="space-y-2 border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {sendError && <p role="alert" className="text-sm text-destructive">{sendError}</p>}
            <div className="flex items-end gap-2">
                <textarea aria-label="Message" placeholder="Write a message" rows={2} maxLength={2000}
                    value={draft?.body ?? ""} disabled={loading || loadError || sending}
                    onChange={(event) => onDraft({ body: event.target.value, id: crypto.randomUUID() })}
                    className="min-w-0 flex-1 resize-none rounded-xl border bg-background px-3 py-2 text-base" />
                <Button type="submit" size="icon" className="size-11" aria-label="Send message"
                    disabled={loading || loadError || sending || !draft?.body.trim()}><Send className="size-4" /></Button>
            </div>
        </form>
    </>
}
