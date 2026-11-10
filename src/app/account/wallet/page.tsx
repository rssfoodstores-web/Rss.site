"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react"
import { ArrowUpFromLine, CheckCircle2, CreditCard, Gift, Info, Loader2, ShieldCheck, Wallet, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { WalletCheckoutProgress } from "@/components/account/WalletCheckoutProgress"
import { cn } from "@/lib/utils"
import { formatKobo } from "@/lib/money"
import { getBanks, getWalletData, initiateWithdrawal, verifyAccount, verifyWalletTopUp } from "./actions"
import { GiftCardClient } from "../gift-card/GiftCardClient"
import { getGiftCardData } from "../gift-card/actions"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { calculateTopupQuote, calculateWithdrawalQuote, DEFAULT_WALLET_FEE_SETTINGS, type WalletFeeSettings } from "@/lib/walletFees"

type WalletType = "customer" | "merchant" | "agent" | "rider"

interface WalletActivity {
    id: string
    wallet_id: string
    amount: number
    direction: "credit" | "debit"
    description: string
    reference: string | null
    created_at: string | null
    source: "wallet_transaction" | "ledger_entry"
    status: string
}

interface WalletSummary {
    id: string
    balance: number
    type: WalletType
    virtual_account: {
        bankName?: string
        accountNumber?: string
        accountName?: string
    } | null
    label: string
    description: string
    canTopUp: boolean
    canWithdraw: boolean
    withdrawAvailableNow: boolean
    actionSummary: string
    withdrawPolicyLabel: string
    withdrawPolicyHint: string
    entries: WalletActivity[]
}

interface BankOption {
    code: string
    name: string
}

type WalletTopupDiagnosticEvent =
    | "client_submit"
    | "client_pagehide"
    | "client_pageshow"
    | "client_navigation_timeout"
    | "wallet_returned_without_callback"
    | "server_failure_returned"
    | "provider_returned"
    | "payment_verification_error"
    | "payment_verification_complete"

interface PendingWalletTopup {
    attemptId: string
    startedAt: number
    reference?: string
    checkoutUrl?: string
    amount?: number
}

interface ReadyWalletTopup extends PendingWalletTopup {
    reference: string
    checkoutUrl: string
}

const PENDING_WALLET_TOPUP_KEY = "rss-wallet-topup-pending"
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isTrustedCheckoutUrl(value: unknown): value is string {
    if (typeof value !== "string") return false
    try {
        const url = new URL(value)
        return url.protocol === "https:" && url.hostname.endsWith(".monnify.com") && !url.username && !url.password
    } catch {
        return false
    }
}

function isReadyWalletTopup(value: PendingWalletTopup): value is ReadyWalletTopup {
    return typeof value.reference === "string"
        && /^WAL-[0-9a-f-]{36}$/i.test(value.reference)
        && isTrustedCheckoutUrl(value.checkoutUrl)
}

function createTopupAttemptId() {
    if (typeof crypto.randomUUID === "function") return crypto.randomUUID()
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function readPendingWalletTopup(): PendingWalletTopup | null {
    try {
        const storedValue = window.sessionStorage.getItem(PENDING_WALLET_TOPUP_KEY)
        if (!storedValue) return null

        const parsedValue = JSON.parse(storedValue) as Partial<PendingWalletTopup>
        if (
            typeof parsedValue.attemptId !== "string"
            || !UUID_PATTERN.test(parsedValue.attemptId)
            || typeof parsedValue.startedAt !== "number"
            || !Number.isFinite(parsedValue.startedAt)
        ) {
            window.sessionStorage.removeItem(PENDING_WALLET_TOPUP_KEY)
            return null
        }

        return {
            attemptId: parsedValue.attemptId,
            startedAt: parsedValue.startedAt,
            reference: typeof parsedValue.reference === "string" ? parsedValue.reference : undefined,
            checkoutUrl: isTrustedCheckoutUrl(parsedValue.checkoutUrl) ? parsedValue.checkoutUrl : undefined,
            amount: typeof parsedValue.amount === "number" && Number.isFinite(parsedValue.amount) && parsedValue.amount >= 100 ? parsedValue.amount : undefined,
        }
    } catch {
        return null
    }
}

function clearPendingWalletTopup() {
    try {
        window.sessionStorage.removeItem(PENDING_WALLET_TOPUP_KEY)
    } catch {
        // Session storage may be unavailable in private browsing modes.
    }
}

function isMonnifyReferrer(referrer: string) {
    if (!referrer) return false

    try {
        const hostname = new URL(referrer).hostname.toLowerCase()
        return hostname === "monnify.com" || hostname.endsWith(".monnify.com")
    } catch {
        return false
    }
}

function reportWalletTopupDiagnostic(
    attemptId: string | null,
    event: WalletTopupDiagnosticEvent,
    details?: Record<string, string | number | boolean>
) {
    if (!attemptId || !UUID_PATTERN.test(attemptId)) return

    void fetch("/api/wallet/topup/diagnostics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId, event, details }),
        keepalive: true,
    }).catch(() => {
        // Diagnostics must never block a checkout or payment-status message.
    })
}

function isPendingTopUp(entry: WalletActivity) {
    return entry.source === "wallet_transaction"
        && entry.direction === "credit"
        && entry.status.toLowerCase() === "pending"
        && /top.?up/i.test(entry.description)
}

function getActivityStatusLabel(entry: WalletActivity) {
    if (entry.source === "ledger_entry") return "Settled"

    switch (entry.status.toLowerCase()) {
        case "success":
        case "successful":
            return "Completed"
        case "pending":
            return isPendingTopUp(entry) ? "Awaiting confirmation" : "Processing"
        case "failed":
        case "failure":
            return "Failed"
        case "reversed":
            return "Reversed"
        default:
            return entry.status.replace(/_/g, " ")
    }
}

function getWithdrawalStatusMessage(status: string): { type: "success" | "error" | "info"; title: string; message: string } {
    switch (status.toLowerCase()) {
        case "success":
            return { type: "success", title: "Withdrawal completed", message: "Monnify confirmed this withdrawal as completed. Check your bank account for the credit." }
        case "failed":
            return { type: "error", title: "Withdrawal not completed", message: "Monnify reports that this withdrawal failed. Check your wallet activity before submitting another withdrawal." }
        case "reversed":
            return { type: "info", title: "Withdrawal reversed", message: "Monnify reports that this withdrawal was reversed. Check your wallet activity for the updated balance." }
        case "pending_authorization":
            return { type: "info", title: "Withdrawal awaiting approval", message: "This withdrawal is awaiting authorization. Check your wallet activity for updates before submitting another withdrawal." }
        case "submitted":
            return { type: "info", title: "Withdrawal processing", message: "Your withdrawal has been submitted for processing. Check your wallet activity for confirmation." }
        default:
            return { type: "info", title: "Withdrawal awaiting confirmation", message: "This withdrawal is not confirmed yet. Check your wallet activity before submitting another withdrawal." }
    }
}

type MoneyAction = "add" | "send" | "received"
type ActivityFilter = "all" | "wallet" | "gift"
type GiftCardData = Awaited<ReturnType<typeof getGiftCardData>>

export default function WalletPage() {
    const searchParams = useSearchParams()
    const giftView = searchParams.get("view") === "gift-cards"
    const giftReference = giftView ? searchParams.get("ref") : null
    const actionTrigger = useRef<HTMLElement | null>(null)
    const [action, setAction] = useState<MoneyAction | null>(giftView ? "received" : null)
    const [filter, setFilter] = useState<ActivityFilter>("all")
    const [giftData, setGiftData] = useState<GiftCardData | null>(null)
    const [giftLoading, setGiftLoading] = useState(true)
    const [giftError, setGiftError] = useState(false)
    const [loading, setLoading] = useState(true)
    const [walletLoadError, setWalletLoadError] = useState("")
    const [wallets, setWallets] = useState<WalletSummary[]>([])
    const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null)
    const [banks, setBanks] = useState<BankOption[]>([])
    const [banksLoading, setBanksLoading] = useState(false)
    const [banksError, setBanksError] = useState("")
    const [amount, setAmount] = useState("")
    const [selectedBank, setSelectedBank] = useState("")
    const [accountNumber, setAccountNumber] = useState("")
    const [accountName, setAccountName] = useState("")
    const [withdrawAmount, setWithdrawAmount] = useState("")
    const [topupLoading, setTopupLoading] = useState(false)
    const [readyTopup, setReadyTopup] = useState<ReadyWalletTopup | null>(null)
    const topupInFlight = useRef(false)
    const walletMounted = useRef(true)
    const activeTopupAttempt = useRef<string | null>(null)
    const paymentCheck = useRef<string | null>(null)
    const [withdrawLoading, setWithdrawLoading] = useState(false)
    const [verifying, setVerifying] = useState(false)
    const [isWithdrawOpen, setIsWithdrawOpen] = useState(false)
    const [walletFeeSettings, setWalletFeeSettings] = useState<WalletFeeSettings>(DEFAULT_WALLET_FEE_SETTINGS)
    const [statusModal, setStatusModal] = useState({ open: false, type: "success" as "success" | "error" | "info", title: "", message: "", btnText: "OK" })

    const activeWallet = useMemo(
        () => wallets.find((wallet) => wallet.id === selectedWalletId) ?? wallets[0] ?? null,
        [selectedWalletId, wallets]
    )
    const topupQuote = useMemo(() => {
        const kobo = Math.round(Number(amount || 0) * 100)
        return kobo > 0 ? calculateTopupQuote(kobo, walletFeeSettings) : null
    }, [amount, walletFeeSettings])
    const withdrawalQuote = useMemo(() => {
        const kobo = Math.round(Number(withdrawAmount || 0) * 100)
        return kobo > 0 ? calculateWithdrawalQuote(kobo, walletFeeSettings) : null
    }, [withdrawAmount, walletFeeSettings])

    const handleWalletSelection = (walletId: string | null) => {
        setSelectedWalletId(walletId)
        setSelectedBank("")
        setAccountNumber("")
        setAccountName("")
        setWithdrawAmount("")
        setIsWithdrawOpen(false)
    }

    function handleBankChange(value: string) {
        setSelectedBank(value)
        setAccountName("")
    }

    function handleAccountNumberChange(value: string) {
        const normalizedValue = value.replace(/\D/g, "").slice(0, 10)
        setAccountNumber(normalizedValue)
        setAccountName("")
    }

    const loadData = async (showInitialLoading = false, isCurrent: () => boolean = () => true) => {
        if (showInitialLoading && isCurrent()) setLoading(true)

        try {
            const result = await getWalletData()
            if (!isCurrent()) return
            if (result.error) throw new Error(result.error)

            const nextWallets = (result.wallets as WalletSummary[] | undefined) ?? []
            setWallets(nextWallets)
            if (result.walletFeeSettings) setWalletFeeSettings(result.walletFeeSettings as WalletFeeSettings)
            setSelectedWalletId((currentId) => (
                currentId && nextWallets.some((wallet) => wallet.id === currentId)
                    ? currentId
                    : (result.primaryWalletId as string | null) ?? nextWallets[0]?.id ?? null
            ))
            setWalletLoadError("")
        } catch (error) {
            if (isCurrent()) {
                setWalletLoadError(error instanceof Error ? error.message : "Your wallet could not be loaded.")
            }
        } finally {
            if (isCurrent()) setLoading(false)
        }
    }

    useEffect(() => {
        let cancelled = false
        walletMounted.current = true

        void loadData(true, () => !cancelled)
        void loadGiftCards(() => !cancelled)

        return () => {
            cancelled = true
            walletMounted.current = false
        }
    }, [])

    useEffect(() => {
        if (giftView) setAction("received")
    }, [giftView, giftReference])

    async function loadGiftCards(isCurrent = () => walletMounted.current) {
        setGiftLoading(true)
        setGiftError(false)
        try {
            const result = await getGiftCardData()
            if (!isCurrent()) return
            if (result.success) setGiftData(result)
            else setGiftError(true)
        } catch {
            if (isCurrent()) setGiftError(true)
        } finally {
            if (isCurrent()) setGiftLoading(false)
        }
    }

    async function loadBanks() {
        if (banks.length || banksLoading) return

        setBanksLoading(true)
        setBanksError("")
        try {
            const result = await getBanks()
            if (result.banks) {
                setBanks(result.banks as unknown as BankOption[])
            } else {
                setBanksError(result.error || "Bank list is temporarily unavailable.")
            }
        } catch {
            setBanksError("Bank list is temporarily unavailable.")
        } finally {
            setBanksLoading(false)
        }
    }

    useEffect(() => {
        const reportUnexpectedReturn = (pageShowEvent?: PageTransitionEvent) => {
            // Initial pageshow can arrive after a submit on a slowly loading page.
            // Only a restored document is a return; a normal load is handled on mount.
            if (pageShowEvent && !pageShowEvent.persisted) return
            if (topupInFlight.current) return
            const params = new URLSearchParams(window.location.search)
            if (params.get("view") === "gift-cards" && params.has("ref")) return
            const pendingTopup = readPendingWalletTopup()
            if (!pendingTopup) return

            if (pageShowEvent) {
                reportWalletTopupDiagnostic(pendingTopup.attemptId, "client_pageshow", {
                    persisted: pageShowEvent.persisted,
                    visibilityState: document.visibilityState,
                    returnedFromMonnify: isMonnifyReferrer(document.referrer),
                    paymentReturnPresent: params.get("payment") === "return",
                    topupErrorPresent: params.has("topup_error"),
                })
            }

            if (params.get("payment") === "return") {
                reportWalletTopupDiagnostic(params.get("topup_attempt") ?? pendingTopup.attemptId, "provider_returned", {
                    paymentReturnPresent: true,
                })
                clearPendingWalletTopup()
                return
            }

            if (params.has("topup_error")) {
                reportWalletTopupDiagnostic(params.get("topup_attempt") ?? pendingTopup.attemptId, "server_failure_returned", {
                    topupErrorPresent: true,
                })
                clearPendingWalletTopup()
                return
            }

            const pendingAgeMs = Date.now() - pendingTopup.startedAt
            if (pendingAgeMs < 0 || pendingAgeMs > 40 * 60 * 1000) {
                clearPendingWalletTopup()
                setReadyTopup(null)
                return
            }

            reportWalletTopupDiagnostic(pendingTopup.attemptId, "wallet_returned_without_callback", {
                pendingAgeMs,
                paymentReturnPresent: false,
                topupErrorPresent: false,
                persisted: pageShowEvent?.persisted ?? false,
                returnedFromMonnify: isMonnifyReferrer(document.referrer),
            })
            topupInFlight.current = false
            setTopupLoading(false)
            if (isReadyWalletTopup(pendingTopup)) {
                activeTopupAttempt.current = pendingTopup.attemptId
                if (pendingTopup.amount !== undefined) setAmount(String(pendingTopup.amount))
                setReadyTopup(pendingTopup)
                void checkPreparedTopup(pendingTopup)
            } else {
                clearPendingWalletTopup()
                showStatus("info", "Checkout was interrupted", `Check your wallet activity before starting another payment. Support code: ${pendingTopup.attemptId}`)
            }
        }

        reportUnexpectedReturn()
        window.addEventListener("pageshow", reportUnexpectedReturn)
        return () => window.removeEventListener("pageshow", reportUnexpectedReturn)
        // Install once: status checks read the current attempt and mounted refs.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        const handlePageHide = () => {
            const pending = readPendingWalletTopup()
            if (pending) reportWalletTopupDiagnostic(pending.attemptId, "client_pagehide", {
                visibilityState: document.visibilityState,
                checkoutPrepared: isReadyWalletTopup(pending),
            })
        }
        window.addEventListener("pagehide", handlePageHide)
        return () => window.removeEventListener("pagehide", handlePageHide)
    }, [])

    useEffect(() => {
        if (!readyTopup) return
        const expiresIn = readyTopup.startedAt + 40 * 60 * 1000 - Date.now()
        const timeout = window.setTimeout(() => {
            if (activeTopupAttempt.current !== readyTopup.attemptId) return
            activeTopupAttempt.current = null
            setReadyTopup(null)
            clearPendingWalletTopup()
        }, Math.max(0, expiresIn))
        return () => window.clearTimeout(timeout)
    }, [readyTopup])

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const topupError = params.get("topup_error")
        if (topupError) {
            const diagnosticId = params.get("topup_attempt")
            const supportCode = diagnosticId ? ` Support code: ${diagnosticId}` : ""
            showStatus("error", "Checkout could not be prepared", `${topupError}${supportCode}`)
            params.delete("topup_error")
            params.delete("topup_attempt")
            params.delete("topup_code")
            const remainingSearch = params.toString()
            window.history.replaceState(null, "", `${window.location.pathname}${remainingSearch ? `?${remainingSearch}` : ""}${window.location.hash}`)
        }

        if (params.get("payment") === "return") {
            const reference = params.get("ref") ?? ""
            const diagnosticId = params.get("topup_attempt")
            let cancelled = false

            showStatus("info", "Checking payment status", "We’re confirming your payment with Monnify. Your wallet will update as soon as it is verified.")

            const checkPayment = async () => {
                for (let attempt = 0; attempt < 12; attempt += 1) {
                    if (cancelled) return

                    if (reference) {
                        let result: Awaited<ReturnType<typeof verifyWalletTopUp>>
                        try {
                            result = await verifyWalletTopUp(reference)
                        } catch {
                            reportWalletTopupDiagnostic(diagnosticId, "payment_verification_error")
                            await loadData()
                            if (!cancelled) {
                                const supportCode = diagnosticId ? ` Support code: ${diagnosticId}` : ""
                                showStatus("error", "Payment status could not be checked", `If you paid, check your wallet activity before making another payment.${supportCode}`)
                            }
                            return
                        }
                        if (cancelled) return

                        if (!result.success) {
                            reportWalletTopupDiagnostic(diagnosticId, "payment_verification_error")
                            await loadData()
                            if (!cancelled) {
                                const supportCode = diagnosticId ? ` Support code: ${diagnosticId}` : ""
                                showStatus("error", "Payment status could not be checked", `If you paid, check your wallet activity before making another payment.${supportCode}`)
                            }
                            return
                        }

                        if (result.success && "status" in result && result.status === "PAID") {
                            reportWalletTopupDiagnostic(diagnosticId, "payment_verification_complete")
                            await loadData()
                            if (!cancelled) {
                                showStatus("success", "Wallet topped up", "Your payment is verified and your wallet balance has been updated.")
                            }
                            return
                        }

                        if (result.success && "status" in result && ["FAILED", "EXPIRED", "CANCELLED"].includes(result.status ?? "")) {
                            await loadData()
                            if (!cancelled) {
                                showStatus("error", "Payment not completed", "This checkout has ended without a confirmed payment. If you were debited, check your wallet activity before making another payment.")
                            }
                            return
                        }
                    }

                    if (attempt < 11) await new Promise((resolve) => window.setTimeout(resolve, 5000))
                }

                await loadData()
                if (!cancelled) {
                    showStatus("info", "Awaiting payment confirmation", "No payment confirmation is available yet. If you have already paid, check your wallet activity before starting another payment.")
                }
            }

            void checkPayment()
            return () => {
                cancelled = true
            }
        }
    }, [])

    function showStatus(type: "success" | "error" | "info", title: string, message: string, btnText = "OK") {
        setStatusModal({ open: true, type, title, message, btnText })
    }

    async function checkPreparedTopup(topup: ReadyWalletTopup) {
        if (paymentCheck.current === topup.attemptId) return
        paymentCheck.current = topup.attemptId
        const isCurrent = () => walletMounted.current && activeTopupAttempt.current === topup.attemptId
        showStatus("info", "Checking payment status", "We’re checking this payment with Monnify before you try again.")
        let result: Awaited<ReturnType<typeof verifyWalletTopUp>>
        try {
            result = await verifyWalletTopUp(topup.reference)
        } catch {
            if (isCurrent()) showStatus("info", "Payment status is unavailable", `Check your wallet activity before making another payment. Support code: ${topup.attemptId}`)
            return
        } finally {
            if (paymentCheck.current === topup.attemptId) paymentCheck.current = null
        }
        if (!isCurrent()) return
        await loadData()
        if (!isCurrent()) return
        if (result.success && "status" in result && result.status === "PAID") {
            activeTopupAttempt.current = null
            clearPendingWalletTopup()
            setReadyTopup(null)
            showStatus("success", "Wallet topped up", "Your payment is verified and your wallet balance has been updated.")
        } else if (result.success && "status" in result && ["FAILED", "EXPIRED", "CANCELLED"].includes(result.status ?? "")) {
            activeTopupAttempt.current = null
            clearPendingWalletTopup()
            setReadyTopup(null)
            showStatus("info", "Payment not completed", "This checkout has ended. If you were debited, check your wallet activity before starting another payment.")
        } else if (result.success) {
            showStatus("info", "Payment is not confirmed yet", `Monnify has not confirmed this payment yet. You can reopen the same checkout below. If you have already paid, check your wallet activity before paying again. Support code: ${topup.attemptId}`)
        } else {
            showStatus("info", "Payment status is unavailable", `Check your wallet activity before making another payment. Support code: ${topup.attemptId}`)
        }
    }

    async function handleTopupSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (topupInFlight.current) return
        if (readyTopup && Date.now() - readyTopup.startedAt < 40 * 60 * 1000) return
        const form = event.currentTarget
        const attemptId = createTopupAttemptId()
        activeTopupAttempt.current = attemptId
        const browserIOSVersion = navigator.userAgent.match(/(?:CPU (?:iPhone )?OS|iPhone OS) ([0-9_]+)/)?.[1]?.replaceAll("_", ".") ?? "unknown"
        reportWalletTopupDiagnostic(attemptId, "client_submit", {
            visibilityState: document.visibilityState,
            online: navigator.onLine,
            browserIOSVersion,
            broadcastChannelAvailable: typeof BroadcastChannel !== "undefined",
            cryptoUUIDAvailable: typeof crypto.randomUUID === "function",
        })
        const formData = new FormData(form)
        formData.set("attemptId", attemptId)
        topupInFlight.current = true
        setTopupLoading(true)
        setReadyTopup(null)

        try {
            window.sessionStorage.setItem(PENDING_WALLET_TOPUP_KEY, JSON.stringify({
                attemptId,
                startedAt: Date.now(),
            } satisfies PendingWalletTopup))
        } catch {
            // The diagnostic id is still submitted in the form when session storage is unavailable.
        }

        try {
            const actionUrl = new URL(form.action, window.location.href)
            actionUrl.searchParams.set("attemptId", attemptId)
            const response = await fetch(actionUrl, {
                method: "POST",
                headers: { Accept: "application/json" },
                body: formData,
            })
            let result: { error?: string; checkoutUrl?: string; reference?: string; attemptId?: string }
            try {
                result = await response.json()
            } catch {
                throw new Error("Checkout could not be prepared. Please try again.")
            }
            if (!walletMounted.current || activeTopupAttempt.current !== attemptId) return
            if (!response.ok || result.error) throw new Error(result.error || "Checkout could not be prepared.")
            const prepared = { attemptId, startedAt: Date.now(), reference: result.reference, checkoutUrl: result.checkoutUrl, amount: Number(formData.get("amount")) }
            if (result.attemptId !== attemptId || !isReadyWalletTopup(prepared)) throw new Error("Monnify did not provide a valid checkout link.")
            setReadyTopup(prepared)
            try {
                window.sessionStorage.setItem(PENDING_WALLET_TOPUP_KEY, JSON.stringify(prepared))
            } catch {
                // The direct checkout link remains usable without browser storage.
            }
        } catch {
            if (walletMounted.current && activeTopupAttempt.current === attemptId) {
                clearPendingWalletTopup()
                activeTopupAttempt.current = null
                showStatus("error", "Payment link unavailable", `We could not retrieve your payment link. If you have already paid, check your wallet activity before starting another payment. Support code: ${attemptId}`)
            }
        } finally {
            topupInFlight.current = false
            if (walletMounted.current) setTopupLoading(false)
        }
    }

    async function handleVerifyAccount() {
        if (!selectedBank || accountNumber.length !== 10) {
            return
        }

        setVerifying(true)
        try {
            const result = await verifyAccount(selectedBank, accountNumber)
            if (result.success) {
                setAccountName(result.accountName)
                return
            }

            setAccountName("")
            showStatus("error", "Verification failed", result.error || "Unable to verify bank account.")
        } catch {
            setAccountName("")
            showStatus("error", "Verification failed", "Unable to verify this account right now. Please try again.")
        } finally {
            setVerifying(false)
        }
    }

    async function handleWithdraw() {
        if (!activeWallet) {
            showStatus("error", "Wallet unavailable", "Select a wallet before withdrawing.")
            return
        }

        if (!activeWallet.withdrawAvailableNow) {
            showStatus("error", "Withdrawals unavailable", activeWallet.withdrawPolicyHint)
            return
        }

        const numericAmount = Number.parseFloat(withdrawAmount)
        if (Number.isNaN(numericAmount) || numericAmount < 1000) {
            showStatus("error", "Invalid amount", "Minimum withdrawal is ₦1,000.")
            return
        }

        if (!accountName) {
            showStatus("error", "Account not verified", "Verify the bank account before withdrawing.")
            return
        }

        const bank = banks.find((entry) => entry.code === selectedBank)

        setWithdrawLoading(true)
        try {
            const result = await initiateWithdrawal(
                activeWallet.id,
                selectedBank,
                accountNumber,
                numericAmount,
                bank?.name || ""
            )

            if (result.success) {
                setIsWithdrawOpen(false)
                const status = getWithdrawalStatusMessage(result.status ?? "unknown")
                showStatus(status.type, status.title, status.message)
                void loadData()
                return
            }

            showStatus("error", "Withdrawal could not be confirmed", result.error || "Check your wallet activity before submitting another withdrawal.")
        } catch {
            showStatus("error", "Withdrawal could not be confirmed", "We could not confirm the request. Check your activity before trying again.")
        } finally {
            setWithdrawLoading(false)
        }
    }

    function openAction(next: MoneyAction, titleId: string) {
        actionTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
        setAction(next)
        requestAnimationFrame(() => document.getElementById(titleId)?.focus())
    }

    function closeAction() {
        setAction(null)
        actionTrigger.current?.focus()
    }

    const walletActivity = (activeWallet?.entries ?? []).map((entry) => {
        const pending = isPendingTopUp(entry)
        return {
            id: `wallet-${entry.id}`, source: "wallet", title: entry.description,
            date: entry.created_at, reference: entry.reference,
            amount: `${pending ? "" : entry.direction === "credit" ? "+" : "−"}${formatKobo(entry.amount)}`,
            status: getActivityStatusLabel(entry),
        }
    })
    const giftActivity = (giftData?.activity ?? []).map((entry) => ({
        id: `gift-${entry.id}`, source: "gift", title: entry.description,
        date: entry.createdAt, reference: entry.code ?? entry.reference,
        amount: formatKobo(entry.amountKobo), status: entry.transactionType.replace(/_/g, " "),
    }))
    const activity = [...walletActivity, ...giftActivity]
        .filter((entry) => filter === "all" || filter === entry.source)
        .sort((a, b) => (Date.parse(b.date ?? "") || 0) - (Date.parse(a.date ?? "") || 0))
    const showTopup = activeWallet?.canTopUp && (action === "add" || topupLoading || readyTopup !== null)

    return (
        <main className="mx-auto min-w-0 max-w-4xl space-y-5 py-2 sm:py-4">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Wallet &amp; gift cards</h1>
            {activeWallet && wallets.length > 1 && (
                <nav aria-label="Choose a wallet" className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0">
                    {wallets.map((wallet) => <button key={wallet.id} type="button" aria-pressed={wallet.id === activeWallet.id} onClick={() => handleWalletSelection(wallet.id)} className={cn("min-w-[170px] shrink-0 rounded-2xl border px-4 py-3 text-left", wallet.id === activeWallet.id ? "border-[#F58220] bg-orange-50 dark:bg-orange-950/20" : "border-gray-200 bg-white dark:border-zinc-800 dark:bg-zinc-900")}><span className="block text-sm font-bold text-gray-900 dark:text-white">{wallet.label}</span><span className="mt-1 block text-sm text-gray-600 dark:text-gray-400">{formatKobo(wallet.balance)}</span></button>)}
                </nav>
            )}
            <div className="grid overflow-hidden rounded-2xl border bg-card md:grid-cols-2">
                <section className="min-w-0 bg-orange-50 p-4 dark:bg-orange-950/30 sm:p-5" aria-labelledby="wallet-balance">
                    <h2 id="wallet-balance" className="flex items-center gap-2 text-sm font-semibold"><Wallet className="size-4" aria-hidden="true" />{activeWallet?.type !== "customer" && activeWallet ? activeWallet.label : "Wallet balance"}</h2>
                    {loading ? <p className="mt-2 text-sm" role="status">Loading wallet…</p> : activeWallet && !walletLoadError ? (
                        <>
                            <p className="mt-1 break-words text-3xl font-bold tracking-tight tabular-nums">{formatKobo(activeWallet.balance)}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{activeWallet.canTopUp ? "Pay for orders or withdraw to your bank." : activeWallet.description}</p>
                            <div className="mt-4 flex flex-wrap gap-2">
                                {activeWallet.canTopUp && <Button className="min-h-11 rounded-xl" aria-expanded={Boolean(showTopup)} onClick={() => openAction("add", "add-money-title")}>Add money</Button>}
                                {activeWallet.canWithdraw && (
                                    <Dialog open={isWithdrawOpen} onOpenChange={(open) => { setIsWithdrawOpen(open); if (open) void loadBanks() }}>
                                        <DialogTrigger asChild><Button variant="outline" className="min-h-11 rounded-xl" disabled={!activeWallet.withdrawAvailableNow}><ArrowUpFromLine className="mr-2 h-5 w-5" />{activeWallet.withdrawAvailableNow ? "Withdraw to bank" : "Withdrawals locked"}</Button></DialogTrigger>
                                        <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-3xl border-gray-200 bg-white p-0 dark:border-zinc-800 dark:bg-zinc-900 sm:max-w-[480px]">
                                            <DialogHeader className="border-b border-gray-100 p-5 pb-4 dark:border-zinc-800 sm:p-6"><DialogTitle className="text-xl font-bold">Withdraw to your bank</DialogTitle><DialogDescription>Choose your bank, verify your account, then enter how much to withdraw from {activeWallet.label.toLowerCase()}.</DialogDescription></DialogHeader>
                                            <div className="space-y-5 p-5 sm:p-6">
                                                <ol className="grid grid-cols-3 gap-2 text-center text-[11px] font-semibold text-gray-600 dark:text-gray-300 sm:text-xs">{["1 · Choose bank", "2 · Verify account", "3 · Enter amount"].map((step) => <li key={step} className="rounded-xl bg-gray-50 px-2 py-2 dark:bg-zinc-800">{step}</li>)}</ol>
                                                <div className="space-y-2"><label htmlFor="wallet-bank" className="text-sm font-semibold text-gray-800 dark:text-gray-200">Your bank</label><select id="wallet-bank" className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm dark:border-zinc-700 dark:bg-zinc-800" value={selectedBank} onChange={(event) => handleBankChange(event.target.value)} disabled={banksLoading}><option value="">{banksLoading ? "Loading banks…" : "Select your bank"}</option>{banks.map((bank) => <option key={bank.code} value={bank.code}>{bank.name}</option>)}</select>{!banksLoading && banks.length === 0 ? <div className="flex items-center justify-between gap-3 text-xs text-amber-700 dark:text-amber-300"><span>{banksError || "Bank list is temporarily unavailable."}</span><button type="button" className="shrink-0 font-bold underline" onClick={() => void loadBanks()}>Retry</button></div> : null}</div>
                                                <div className="space-y-2"><label htmlFor="wallet-account-number" className="text-sm font-semibold text-gray-800 dark:text-gray-200">10-digit account number</label><div className="flex gap-2"><Input id="wallet-account-number" inputMode="numeric" autoComplete="off" maxLength={10} placeholder="e.g. 0123456789" className="h-12 min-w-0 rounded-xl bg-gray-50 dark:bg-zinc-800" value={accountNumber} onChange={(event) => handleAccountNumberChange(event.target.value)} /><Button type="button" variant="secondary" className="h-12 shrink-0 rounded-xl px-4 font-bold" onClick={handleVerifyAccount} disabled={verifying || !selectedBank || accountNumber.length !== 10}>{verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}</Button></div>{accountName ? <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"><ShieldCheck className="h-5 w-5 shrink-0" /><span>Verified account: <strong>{accountName}</strong></span></div> : <p className="text-xs text-gray-500 dark:text-gray-400">We verify the name before any withdrawal can be submitted.</p>}</div>
                                                <div className="space-y-2"><label htmlFor="wallet-withdraw-amount" className="text-sm font-semibold text-gray-800 dark:text-gray-200">Amount to withdraw</label><Input id="wallet-withdraw-amount" type="number" inputMode="decimal" min="1000" step="100" placeholder="Minimum ₦1,000" className="h-12 rounded-xl bg-gray-50 text-lg font-semibold dark:bg-zinc-800" value={withdrawAmount} onChange={(event) => setWithdrawAmount(event.target.value)} /><p className="text-xs text-gray-500 dark:text-gray-400">Available: {formatKobo(activeWallet.balance)} · Minimum withdrawal ₦1,000</p></div>
                                                {withdrawalQuote && withdrawalQuote.walletDebitKobo >= 100000 ? <div className="space-y-2 rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-800/70"><div className="flex justify-between gap-3"><span>Deducted from wallet</span><strong>{formatKobo(withdrawalQuote.walletDebitKobo)}</strong></div><div className="flex justify-between gap-3"><span>Transfer and service fees</span><span>{formatKobo(withdrawalQuote.processorFeeKobo + withdrawalQuote.processorVatKobo + withdrawalQuote.rssFeeKobo)}</span></div><div className="flex justify-between gap-3 border-t border-gray-200 pt-2 dark:border-zinc-700"><strong>Your bank receives</strong><strong className="text-emerald-700 dark:text-emerald-300">{formatKobo(withdrawalQuote.bankReceivesKobo)}</strong></div></div> : null}
                                            </div>
                                            <DialogFooter className="sticky bottom-0 flex-col gap-2 border-t border-gray-100 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:p-5"><Button variant="ghost" className="min-h-11 w-full rounded-xl sm:w-auto" onClick={() => setIsWithdrawOpen(false)}>Cancel</Button><Button className="min-h-11 w-full rounded-xl bg-[#F58220] font-bold text-white hover:bg-[#E57210] sm:flex-1" onClick={handleWithdraw} disabled={withdrawLoading || !accountName || !activeWallet.withdrawAvailableNow || !withdrawAmount}>{withdrawLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowUpFromLine className="mr-2 h-4 w-4" />}Confirm withdrawal</Button></DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                )}
                            </div>
                            {activeWallet.canWithdraw && !activeWallet.withdrawAvailableNow && <p className="mt-2 text-sm text-muted-foreground">{activeWallet.withdrawPolicyHint}</p>}
                        </>
                    ) : (
                        <div className="mt-2 space-y-2">
                            <p role="status" className="text-sm">{walletLoadError || "Your wallet is being prepared."}</p>
                            <Button variant="outline" onClick={() => void loadData(true)}>Refresh wallet</Button>
                        </div>
                    )}
                </section>
                <section className="min-w-0 border-t p-4 sm:p-5 md:border-l md:border-t-0" aria-labelledby="gift-balance">
                    <h2 id="gift-balance" className="flex items-center gap-2 text-sm font-semibold"><Gift className="size-4" aria-hidden="true" />Gift card balance</h2>
                    {giftData && <p className="mt-1 break-words text-3xl font-bold tracking-tight tabular-nums">{formatKobo(giftData.summary.availableBalanceKobo)}</p>}
                    {giftLoading && !giftData && <p className="mt-2 text-sm" role="status">Loading gift cards…</p>}
                    <p className="mt-1 text-sm text-muted-foreground">Use received gift cards at checkout.</p>
                    {giftError && <p role="status" className="mt-2 text-sm">Gift cards could not load. <button type="button" className="underline" onClick={() => void loadGiftCards()}>Try again</button></p>}
                    <div className="mt-4 flex flex-wrap gap-2">
                        <Button variant="outline" className="min-h-11 rounded-xl" aria-expanded={action === "send"} onClick={() => openAction("send", "gift-action-title")}>Send a gift card</Button>
                        <Button variant="outline" className="min-h-11 rounded-xl" aria-expanded={action === "received"} onClick={() => openAction("received", "gift-action-title")}>My gift cards</Button>
                    </div>
                </section>
            </div>
            {giftReference && <p role="status" className="rounded-xl border bg-card p-3 text-sm">Payment reference <strong className="break-all">{giftReference}</strong>. Your gift card will appear after payment is confirmed.</p>}
            {showTopup && (
                <section id="add-money" aria-labelledby="add-money-title" className="rounded-2xl border bg-card p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-2">
                        <h2 id="add-money-title" tabIndex={-1} className="font-semibold">Add money</h2>
                        {!readyTopup && !topupLoading && <Button variant="ghost" onClick={closeAction}>Close</Button>}
                    </div>
                    <p className="text-sm text-muted-foreground">Review the total before continuing to Monnify.</p>
                    <form action="/api/wallet/topup" method="post" onSubmit={handleTopupSubmit} className="mt-5 space-y-4">
                        <input type="hidden" name="attemptId" defaultValue="" />
                        <div className="space-y-2"><label htmlFor="wallet-topup-amount" className="text-sm font-semibold text-gray-800 dark:text-gray-200">How much would you like to add?</label><div className="flex h-14 items-center rounded-xl border border-gray-200 bg-gray-50 px-4 focus-within:border-[#F58220] dark:border-zinc-700 dark:bg-zinc-800"><span className="mr-2 text-lg font-bold text-gray-500">₦</span><Input id="wallet-topup-amount" name="amount" disabled={topupLoading || readyTopup !== null} type="number" inputMode="decimal" min="100" step="100" placeholder="Enter amount" className="h-full border-0 bg-transparent px-0 text-lg font-semibold shadow-none focus-visible:ring-0 dark:bg-transparent" value={amount} onChange={(event) => setAmount(event.target.value)} required /></div><p className="text-xs text-gray-500 dark:text-gray-400">Minimum top-up is ₦100. You’ll review any fees before you pay.</p></div>
                        <div className="flex flex-wrap gap-2">{[5000, 10000, 20000, 50000].map((quickAmount) => <button key={quickAmount} type="button" disabled={topupLoading || readyTopup !== null} onClick={() => setAmount(String(quickAmount))} className={cn("min-h-10 rounded-full border px-4 text-sm font-semibold", amount === String(quickAmount) ? "border-[#F58220] bg-orange-50 text-[#c95c00] dark:bg-orange-950/30 dark:text-orange-200" : "border-gray-200 text-gray-700 dark:border-zinc-700 dark:text-gray-200")}>₦{quickAmount.toLocaleString()}</button>)}</div>
                        {topupQuote ? <div className="space-y-2 rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-800/70"><div className="flex justify-between gap-3"><span>Wallet credit</span><strong>{formatKobo(topupQuote.walletCreditKobo)}</strong></div><div className="flex justify-between gap-3"><span>Payment fees</span><span>{formatKobo(topupQuote.processorFeeKobo + topupQuote.processorVatKobo + topupQuote.rssFeeKobo)}</span></div><div className="flex justify-between gap-3 border-t border-gray-200 pt-2 text-base dark:border-zinc-700"><strong>Total you’ll pay</strong><strong>{formatKobo(topupQuote.totalChargeKobo)}</strong></div></div> : null}
                        {topupLoading ? <WalletCheckoutProgress /> : null}
                        {readyTopup ? (
                            <div className="space-y-3 rounded-2xl border border-orange-200 bg-orange-50 p-4 dark:border-orange-900/50 dark:bg-orange-950/20">
                                <p className="font-semibold text-gray-900 dark:text-white">Your secure checkout is ready</p>
                                <p className="text-sm text-gray-600 dark:text-gray-300">Open Monnify to complete payment. Reopening this link uses the same checkout. If you have already paid, check the payment status before paying again.</p>
                                <Button asChild className="min-h-12 w-full rounded-xl bg-[#F58220] text-base font-bold text-white hover:bg-[#E87512]">
                                    <a href={readyTopup.checkoutUrl} onClick={() => reportWalletTopupDiagnostic(readyTopup.attemptId, "client_submit", { checkoutPrepared: true })}>Open Monnify checkout</a>
                                </Button>
                                <div className="flex flex-wrap gap-3">
                                    <button type="button" className="min-h-10 text-sm font-semibold text-orange-800 underline dark:text-orange-300" onClick={() => void checkPreparedTopup(readyTopup)}>Check payment status</button>
                                </div>
                            </div>
                        ) : <Button type="submit" className="min-h-12 w-full rounded-xl bg-[#F58220] text-base font-bold text-white hover:bg-[#E87512] sm:w-auto sm:min-w-64" disabled={topupLoading || !amount || Number(amount) < 100}>{topupLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CreditCard className="mr-2 h-5 w-5" />}{topupLoading ? "Preparing secure payment…" : "Continue to secure payment"}</Button>}
                    </form>
                </section>
            )}
            {(action === "send" || action === "received") && (
                <section className="space-y-3 rounded-2xl border bg-card p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-2">
                        <h2 id="gift-action-title" tabIndex={-1} className="font-semibold">{action === "send" ? "Send a gift card" : "My gift cards"}</h2>
                        <Button variant="ghost" onClick={closeAction}>Close</Button>
                    </div>
                    <GiftCardClient view={action} data={giftData} loading={giftLoading} failed={giftError} onPurchase={() => {
                        void loadGiftCards()
                        void loadData()
                    }} />
                </section>
            )}
            <section aria-labelledby="money-activity">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h2 id="money-activity" className="text-lg font-semibold">Recent activity</h2>
                    <div className="flex flex-wrap gap-1" role="group" aria-label="Filter activity">
                        {([["all", "All"], ["wallet", "Wallet"], ["gift", "Gift cards"]] as const).map(([value, label]) => (
                            <Button key={value} variant={filter === value ? "secondary" : "ghost"} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</Button>
                        ))}
                    </div>
                </div>
                {activity.length > 0 ? (
                    <ul className="divide-y border-y">
                        {activity.map((entry) => (
                            <li key={entry.id} className="flex items-start justify-between gap-3 py-3">
                                <div className="min-w-0">
                                    <p className="break-words text-sm font-semibold">{entry.title}</p>
                                    <p className="break-words text-xs text-muted-foreground">
                                        {entry.source === "wallet" ? "Wallet" : "Gift cards"}
                                        {entry.date && ` · ${new Date(entry.date).toLocaleString()}`}
                                        {entry.reference && ` · ${entry.reference}`}
                                    </p>
                                </div>
                                <div className="shrink-0 text-right">
                                    <p className="text-sm font-semibold tabular-nums">{entry.amount}</p>
                                    <p className="text-xs capitalize text-muted-foreground">{entry.status}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : <p className="border-t py-3 text-sm text-muted-foreground" role="status">
                    {(filter !== "gift" && loading) || (filter !== "wallet" && giftLoading) ? "Loading activity…" :
                        (filter !== "gift" && walletLoadError) || (filter !== "wallet" && giftError) ? "Some activity could not load." : "No activity yet."}
                </p>}
            </section>
            <Link href="/account/rewards" className="inline-flex min-h-11 items-center text-sm font-medium text-muted-foreground underline underline-offset-4">View rewards</Link>
            <Dialog open={statusModal.open} onOpenChange={(open) => setStatusModal((current) => ({ ...current, open }))}>
                <DialogContent className="sm:max-w-[420px] rounded-[32px] border-none bg-white p-8 shadow-2xl dark:bg-zinc-900">
                    <DialogHeader className="sr-only">
                        <DialogTitle>{statusModal.title}</DialogTitle>
                        <DialogDescription>{statusModal.message}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6 text-center">
                        <div className={cn("mx-auto flex h-24 w-24 items-center justify-center rounded-full", statusModal.type === "success" ? "bg-[#F58220]/10" : statusModal.type === "error" ? "bg-red-500/10" : "bg-blue-500/10")}>
                            {statusModal.type === "success" ? <CheckCircle2 className="h-12 w-12 text-[#F58220]" /> : statusModal.type === "error" ? <XCircle className="h-12 w-12 text-red-500" /> : <Info className="h-12 w-12 text-blue-600" />}
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{statusModal.title}</h3>
                            <p className="text-gray-500 dark:text-gray-400">{statusModal.message}</p>
                        </div>
                        <Button className={cn("h-14 w-full rounded-2xl text-lg font-bold", statusModal.type === "success" ? "bg-[#F58220] text-white hover:bg-[#E57210]" : statusModal.type === "error" ? "bg-red-500 text-white hover:bg-red-600" : "bg-blue-600 text-white hover:bg-blue-700")} onClick={() => setStatusModal((current) => ({ ...current, open: false }))}>
                            {statusModal.btnText}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </main>
    )
}
