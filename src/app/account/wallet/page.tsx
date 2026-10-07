"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowDownToLine, ArrowUpFromLine, Check, CheckCircle2, Copy, CreditCard, Info, Landmark, Loader2, ShieldCheck, Wallet, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ProfileSidebar } from "@/components/account/ProfileSidebar"
import { cn } from "@/lib/utils"
import { formatKobo } from "@/lib/money"
import { createWalletDepositAccount, getBanks, getWalletData, initiateWithdrawal, initializeTopUp, verifyAccount } from "./actions"
import { getRewardWalletSnapshot, type RewardWalletSnapshot } from "@/app/account/rewards/actions"
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

export default function WalletPage() {
    const [loading, setLoading] = useState(true)
    const [walletLoadError, setWalletLoadError] = useState("")
    const [wallets, setWallets] = useState<WalletSummary[]>([])
    const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null)
    const [rewardSnapshot, setRewardSnapshot] = useState<RewardWalletSnapshot | null>(null)
    const [banks, setBanks] = useState<BankOption[]>([])
    const [banksLoading, setBanksLoading] = useState(false)
    const [banksError, setBanksError] = useState("")
    const [depositAccountLoading, setDepositAccountLoading] = useState(false)
    const [rewardLoading, setRewardLoading] = useState(true)
    const [fundingMethod, setFundingMethod] = useState<"online" | "transfer">("online")
    const [amount, setAmount] = useState("")
    const [selectedBank, setSelectedBank] = useState("")
    const [accountNumber, setAccountNumber] = useState("")
    const [accountName, setAccountName] = useState("")
    const [withdrawAmount, setWithdrawAmount] = useState("")
    const [topupLoading, setTopupLoading] = useState(false)
    const [withdrawLoading, setWithdrawLoading] = useState(false)
    const [verifying, setVerifying] = useState(false)
    const [copied, setCopied] = useState(false)
    const [isWithdrawOpen, setIsWithdrawOpen] = useState(false)
    const [walletFeeSettings, setWalletFeeSettings] = useState<WalletFeeSettings>(DEFAULT_WALLET_FEE_SETTINGS)
    const [statusModal, setStatusModal] = useState({ open: false, type: "success" as "success" | "error", title: "", message: "", btnText: "OK" })

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

        void loadData(true, () => !cancelled)
        void getRewardWalletSnapshot().then((rewardData) => {
            if (!cancelled) setRewardSnapshot(rewardData)
        }).catch(() => {
            if (!cancelled) setRewardSnapshot(null)
        }).finally(() => {
            if (!cancelled) setRewardLoading(false)
        })

        return () => {
            cancelled = true
        }
    }, [])

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

    async function setupDepositAccount() {
        if (depositAccountLoading) return

        setDepositAccountLoading(true)
        try {
            const result = await createWalletDepositAccount()
            if (result.success && result.account) {
                setWallets((currentWallets) => currentWallets.map((wallet) => (
                    wallet.type === "customer" ? { ...wallet, virtual_account: result.account } : wallet
                )))
            } else {
                showStatus("error", "Account setup incomplete", result.error || "We could not create your transfer account.")
            }
        } catch {
            showStatus("error", "Account setup incomplete", "We could not create your transfer account. Please try again.")
        } finally {
            setDepositAccountLoading(false)
        }
    }

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        if (params.get("payment") === "return") {
            showStatus("success", "Payment received", "Monnify has returned you to RSS. Your wallet will update as soon as payment verification finishes.")
            void loadData()
        }
    }, [])

    function showStatus(type: "success" | "error", title: string, message: string, btnText = "OK") {
        setStatusModal({ open: true, type, title, message, btnText })
    }

    async function handleTopUp() {
        const numericAmount = Number.parseFloat(amount)
        if (Number.isNaN(numericAmount) || numericAmount < 100) {
            showStatus("error", "Invalid amount", "Minimum top-up is ₦100.")
            return
        }

        setTopupLoading(true)
        try {
            const result = await initializeTopUp(numericAmount)
            if (result.success && result.checkoutUrl) {
                window.location.href = result.checkoutUrl
                return
            }

            showStatus("error", "Top-up failed", result.error || "Unable to start payment.")
        } catch {
            showStatus("error", "Top-up failed", "Unable to start payment. Please check your connection and try again.")
        } finally {
            setTopupLoading(false)
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
                showStatus("success", "Withdrawal submitted", "Your withdrawal request was submitted successfully.")
                void loadData()
                return
            }

            showStatus("error", "Withdrawal failed", result.error || "Unable to process the withdrawal.")
        } catch {
            showStatus("error", "Withdrawal failed", "We could not confirm the request. Check your activity before trying again.")
        } finally {
            setWithdrawLoading(false)
        }
    }

    async function copyToClipboard() {
        const account = activeWallet?.virtual_account?.accountNumber
        if (!account) return
        try {
            await navigator.clipboard.writeText(account)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch {
            showStatus("error", "Could not copy account number", "Press and hold the account number to copy it manually.")
        }
    }

    return (
        <div className="min-h-screen bg-[#f7f8fa] py-5 dark:bg-black sm:py-8">
            <div className="mx-auto w-full max-w-[1440px] px-3 sm:px-6 lg:px-8">
                <header className="mb-5 sm:mb-7">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#F58220]">Your money, made simple</p>
                    <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-950 dark:text-white sm:text-3xl">Wallet</h1>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 sm:text-base">Add money, withdraw to your bank, and track every transaction.</p>
                </header>

                <div className="grid min-w-0 gap-4 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-7">
                    <aside className="min-w-0"><ProfileSidebar /></aside>
                    <main className="min-w-0 space-y-4 sm:space-y-6">
                        {loading ? (
                            <div role="status" aria-label="Loading your wallet" className="space-y-4 sm:space-y-6">
                                <span className="sr-only">Preparing your wallet…</span>
                                <section className="rounded-3xl bg-gradient-to-br from-zinc-900 to-[#49220a] p-5 text-white shadow-xl sm:p-8">
                                    <div className="motion-safe:animate-pulse">
                                        <div className="h-4 w-28 rounded bg-white/15" />
                                        <div className="mt-4 h-11 w-52 max-w-full rounded-xl bg-white/15" />
                                        <div className="mt-3 h-4 w-64 max-w-full rounded bg-white/10" />
                                        <div className="mt-7 grid grid-cols-2 gap-3"><div className="h-12 rounded-xl bg-white/15" /><div className="h-12 rounded-xl bg-white/10" /></div>
                                    </div>
                                    <p className="mt-5 text-xs text-white/65">Loading your latest balance and activity…</p>
                                </section>
                                <section className="space-y-4 rounded-3xl border border-gray-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
                                    <div className="h-5 w-40 rounded bg-gray-100 motion-safe:animate-pulse dark:bg-zinc-800" />
                                    <div className="h-12 rounded-xl bg-gray-100 motion-safe:animate-pulse dark:bg-zinc-800" />
                                    <div className="h-12 rounded-xl bg-gray-100 motion-safe:animate-pulse dark:bg-zinc-800" />
                                </section>
                                <section className="space-y-3 rounded-3xl border border-gray-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
                                    <div className="h-5 w-36 rounded bg-gray-100 motion-safe:animate-pulse dark:bg-zinc-800" />
                                    {[0, 1, 2].map((item) => <div key={item} className="flex items-center gap-3 border-t border-gray-100 pt-3 dark:border-zinc-800"><div className="h-10 w-10 rounded-full bg-gray-100 motion-safe:animate-pulse dark:bg-zinc-800" /><div className="flex-1 space-y-2"><div className="h-4 w-40 max-w-full rounded bg-gray-100 motion-safe:animate-pulse dark:bg-zinc-800" /><div className="h-3 w-24 rounded bg-gray-100 motion-safe:animate-pulse dark:bg-zinc-800" /></div></div>)}
                                </section>
                            </div>
                        ) : walletLoadError ? (
                            <section role="alert" className="rounded-3xl border border-red-200 bg-white p-6 dark:border-red-900/50 dark:bg-zinc-900">
                                <h2 className="font-bold text-gray-900 dark:text-white">Your wallet did not load</h2>
                                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{walletLoadError}</p>
                                <Button className="mt-4 min-h-11 rounded-xl bg-[#F58220] text-white hover:bg-[#E57210]" onClick={() => void loadData(true)}>Try again</Button>
                            </section>
                        ) : !activeWallet ? (
                            <section className="rounded-3xl border border-gray-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
                                <Wallet className="mx-auto h-10 w-10 text-[#F58220]" />
                                <h2 className="mt-3 text-lg font-bold text-gray-900 dark:text-white">Your wallet is being prepared</h2>
                                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Refresh in a moment to check your balance.</p>
                                <Button className="mt-4 min-h-11 rounded-xl bg-[#F58220] text-white hover:bg-[#E57210]" onClick={() => void loadData(true)}>Refresh wallet</Button>
                            </section>
                        ) : (
                            <div className="space-y-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 sm:space-y-6">
                                {wallets.length > 1 ? (
                                    <nav aria-label="Choose a wallet" className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0">
                                        {wallets.map((wallet) => <button key={wallet.id} type="button" aria-pressed={wallet.id === activeWallet.id} onClick={() => handleWalletSelection(wallet.id)} className={cn("min-w-[170px] shrink-0 rounded-2xl border px-4 py-3 text-left", wallet.id === activeWallet.id ? "border-[#F58220] bg-orange-50 dark:bg-orange-950/20" : "border-gray-200 bg-white dark:border-zinc-800 dark:bg-zinc-900")}><span className="block text-sm font-bold text-gray-900 dark:text-white">{wallet.label}</span><span className="mt-1 block text-sm text-gray-600 dark:text-gray-400">{formatKobo(wallet.balance)}</span></button>)}
                                    </nav>
                                ) : null}

                                <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-950 via-zinc-900 to-[#612b0a] p-5 text-white shadow-xl sm:p-8">
                                    <div className="pointer-events-none absolute -right-12 -top-20 h-56 w-56 rounded-full bg-[#F58220]/20 blur-3xl" />
                                    <div className="relative">
                                        <div className="flex items-center gap-2 text-sm text-white/75"><Wallet className="h-4 w-4 text-orange-300" /><span>{activeWallet.label}</span></div>
                                        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-white/60">Available balance</p>
                                        <h2 className="mt-1 break-words text-4xl font-bold tracking-tight sm:text-5xl">{formatKobo(activeWallet.balance)}</h2>
                                        <p className="mt-3 max-w-2xl text-sm text-white/75">{activeWallet.description}</p>
                                        <div className="mt-6 grid gap-3 sm:flex sm:flex-wrap">
                                            {activeWallet.canTopUp ? <Button className="h-12 w-full rounded-xl bg-[#F58220] text-base font-bold text-white hover:bg-[#e87512] sm:w-auto sm:min-w-44" onClick={() => { setFundingMethod("online"); document.getElementById("add-money")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }) }}><ArrowDownToLine className="mr-2 h-5 w-5" />Add money</Button> : null}
                                            {activeWallet.canWithdraw ? (
                                                <Dialog open={isWithdrawOpen} onOpenChange={(open) => { setIsWithdrawOpen(open); if (open) void loadBanks() }}>
                                                    <DialogTrigger asChild><Button variant="outline" className="h-12 w-full rounded-xl border-white/25 bg-white/10 text-base font-bold text-white hover:bg-white/20 sm:w-auto sm:min-w-44" disabled={!activeWallet.withdrawAvailableNow}><ArrowUpFromLine className="mr-2 h-5 w-5" />{activeWallet.withdrawAvailableNow ? "Withdraw to bank" : "Withdrawals locked"}</Button></DialogTrigger>
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
                                            ) : null}
                                        </div>
                                        {!activeWallet.withdrawAvailableNow && activeWallet.canWithdraw ? <p className="mt-3 flex items-start gap-2 text-xs text-white/70"><Info className="mt-0.5 h-4 w-4 shrink-0" />{activeWallet.withdrawPolicyHint}</p> : null}
                                    </div>
                                </section>

                                {activeWallet.canTopUp ? (
                                    <section id="add-money" className="scroll-mt-5 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-7">
                                        <div className="flex items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-[#F58220] dark:bg-orange-950/30"><ArrowDownToLine className="h-5 w-5" /></div><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#F58220]">Add money</p><h2 className="mt-1 text-xl font-bold text-gray-950 dark:text-white sm:text-2xl">Choose how to fund your wallet</h2><p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Pay securely online or transfer from your bank account.</p></div></div>
                                        <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-gray-100 p-1.5 dark:bg-zinc-800"><button type="button" aria-pressed={fundingMethod === "online"} onClick={() => setFundingMethod("online")} className={cn("min-h-11 rounded-xl px-3 text-sm font-bold", fundingMethod === "online" ? "bg-white text-gray-950 shadow-sm dark:bg-zinc-700 dark:text-white" : "text-gray-600 dark:text-gray-300")}>Pay online</button><button type="button" aria-pressed={fundingMethod === "transfer"} onClick={() => setFundingMethod("transfer")} className={cn("min-h-11 rounded-xl px-3 text-sm font-bold", fundingMethod === "transfer" ? "bg-white text-gray-950 shadow-sm dark:bg-zinc-700 dark:text-white" : "text-gray-600 dark:text-gray-300")}>Bank transfer</button></div>
                                        {fundingMethod === "online" ? (
                                            <div className="mt-5 space-y-4">
                                                <div className="space-y-2"><label htmlFor="wallet-topup-amount" className="text-sm font-semibold text-gray-800 dark:text-gray-200">How much would you like to add?</label><div className="flex h-14 items-center rounded-xl border border-gray-200 bg-gray-50 px-4 focus-within:border-[#F58220] dark:border-zinc-700 dark:bg-zinc-800"><span className="mr-2 text-lg font-bold text-gray-500">₦</span><Input id="wallet-topup-amount" type="number" inputMode="decimal" min="100" step="100" placeholder="Enter amount" className="h-full border-0 bg-transparent px-0 text-lg font-semibold shadow-none focus-visible:ring-0 dark:bg-transparent" value={amount} onChange={(event) => setAmount(event.target.value)} /></div><p className="text-xs text-gray-500 dark:text-gray-400">Minimum top-up is ₦100. You’ll review any fees before you pay.</p></div>
                                                <div className="flex flex-wrap gap-2">{[5000, 10000, 20000, 50000].map((quickAmount) => <button key={quickAmount} type="button" onClick={() => setAmount(String(quickAmount))} className={cn("min-h-10 rounded-full border px-4 text-sm font-semibold", amount === String(quickAmount) ? "border-[#F58220] bg-orange-50 text-[#c95c00] dark:bg-orange-950/30 dark:text-orange-200" : "border-gray-200 text-gray-700 dark:border-zinc-700 dark:text-gray-200")}>₦{quickAmount.toLocaleString()}</button>)}</div>
                                                {topupQuote ? <div className="space-y-2 rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-800/70"><div className="flex justify-between gap-3"><span>Added to your wallet</span><strong>{formatKobo(topupQuote.walletCreditKobo)}</strong></div><div className="flex justify-between gap-3"><span>Payment fees</span><span>{formatKobo(topupQuote.processorFeeKobo + topupQuote.processorVatKobo + topupQuote.rssFeeKobo)}</span></div><div className="flex justify-between gap-3 border-t border-gray-200 pt-2 text-base dark:border-zinc-700"><strong>Total you’ll pay</strong><strong>{formatKobo(topupQuote.totalChargeKobo)}</strong></div></div> : null}
                                                <Button className="min-h-12 w-full rounded-xl bg-[#F58220] text-base font-bold text-white hover:bg-[#E57210] sm:w-auto sm:min-w-64" onClick={handleTopUp} disabled={topupLoading || !amount || Number(amount) < 100}>{topupLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CreditCard className="mr-2 h-5 w-5" />}{topupLoading ? "Opening secure payment…" : "Continue to secure payment"}</Button>
                                            </div>
                                        ) : (
                                            <div className="mt-5">
                                                {activeWallet.virtual_account?.accountNumber ? (
                                                    <div className="rounded-2xl bg-gradient-to-br from-zinc-950 to-zinc-800 p-5 text-white sm:p-6"><div className="flex items-start gap-3"><Landmark className="mt-1 h-5 w-5 shrink-0 text-orange-300" /><div><p className="text-sm font-bold">{activeWallet.virtual_account.bankName}</p><p className="mt-0.5 text-xs text-white/65">{activeWallet.virtual_account.accountName}</p></div></div><div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3 sm:p-4"><span className="break-all font-mono text-xl font-bold tracking-wider text-orange-300 sm:text-2xl">{activeWallet.virtual_account.accountNumber}</span><Button type="button" variant="ghost" aria-label="Copy transfer account number" className="h-11 w-11 shrink-0 rounded-xl text-white hover:bg-white/10 hover:text-orange-300" onClick={copyToClipboard}>{copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}</Button></div><p className="mt-3 text-xs leading-relaxed text-white/65">Transfer to this dedicated account. Your wallet updates after payment is confirmed.</p>{copied ? <p role="status" className="mt-2 text-xs font-semibold text-emerald-300">Account number copied</p> : null}</div>
                                                ) : (
                                                    <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-5 dark:border-zinc-700 dark:bg-zinc-800/50 sm:p-6"><h3 className="font-bold text-gray-900 dark:text-white">Get your personal transfer details</h3><p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400">We’ll create a dedicated bank account for your wallet. Transfer to it whenever you want to add money.</p><Button className="mt-4 min-h-11 w-full rounded-xl bg-[#F58220] font-bold text-white hover:bg-[#E57210] sm:w-auto" onClick={() => void setupDepositAccount()} disabled={depositAccountLoading}>{depositAccountLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Landmark className="mr-2 h-4 w-4" />}{depositAccountLoading ? "Setting up account…" : "Create transfer details"}</Button></div>
                                                )}
                                            </div>
                                        )}
                                    </section>
                                ) : <section className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-200"><Info className="mt-0.5 h-5 w-5 shrink-0" /><p>{activeWallet.label} is funded automatically from completed orders or role payouts. Withdrawals follow this schedule: {activeWallet.withdrawPolicyHint}</p></section>}

                                <section className="flex flex-col gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                                    <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-800 dark:text-emerald-300">Rewards</p><p className="mt-1 font-semibold text-gray-900 dark:text-white">{rewardLoading ? "Checking your points…" : rewardSnapshot ? rewardSnapshot.availablePoints.toLocaleString() + " points available" : "Rewards are temporarily unavailable"}</p>{rewardSnapshot ? <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">{rewardSnapshot.pendingPoints.toLocaleString()} pending · {rewardSnapshot.enabled ? "Rewards enabled" : "Rewards paused"}</p> : null}</div>
                                    <Button asChild variant="outline" className="min-h-10 w-full rounded-xl border-emerald-200 bg-white font-semibold dark:border-emerald-900 dark:bg-zinc-900 sm:w-auto"><Link href="/account/rewards">View rewards</Link></Button>
                                </section>

                                <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                                    <div className="flex items-center justify-between gap-3 border-b border-gray-100 p-4 dark:border-zinc-800 sm:p-6"><div><h2 className="text-lg font-bold text-gray-950 dark:text-white">Recent activity</h2><p className="mt-1 text-sm text-gray-600 dark:text-gray-400">See money added, payouts, and withdrawals.</p></div><span className="hidden rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 dark:bg-zinc-800 dark:text-gray-300 sm:inline-flex">{activeWallet.entries.length} recent</span></div>
                                    {activeWallet.entries.length === 0 ? <div className="p-8 text-center sm:p-12"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-500 dark:bg-zinc-800"><CreditCard className="h-5 w-5" /></div><p className="mt-3 font-semibold text-gray-900 dark:text-white">No activity yet</p><p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{activeWallet.canTopUp ? "Your top-ups and payments will appear here." : "Your payouts and withdrawals will appear here."}</p></div> : (
                                        <div className="divide-y divide-gray-100 dark:divide-zinc-800">{activeWallet.entries.map((entry) => <div key={entry.id} className="flex items-center gap-3 p-4 sm:gap-4 sm:px-6"><div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", entry.direction === "credit" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30" : "bg-rose-50 text-rose-600 dark:bg-rose-950/30")}>{entry.direction === "credit" ? <ArrowDownToLine className="h-5 w-5" /> : <ArrowUpFromLine className="h-5 w-5" />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{entry.description}</p><p className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">{entry.created_at ? new Date(entry.created_at).toLocaleString() : "Time unavailable"}{entry.reference ? " · " + entry.reference : ""}</p></div><div className="shrink-0 text-right"><p className={cn("text-sm font-bold sm:text-base", entry.direction === "credit" ? "text-emerald-700 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300")}>{entry.direction === "credit" ? "+" : "−"}{formatKobo(entry.amount)}</p><p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{entry.source === "ledger_entry" ? "Settlement" : entry.status}</p></div></div>)}</div>
                                    )}
                                </section>
                            </div>
                        )}
                    </main>
                </div>
            </div>
            <Dialog open={statusModal.open} onOpenChange={(open) => setStatusModal((current) => ({ ...current, open }))}>
                <DialogContent className="sm:max-w-[420px] rounded-[32px] border-none bg-white p-8 shadow-2xl dark:bg-zinc-900">
                    <DialogHeader className="sr-only">
                        <DialogTitle>{statusModal.title}</DialogTitle>
                        <DialogDescription>{statusModal.message}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6 text-center">
                        <div className={cn("mx-auto flex h-24 w-24 items-center justify-center rounded-full", statusModal.type === "success" ? "bg-[#F58220]/10" : "bg-red-500/10")}>
                            {statusModal.type === "success" ? <CheckCircle2 className="h-12 w-12 text-[#F58220]" /> : <XCircle className="h-12 w-12 text-red-500" />}
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{statusModal.title}</h3>
                            <p className="text-gray-500 dark:text-gray-400">{statusModal.message}</p>
                        </div>
                        <Button className={cn("h-14 w-full rounded-2xl text-lg font-bold", statusModal.type === "success" ? "bg-[#F58220] text-white hover:bg-[#E57210]" : "bg-red-500 text-white hover:bg-red-600")} onClick={() => setStatusModal((current) => ({ ...current, open: false }))}>
                            {statusModal.btnText}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}

