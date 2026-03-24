"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import { Bot, Loader2, MessageCircle, RefreshCcw, Send, Sparkles, UserRound } from "lucide-react"
import { submitSupportChatTurn } from "@/app/contact/supportActions"
import { Button } from "@/components/ui/button"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase/client"
import {
    SUPPORT_CHAT_STORAGE_KEY,
    extractSupportSuggestedLinks,
    getSupportSenderLabel,
    getSupportStatusLabel,
    getSupportStatusTone,
    normalizeStoredSupportConversationRef,
    normalizeSupportAISettings,
    normalizeSupportConversationSnapshot,
    type StoredSupportConversationRef,
    type SupportChatBootstrap,
    type SupportMessageRecord,
} from "@/lib/supportChat"
import { cn } from "@/lib/utils"

interface SupportChatBubbleProps {
    bootstrap: SupportChatBootstrap
}

interface SupportContactDraft {
    email: string
    name: string
    phone: string
    subject: string
}

function buildInitialContactDraft(bootstrap: SupportChatBootstrap): SupportContactDraft {
    const conversation = bootstrap.initialSnapshot?.conversation

    return {
        email: conversation?.visitorEmail ?? bootstrap.currentUser.email,
        name: conversation?.visitorName ?? bootstrap.currentUser.name,
        phone: conversation?.visitorPhone ?? bootstrap.currentUser.phone,
        subject: conversation?.subject ?? "",
    }
}

function formatStamp(value: string) {
    return new Date(value).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
    })
}

function getMessageTone(message: SupportMessageRecord) {
    switch (message.senderRole) {
        case "assistant":
            return "self-start border-orange-100 bg-orange-50 text-gray-900 dark:border-orange-900/30 dark:bg-orange-950/20 dark:text-orange-50"
        case "admin":
            return "self-start border-violet-100 bg-violet-50 text-gray-900 dark:border-violet-900/30 dark:bg-violet-950/20 dark:text-violet-50"
        case "system":
            return "self-start border-gray-200 bg-gray-100 text-gray-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
        case "customer":
        default:
            return "self-end border-[#F58220] bg-[#F58220] text-white"
    }
}

function getMessageIcon(message: SupportMessageRecord) {
    switch (message.senderRole) {
        case "assistant":
            return <Bot className="h-4 w-4" />
        case "admin":
            return <Sparkles className="h-4 w-4" />
        case "system":
            return <RefreshCcw className="h-4 w-4" />
        case "customer":
        default:
            return <UserRound className="h-4 w-4" />
    }
}

function readStoredConversation() {
    if (typeof window === "undefined") {
        return null
    }

    try {
        return normalizeStoredSupportConversationRef(JSON.parse(window.localStorage.getItem(SUPPORT_CHAT_STORAGE_KEY) ?? "null"))
    } catch {
        return null
    }
}

function writeStoredConversation(value: StoredSupportConversationRef | null) {
    if (typeof window === "undefined") {
        return
    }

    if (!value) {
        window.localStorage.removeItem(SUPPORT_CHAT_STORAGE_KEY)
        return
    }

    window.localStorage.setItem(SUPPORT_CHAT_STORAGE_KEY, JSON.stringify(value))
}

export function SupportChatBubble({ bootstrap }: SupportChatBubbleProps) {
    const supabase = useMemo(() => createClient(), [])
    const [open, setOpen] = useState(false)
    const [draft, setDraft] = useState("")
    const [settings, setSettings] = useState(bootstrap.settings)
    const [contactDraft, setContactDraft] = useState<SupportContactDraft>(() => buildInitialContactDraft(bootstrap))
    const [snapshot, setSnapshot] = useState(bootstrap.initialSnapshot)
    const [conversationRef, setConversationRef] = useState<StoredSupportConversationRef | null>(
        bootstrap.initialSnapshot
            ? { accessToken: null, conversationId: bootstrap.initialSnapshot.conversation.id }
            : null
    )
    const [isLoadingHistory, setIsLoadingHistory] = useState(false)
    const [unreadIndicator, setUnreadIndicator] = useState(false)
    const [isPending, startTransition] = useTransition()
    const openRef = useRef(open)
    const lastMessageIdRef = useRef<string | null>(bootstrap.initialSnapshot?.messages.at(-1)?.id ?? null)
    const endRef = useRef<HTMLDivElement | null>(null)

    const hasConversation = Boolean(snapshot?.conversation.id)
    const conversationMessages = snapshot?.messages ?? []
    const showAiBadge = Boolean(
        settings.enabled
        && snapshot?.conversation.aiEnabledSnapshot
        && snapshot?.conversation.status !== "human_follow_up"
    )

    useEffect(() => {
        openRef.current = open
    }, [open])

    const applySnapshot = useCallback((nextSnapshot: NonNullable<typeof snapshot>) => {
        const latestMessage = nextSnapshot.messages.at(-1) ?? null

        if (
            latestMessage
            && lastMessageIdRef.current
            && latestMessage.id !== lastMessageIdRef.current
            && latestMessage.senderRole !== "customer"
            && !openRef.current
        ) {
            setUnreadIndicator(true)
        }

        if (latestMessage) {
            lastMessageIdRef.current = latestMessage.id
        }

        setSnapshot(nextSnapshot)
    }, [])

    useEffect(() => {
        const storedConversation = readStoredConversation()
        if (!storedConversation) {
            if (bootstrap.initialSnapshot) {
                writeStoredConversation({
                    accessToken: null,
                    conversationId: bootstrap.initialSnapshot.conversation.id,
                })
            }
            return
        }

        void (async () => {
            setConversationRef(storedConversation)

            if (bootstrap.initialSnapshot?.conversation.id === storedConversation.conversationId) {
                return
            }

            setIsLoadingHistory(true)

            const { data, error } = await supabase.rpc("get_support_conversation_snapshot", {
                p_access_token: storedConversation.accessToken ?? "",
                p_conversation_id: storedConversation.conversationId,
            })

            if (error) {
                writeStoredConversation(null)
                setConversationRef(null)
                return
            }

            const nextSnapshot = normalizeSupportConversationSnapshot(data)
            if (!nextSnapshot) {
                writeStoredConversation(null)
                setConversationRef(null)
                return
            }

            setContactDraft({
                email: nextSnapshot.conversation.visitorEmail,
                name: nextSnapshot.conversation.visitorName,
                phone: nextSnapshot.conversation.visitorPhone ?? "",
                subject: nextSnapshot.conversation.subject ?? "",
            })
            applySnapshot(nextSnapshot)
        })().finally(() => {
            setIsLoadingHistory(false)
        })
    }, [applySnapshot, bootstrap.initialSnapshot, supabase])

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [open, snapshot?.messages])

    useEffect(() => {
        if (!conversationRef) {
            return
        }

        const interval = window.setInterval(() => {
            void (async () => {
                const [snapshotResponse, settingsResponse] = await Promise.all([
                    supabase.rpc("get_support_conversation_snapshot", {
                        p_access_token: conversationRef.accessToken ?? "",
                        p_conversation_id: conversationRef.conversationId,
                    }),
                    supabase.rpc("get_support_ai_settings"),
                ])

                if (!snapshotResponse.error) {
                    const nextSnapshot = normalizeSupportConversationSnapshot(snapshotResponse.data)
                    if (nextSnapshot) {
                        applySnapshot(nextSnapshot)
                    }
                }

                if (!settingsResponse.error) {
                    setSettings(normalizeSupportAISettings(settingsResponse.data))
                }
            })()
        }, open ? 5000 : 10000)

        return () => {
            window.clearInterval(interval)
        }
    }, [applySnapshot, conversationRef, open, supabase])

    function updateContactDraft(field: keyof SupportContactDraft, value: string) {
        setContactDraft((current) => ({
            ...current,
            [field]: value,
        }))
    }

    function handleSendMessage() {
        const message = draft.trim()

        if (!message) {
            return
        }

        if (!hasConversation) {
            if (!contactDraft.name.trim()) {
                toast.error("Enter your name before starting support chat.")
                return
            }

            if (!contactDraft.email.trim()) {
                toast.error("Enter your email before starting support chat.")
                return
            }
        }

        startTransition(async () => {
            try {
                const result = await submitSupportChatTurn({
                    accessToken: conversationRef?.accessToken ?? null,
                    conversationId: conversationRef?.conversationId ?? null,
                    email: contactDraft.email,
                    message,
                    name: contactDraft.name,
                    phone: contactDraft.phone,
                    subject: contactDraft.subject,
                })

                const nextConversationRef = {
                    accessToken: result.accessToken,
                    conversationId: result.snapshot.conversation.id,
                }

                setConversationRef(nextConversationRef)
                setContactDraft({
                    email: result.snapshot.conversation.visitorEmail,
                    name: result.snapshot.conversation.visitorName,
                    phone: result.snapshot.conversation.visitorPhone ?? "",
                    subject: result.snapshot.conversation.subject ?? "",
                })
                applySnapshot(result.snapshot)
                writeStoredConversation(nextConversationRef)
                setDraft("")
                setUnreadIndicator(false)
                setOpen(true)
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Support chat could not send your message.")
            }
        })
    }

    return (
        <Sheet
            open={open}
            onOpenChange={(nextOpen) => {
                setOpen(nextOpen)
                if (nextOpen) {
                    setUnreadIndicator(false)
                }
            }}
        >
            <SheetTrigger asChild>
                <button
                    type="button"
                    aria-label="Open support chat"
                    className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#F58220] text-white shadow-lg transition-transform hover:scale-105 hover:bg-[#F58220]/90"
                >
                    <MessageCircle className="h-7 w-7" />
                    {unreadIndicator ? (
                        <span className="absolute right-1 top-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
                    ) : null}
                </button>
            </SheetTrigger>

            <SheetContent side="right" className="w-full max-w-[430px] overflow-hidden border-l border-orange-100 p-0 dark:border-zinc-800">
                <div className="flex h-full flex-col bg-white dark:bg-zinc-950">
                    <SheetHeader className="border-b border-gray-100 px-6 py-5 dark:border-zinc-800">
                        <div className="flex items-start justify-between gap-4">
                            <div className="space-y-2">
                                <SheetTitle className="text-xl font-bold text-gray-900 dark:text-white">
                                    {settings.welcomeTitle}
                                </SheetTitle>
                                <SheetDescription className="text-sm leading-relaxed text-gray-500 dark:text-zinc-400">
                                    {settings.welcomeMessage}
                                </SheetDescription>
                            </div>
                            <span
                                className={cn(
                                    "rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em]",
                                    snapshot ? getSupportStatusTone(snapshot.conversation.status) : "border-orange-200 bg-orange-50 text-[#F58220]"
                                )}
                            >
                                {snapshot ? getSupportStatusLabel(snapshot.conversation.status) : showAiBadge ? "AI live" : "Support"}
                            </span>
                        </div>
                    </SheetHeader>

                    <div className="flex-1 overflow-y-auto px-6 py-5">
                        {!hasConversation ? (
                            <div className="space-y-5">
                                <div className="rounded-3xl border border-orange-100 bg-orange-50 p-5 dark:border-orange-900/30 dark:bg-orange-950/20">
                                <div className="flex items-start gap-3">
                                        <div className="rounded-full bg-white p-2 text-[#F58220] shadow-sm dark:bg-zinc-900">
                                            <Bot className="h-5 w-5" />
                                        </div>
                                        <div className="space-y-2">
                                            <p className="font-semibold text-gray-900 dark:text-white">{settings.assistantName}</p>
                                            <p className="text-sm leading-relaxed text-gray-600 dark:text-zinc-300">
                                                Ask about orders, checkout, payment instructions, gift cards, reward points, or delivery guidance.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid gap-4">
                                    <label className="space-y-2">
                                        <span className="text-sm font-semibold text-gray-700 dark:text-zinc-200">Name</span>
                                        <Input
                                            value={contactDraft.name}
                                            onChange={(event) => updateContactDraft("name", event.target.value)}
                                            className="h-12 rounded-xl bg-gray-50 dark:bg-zinc-900"
                                            placeholder="Your full name"
                                        />
                                    </label>

                                    <label className="space-y-2">
                                        <span className="text-sm font-semibold text-gray-700 dark:text-zinc-200">Email</span>
                                        <Input
                                            type="email"
                                            value={contactDraft.email}
                                            onChange={(event) => updateContactDraft("email", event.target.value)}
                                            className="h-12 rounded-xl bg-gray-50 dark:bg-zinc-900"
                                            placeholder="you@example.com"
                                        />
                                    </label>

                                    <label className="space-y-2">
                                        <span className="text-sm font-semibold text-gray-700 dark:text-zinc-200">Phone</span>
                                        <Input
                                            value={contactDraft.phone}
                                            onChange={(event) => updateContactDraft("phone", event.target.value)}
                                            className="h-12 rounded-xl bg-gray-50 dark:bg-zinc-900"
                                            placeholder="Optional phone number"
                                        />
                                    </label>

                                    <label className="space-y-2">
                                        <span className="text-sm font-semibold text-gray-700 dark:text-zinc-200">Subject</span>
                                        <Input
                                            value={contactDraft.subject}
                                            onChange={(event) => updateContactDraft("subject", event.target.value)}
                                            className="h-12 rounded-xl bg-gray-50 dark:bg-zinc-900"
                                            placeholder="Optional subject"
                                        />
                                    </label>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                                    Support replies appear here automatically. Human replies continue in the same thread if the chat is escalated.
                                </div>

                                <div className="flex flex-col gap-3">
                                    {conversationMessages.map((message) => {
                                        const links = extractSupportSuggestedLinks(message.metadata)

                                        return (
                                            <div key={message.id} className={cn("max-w-[88%] rounded-3xl border px-4 py-3", getMessageTone(message))}>
                                                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] opacity-80">
                                                    {getMessageIcon(message)}
                                                    <span>{getSupportSenderLabel(message.senderRole)}</span>
                                                    <span>{formatStamp(message.createdAt)}</span>
                                                </div>
                                                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{message.body}</p>
                                                {links.length > 0 ? (
                                                    <div className="mt-3 flex flex-wrap gap-2">
                                                        {links.map((link) => (
                                                            <Link
                                                                key={`${message.id}-${link.url}`}
                                                                href={link.url}
                                                                className="rounded-full border border-current/20 px-3 py-1 text-xs font-semibold transition hover:bg-black/5 dark:hover:bg-white/5"
                                                            >
                                                                {link.label}
                                                            </Link>
                                                        ))}
                                                    </div>
                                                ) : null}
                                            </div>
                                        )
                                    })}
                                    <div ref={endRef} />
                                </div>
                            </div>
                        )}

                        {isLoadingHistory ? (
                            <div className="mt-4 flex items-center gap-2 text-sm text-gray-500 dark:text-zinc-400">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Loading your latest support conversation...</span>
                            </div>
                        ) : null}
                    </div>

                    <div className="border-t border-gray-100 px-6 py-5 dark:border-zinc-800">
                        <div className="space-y-3">
                            <Textarea
                                value={draft}
                                onChange={(event) => setDraft(event.target.value)}
                                placeholder={hasConversation ? "Write your reply..." : "How can RSS Support help you today?"}
                                className="min-h-[110px] resize-none rounded-2xl bg-gray-50 dark:bg-zinc-900"
                            />
                            <div className="flex items-center justify-between gap-3">
                                <p className="text-xs text-gray-400">
                                    {showAiBadge ? "AI replies first. Human support joins when needed." : "Human support follow-up is enabled for this conversation."}
                                </p>
                                <Button
                                    type="button"
                                    className="rounded-full bg-[#F58220] px-5 text-white hover:bg-[#F58220]/90"
                                    onClick={handleSendMessage}
                                    disabled={isPending || !draft.trim()}
                                >
                                    {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                    {hasConversation ? "Send reply" : "Start chat"}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    )
}
