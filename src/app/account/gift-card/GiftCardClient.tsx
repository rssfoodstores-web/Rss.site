"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
    ArrowUpRight,
    CreditCard,
    Gift,
    History,
    Inbox,
    Loader2,
    MailCheck,
    ReceiptText,
    Send,
    Sparkles,
    Wallet,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { formatKobo, nairaToKobo } from "@/lib/money"
import {
    buyGiftCardWithDirectPayment,
    buyGiftCardWithWallet,
    getGiftCardData,
    verifyGiftCardRecipient,
} from "./actions"

type ActiveTab = "send" | "received" | "history"
type PaymentMode = "wallet" | "direct"

type RecipientState = {
    id: string
    email: string
    fullName: string
    isSelf: boolean
} | null

type GiftCardData = Awaited<ReturnType<typeof getGiftCardData>>

const presetAmountsKobo = [100000, 200000, 500000, 1000000, 2000000, 5000000]

function getStatusTone(status: string) {
    if (status === "active") {
        return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300"
    }

    if (status === "pending") {
        return "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/40 dark:bg-violet-950/20 dark:text-violet-300"
    }

    if (status === "depleted") {
        return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300"
    }

    return "border-gray-200 bg-gray-50 text-gray-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
}

function formatDate(value: string | null) {
    if (!value) {
        return "Not yet"
    }

    return new Date(value).toLocaleDateString()
}

export function GiftCardClient() {
    const searchParams = useSearchParams()
    const [activeTab, setActiveTab] = useState<ActiveTab>("send")
    const [loading, setLoading] = useState(true)
    const [purchasing, setPurchasing] = useState(false)
    const [verifying, setVerifying] = useState(false)
    const [paymentMode, setPaymentMode] = useState<PaymentMode>("wallet")
    const [recipientEmail, setRecipientEmail] = useState("")
    const [verifiedRecipient, setVerifiedRecipient] = useState<RecipientState>(null)
    const [amountInput, setAmountInput] = useState("1000")
    const [giftMessage, setGiftMessage] = useState("")
    const [data, setData] = useState<GiftCardData | null>(null)

    async function loadGiftCards() {
        setLoading(true)
        const result = await getGiftCardData()
        setData(result)
        setLoading(false)
    }

    useEffect(() => {
        let active = true

        const bootstrap = async () => {
            const result = await getGiftCardData()

            if (!active) {
                return
            }

            setData(result)
            setLoading(false)
        }

        void bootstrap()

        return () => {
            active = false
        }
    }, [])

    const receivedCards = useMemo(
        () => (data?.cards ?? []).filter((card) => card.direction === "received"),
        [data?.cards]
    )

    const sentCards = useMemo(
        () => (data?.cards ?? []).filter((card) => card.direction === "sent"),
        [data?.cards]
    )

    const amountKobo = useMemo(() => {
        const amount = Number.parseFloat(amountInput)
        return Number.isFinite(amount) && amount > 0 ? nairaToKobo(amount) : 0
    }, [amountInput])

    async function handleVerifyRecipient(forceEmail?: string) {
        const emailToVerify = (forceEmail ?? recipientEmail).trim()

        if (!emailToVerify) {
            setVerifiedRecipient(null)
            return
        }

        setVerifying(true)
        const result = await verifyGiftCardRecipient(emailToVerify)
        setVerifying(false)

        if (!result.success || !result.recipient) {
            setVerifiedRecipient(null)
            if (forceEmail === undefined) {
                toast.error(result.error || "No account was found for that email.")
            }
            return
        }

        setVerifiedRecipient(result.recipient)

        if (forceEmail === undefined) {
            toast.success(`Recipient verified: ${result.recipient.fullName}`)
        }
    }

    async function handlePurchase() {
        if (!verifiedRecipient) {
            toast.error("Verify the recipient email before sending a gift card.")
            return
        }

        if (!amountKobo) {
            toast.error("Enter a valid gift card amount.")
            return
        }

        setPurchasing(true)

        if (paymentMode === "wallet") {
            const result = await buyGiftCardWithWallet({
                recipientEmail: verifiedRecipient.email,
                amountKobo,
                message: giftMessage,
            })

            setPurchasing(false)

            if (!result.success) {
                toast.error(result.error || "Unable to purchase gift card.")
                return
            }

            toast.success(result.code ? `Gift card ${result.code} sent successfully.` : "Gift card sent successfully.")
            setGiftMessage("")
            void loadGiftCards()
            return
        }

        const result = await buyGiftCardWithDirectPayment({
            recipientEmail: verifiedRecipient.email,
            amountKobo,
            message: giftMessage,
        })

        setPurchasing(false)

        if (!result.success || !result.checkoutUrl) {
            toast.error(result.error || "Unable to initialize direct payment.")
            return
        }

        toast.success("Redirecting to Monnify checkout...")
        window.location.href = result.checkoutUrl
    }

    return (
        <div className="space-y-6">
            {searchParams.get("ref") ? (
                <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900 dark:border-violet-900/40 dark:bg-violet-950/20 dark:text-violet-100">
                    Payment reference <span className="font-semibold">{searchParams.get("ref")}</span> returned to this page. If you just paid directly, the gift card will appear here once the webhook confirms the transaction.
                </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-3xl border border-orange-200 bg-gradient-to-br from-[#F58220] to-[#d86a12] p-6 text-white shadow-lg shadow-orange-500/20">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-white/80">Available to spend</span>
                        <Wallet className="h-5 w-5 text-white/70" />
                    </div>
                    <p className="mt-4 text-3xl font-bold">{formatKobo(data?.summary.availableBalanceKobo ?? 0)}</p>
                    <p className="mt-2 text-sm text-white/80">
                        {data?.summary.activeCount ?? 0} active card{(data?.summary.activeCount ?? 0) === 1 ? "" : "s"} ready at checkout
                    </p>
                </div>

                <div className="rounded-3xl border border-gray-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500 dark:text-zinc-400">Received cards</span>
                        <Inbox className="h-5 w-5 text-[#F58220]" />
                    </div>
                    <p className="mt-4 text-3xl font-bold text-gray-900 dark:text-white">{data?.summary.receivedCount ?? 0}</p>
                    <p className="mt-2 text-sm text-gray-500 dark:text-zinc-400">Gift cards sent to your account and available for checkout.</p>
                </div>

                <div className="rounded-3xl border border-gray-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500 dark:text-zinc-400">Sent cards</span>
                        <Send className="h-5 w-5 text-violet-700" />
                    </div>
                    <p className="mt-4 text-3xl font-bold text-gray-900 dark:text-white">{data?.summary.sentCount ?? 0}</p>
                    <p className="mt-2 text-sm text-gray-500 dark:text-zinc-400">Purchased by you for other RSS Foods users.</p>
                </div>
            </div>

            <div className="rounded-3xl border border-gray-100 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex flex-wrap gap-2 border-b border-gray-100 p-4 dark:border-zinc-800">
                    {[
                        { id: "send", label: "Send Gift Card", icon: Gift },
                        { id: "received", label: "Received Cards", icon: Inbox },
                        { id: "history", label: "Activity", icon: History },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id as ActiveTab)}
                            className={cn(
                                "inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition-colors",
                                activeTab === tab.id
                                    ? "bg-[#F58220] text-white"
                                    : "bg-gray-100 text-gray-600 hover:bg-orange-50 hover:text-[#F58220] dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                            )}
                        >
                            <tab.icon className="h-4 w-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="p-6 lg:p-8">
                    {activeTab === "send" ? (
                        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                            <section className="space-y-6 rounded-3xl border border-gray-100 bg-gray-50/60 p-6 dark:border-zinc-800 dark:bg-zinc-950/50">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Send a gift card</h2>
                                    <p className="mt-2 text-sm text-gray-500 dark:text-zinc-400">
                                        Enter a recipient email, verify the account, choose an amount, and complete payment with either your wallet or Monnify.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-700 dark:text-zinc-200">Recipient email</label>
                                    <div className="flex flex-col gap-3 sm:flex-row">
                                        <Input
                                            type="email"
                                            value={recipientEmail}
                                            onChange={(event) => {
                                                setRecipientEmail(event.target.value)
                                                setVerifiedRecipient(null)
                                            }}
                                            onBlur={() => {
                                                if (recipientEmail.trim()) {
                                                    void handleVerifyRecipient(recipientEmail)
                                                }
                                            }}
                                            placeholder="recipient@example.com"
                                            className="h-12 rounded-2xl bg-white dark:bg-zinc-900"
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => void handleVerifyRecipient()}
                                            disabled={verifying || !recipientEmail.trim()}
                                            className="h-12 rounded-2xl border-violet-200 bg-violet-50 text-violet-900 hover:bg-violet-100 dark:border-violet-900/40 dark:bg-violet-950/20 dark:text-violet-200"
                                        >
                                            {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailCheck className="mr-2 h-4 w-4" />}
                                            Verify
                                        </Button>
                                    </div>
                                    {verifiedRecipient ? (
                                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-100">
                                            <p className="font-semibold">{verifiedRecipient.fullName}</p>
                                            <p className="text-emerald-700/90 dark:text-emerald-200/80">
                                                {verifiedRecipient.email}
                                                {verifiedRecipient.isSelf ? " · This is your own account" : ""}
                                            </p>
                                        </div>
                                    ) : null}
                                </div>

                                <div className="space-y-3">
                                    <label className="text-sm font-semibold text-gray-700 dark:text-zinc-200">Amount</label>
                                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                                        {presetAmountsKobo.map((preset) => (
                                            <button
                                                key={preset}
                                                type="button"
                                                onClick={() => setAmountInput(String(preset / 100))}
                                                className={cn(
                                                    "rounded-2xl border px-4 py-3 text-left transition-colors",
                                                    amountKobo === preset
                                                        ? "border-[#F58220] bg-orange-50 text-[#F58220] dark:border-orange-500 dark:bg-orange-950/20"
                                                        : "border-gray-200 bg-white text-gray-700 hover:border-orange-200 hover:bg-orange-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                                                )}
                                            >
                                                <span className="block text-sm font-semibold">{formatKobo(preset)}</span>
                                                <span className="text-xs text-gray-500 dark:text-zinc-400">Preset amount</span>
                                            </button>
                                        ))}
                                    </div>
                                    <Input
                                        type="number"
                                        min="1000"
                                        step="100"
                                        value={amountInput}
                                        onChange={(event) => setAmountInput(event.target.value)}
                                        placeholder="Enter amount in naira"
                                        className="h-12 rounded-2xl bg-white dark:bg-zinc-900"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-700 dark:text-zinc-200">Gift message</label>
                                    <Textarea
                                        value={giftMessage}
                                        onChange={(event) => setGiftMessage(event.target.value)}
                                        placeholder="Add a short note for the recipient"
                                        className="min-h-28 rounded-2xl bg-white dark:bg-zinc-900"
                                    />
                                </div>

                                <div className="space-y-3">
                                    <label className="text-sm font-semibold text-gray-700 dark:text-zinc-200">Payment method</label>
                                    <div className="grid gap-3 md:grid-cols-2">
                                        <button
                                            type="button"
                                            onClick={() => setPaymentMode("wallet")}
                                            className={cn(
                                                "rounded-2xl border p-4 text-left transition-colors",
                                                paymentMode === "wallet"
                                                    ? "border-[#F58220] bg-orange-50 dark:border-orange-500 dark:bg-orange-950/20"
                                                    : "border-gray-200 bg-white hover:border-orange-200 dark:border-zinc-800 dark:bg-zinc-900"
                                            )}
                                        >
                                            <div className="flex items-center gap-3">
                                                <Wallet className="h-5 w-5 text-[#F58220]" />
                                                <div>
                                                    <p className="font-semibold text-gray-900 dark:text-white">Wallet</p>
                                                    <p className="text-sm text-gray-500 dark:text-zinc-400">Instant debit from your customer wallet</p>
                                                </div>
                                            </div>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPaymentMode("direct")}
                                            className={cn(
                                                "rounded-2xl border p-4 text-left transition-colors",
                                                paymentMode === "direct"
                                                    ? "border-violet-600 bg-violet-50 dark:border-violet-500 dark:bg-violet-950/20"
                                                    : "border-gray-200 bg-white hover:border-violet-200 dark:border-zinc-800 dark:bg-zinc-900"
                                            )}
                                        >
                                            <div className="flex items-center gap-3">
                                                <CreditCard className="h-5 w-5 text-violet-700" />
                                                <div>
                                                    <p className="font-semibold text-gray-900 dark:text-white">Direct payment</p>
                                                    <p className="text-sm text-gray-500 dark:text-zinc-400">Cards, transfer, or USSD via Monnify</p>
                                                </div>
                                            </div>
                                        </button>
                                    </div>
                                </div>

                                <Button
                                    type="button"
                                    onClick={() => void handlePurchase()}
                                    disabled={purchasing || !verifiedRecipient || !amountKobo}
                                    className="h-14 w-full rounded-2xl bg-[#F58220] text-base font-bold text-white hover:bg-[#d86a12]"
                                >
                                    {purchasing ? (
                                        <>
                                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                            Processing
                                        </>
                                    ) : (
                                        <>
                                            Send gift card {formatKobo(amountKobo)}
                                            <ArrowUpRight className="ml-2 h-4 w-4" />
                                        </>
                                    )}
                                </Button>
                            </section>

                            <section className="space-y-4">
                                <div className="rounded-3xl bg-violet-950 p-6 text-white">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-violet-200">Gift card preview</p>
                                            <h3 className="mt-2 text-2xl font-bold">{formatKobo(amountKobo)}</h3>
                                        </div>
                                        <Gift className="h-10 w-10 text-violet-300" />
                                    </div>
                                    <p className="mt-6 text-sm text-violet-100">
                                        {giftMessage.trim() || "No message added yet."}
                                    </p>
                                    <div className="mt-6 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-violet-300">
                                        <Sparkles className="h-3.5 w-3.5" />
                                        Usable at checkout when active
                                    </div>
                                </div>

                                <div className="rounded-3xl border border-gray-100 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Recent cards you sent</h3>
                                    <div className="mt-4 space-y-3">
                                        {loading ? (
                                            <div className="flex justify-center py-8">
                                                <Loader2 className="h-5 w-5 animate-spin text-[#F58220]" />
                                            </div>
                                        ) : sentCards.length === 0 ? (
                                            <p className="text-sm text-gray-500 dark:text-zinc-400">No sent gift cards yet.</p>
                                        ) : (
                                            sentCards.slice(0, 3).map((card) => (
                                                <div key={card.id} className="rounded-2xl border border-gray-100 p-4 dark:border-zinc-800">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                            <p className="font-semibold text-gray-900 dark:text-white">{formatKobo(card.amountKobo)}</p>
                                                            <p className="text-sm text-gray-500 dark:text-zinc-400">
                                                                To {card.counterpartyName || card.recipientEmail}
                                                            </p>
                                                        </div>
                                                        <Badge className={cn("capitalize", getStatusTone(card.status))}>{card.status}</Badge>
                                                    </div>
                                                    <p className="mt-3 text-xs text-gray-500 dark:text-zinc-400">{card.code}</p>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </section>
                        </div>
                    ) : null}

                    {activeTab === "received" ? (
                        <div className="space-y-4">
                            {loading ? (
                                <div className="flex justify-center py-12">
                                    <Loader2 className="h-6 w-6 animate-spin text-[#F58220]" />
                                </div>
                            ) : receivedCards.length === 0 ? (
                                <div className="rounded-3xl border border-dashed border-gray-200 px-6 py-12 text-center dark:border-zinc-800">
                                    <Inbox className="mx-auto h-10 w-10 text-gray-300" />
                                    <h3 className="mt-4 text-xl font-bold text-gray-900 dark:text-white">No gift cards yet</h3>
                                    <p className="mt-2 text-sm text-gray-500 dark:text-zinc-400">
                                        When another RSS Foods user sends you a gift card, it will appear here and become available at checkout.
                                    </p>
                                </div>
                            ) : (
                                receivedCards.map((card) => (
                                    <article
                                        key={card.id}
                                        className="rounded-3xl border border-gray-100 bg-gradient-to-br from-white to-orange-50/40 p-6 dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950"
                                    >
                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <Badge className={cn("capitalize", getStatusTone(card.status))}>{card.status}</Badge>
                                                    {card.isSpendable ? (
                                                        <Badge className="border-orange-200 bg-orange-50 text-[#F58220] dark:border-orange-900/40 dark:bg-orange-950/20 dark:text-orange-300">
                                                            Checkout ready
                                                        </Badge>
                                                    ) : null}
                                                </div>
                                                <h3 className="mt-4 text-2xl font-bold text-gray-900 dark:text-white">{formatKobo(card.remainingAmountKobo)}</h3>
                                                <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
                                                    Original amount {formatKobo(card.amountKobo)} · Code {card.code}
                                                </p>
                                            </div>

                                            <div className="rounded-2xl bg-white/80 px-4 py-3 text-sm shadow-sm dark:bg-zinc-950/70">
                                                <p className="font-semibold text-gray-900 dark:text-white">{card.counterpartyName || "RSS Foods User"}</p>
                                                <p className="text-gray-500 dark:text-zinc-400">Sent on {formatDate(card.deliveredAt || card.createdAt)}</p>
                                            </div>
                                        </div>

                                        {card.message ? (
                                            <div className="mt-5 rounded-2xl border border-gray-100 bg-white/80 px-4 py-3 text-sm text-gray-700 dark:border-zinc-800 dark:bg-zinc-950/70 dark:text-zinc-200">
                                                {card.message}
                                            </div>
                                        ) : null}
                                    </article>
                                ))
                            )}
                        </div>
                    ) : null}

                    {activeTab === "history" ? (
                        <div className="space-y-4">
                            {loading ? (
                                <div className="flex justify-center py-12">
                                    <Loader2 className="h-6 w-6 animate-spin text-[#F58220]" />
                                </div>
                            ) : (data?.activity.length ?? 0) === 0 ? (
                                <div className="rounded-3xl border border-dashed border-gray-200 px-6 py-12 text-center dark:border-zinc-800">
                                    <ReceiptText className="mx-auto h-10 w-10 text-gray-300" />
                                    <h3 className="mt-4 text-xl font-bold text-gray-900 dark:text-white">No activity yet</h3>
                                    <p className="mt-2 text-sm text-gray-500 dark:text-zinc-400">
                                        Gift card purchases and checkout debits will appear here as they happen.
                                    </p>
                                </div>
                            ) : (
                                data?.activity.map((entry) => (
                                    <div
                                        key={entry.id}
                                        className="flex flex-col gap-3 rounded-3xl border border-gray-100 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950 md:flex-row md:items-center md:justify-between"
                                    >
                                        <div className="flex items-start gap-4">
                                            <div className="rounded-2xl bg-orange-50 p-3 text-[#F58220] dark:bg-orange-950/20 dark:text-orange-300">
                                                {entry.transactionType === "debit" ? <Wallet className="h-5 w-5" /> : <Gift className="h-5 w-5" />}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-gray-900 dark:text-white">{entry.description}</p>
                                                <p className="text-sm text-gray-500 dark:text-zinc-400">
                                                    {entry.code ? `${entry.code} · ` : ""}{new Date(entry.createdAt).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-left md:text-right">
                                            <p className="text-lg font-bold text-gray-900 dark:text-white">{formatKobo(entry.amountKobo)}</p>
                                            <p className="text-xs uppercase tracking-[0.18em] text-gray-400">{entry.transactionType}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    )
}
