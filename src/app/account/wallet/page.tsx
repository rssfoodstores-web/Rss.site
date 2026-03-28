"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Banknote, Building2, Check, CheckCircle2, Copy, CreditCard, Loader2, User as UserIcon, Wallet, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ProfileSidebar } from "@/components/account/ProfileSidebar"
import { cn } from "@/lib/utils"
import { formatKobo } from "@/lib/money"
import { getBanks, getWalletData, initiateWithdrawal, initializeTopUp, verifyAccount } from "./actions"
import { getRewardWalletSnapshot, type RewardWalletSnapshot } from "@/app/account/rewards/actions"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

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
    const [wallets, setWallets] = useState<WalletSummary[]>([])
    const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null)
    const [rewardSnapshot, setRewardSnapshot] = useState<RewardWalletSnapshot | null>(null)
    const [banks, setBanks] = useState<BankOption[]>([])
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
    const [statusModal, setStatusModal] = useState({ open: false, type: "success" as "success" | "error", title: "", message: "", btnText: "OK" })

    const activeWallet = useMemo(
        () => wallets.find((wallet) => wallet.id === selectedWalletId) ?? wallets[0] ?? null,
        [selectedWalletId, wallets]
    )

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

    const loadData = async () => {
        setLoading(true)
        const [result, rewardData] = await Promise.all([
            getWalletData(),
            getRewardWalletSnapshot(),
        ])
        const nextWallets = (result.wallets as WalletSummary[] | undefined) ?? []
        setWallets(nextWallets)
        const nextWalletId = (
            selectedWalletId && nextWallets.some((wallet) => wallet.id === selectedWalletId)
                ? selectedWalletId
                : (result.primaryWalletId as string | null) ?? nextWallets[0]?.id ?? null
        )
        handleWalletSelection(nextWalletId)
        setRewardSnapshot(rewardData)
        setLoading(false)
    }

    useEffect(() => {
        let cancelled = false

        const bootstrap = async () => {
            setLoading(true)

            const [walletResult, rewardData, bankResult] = await Promise.all([
                getWalletData(),
                getRewardWalletSnapshot(),
                getBanks(),
            ])

            if (cancelled) {
                return
            }

            const nextWallets = (walletResult.wallets as WalletSummary[] | undefined) ?? []
            setWallets(nextWallets)

            const nextWalletId = (
                (walletResult.primaryWalletId as string | null) ?? nextWallets[0]?.id ?? null
            )

            handleWalletSelection(nextWalletId)
            setRewardSnapshot(rewardData)

            if (bankResult.banks) {
                setBanks(bankResult.banks as unknown as BankOption[])
            }

            setLoading(false)
        }

        void bootstrap()

        return () => {
            cancelled = true
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
        const result = await initializeTopUp(numericAmount)
        setTopupLoading(false)

        if (result.success && result.checkoutUrl) {
            window.location.href = result.checkoutUrl
            return
        }

        showStatus("error", "Top-up failed", result.error || "Unable to start payment.")
    }

    async function handleVerifyAccount() {
        if (!selectedBank || accountNumber.length !== 10) {
            return
        }

        setVerifying(true)
        const result = await verifyAccount(selectedBank, accountNumber)
        setVerifying(false)

        if (result.success) {
            setAccountName(result.accountName)
            return
        }

        setAccountName("")
        showStatus("error", "Verification failed", result.error || "Unable to verify bank account.")
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
        const result = await initiateWithdrawal(
            activeWallet.id,
            selectedBank,
            accountNumber,
            numericAmount,
            bank?.name || ""
        )
        setWithdrawLoading(false)

        if (result.success) {
            setIsWithdrawOpen(false)
            showStatus("success", "Withdrawal submitted", "Your withdrawal request was submitted successfully.")
            void loadData()
            return
        }

        showStatus("error", "Withdrawal failed", result.error || "Unable to process the withdrawal.")
    }

    async function copyToClipboard() {
        const account = activeWallet?.virtual_account?.accountNumber
        if (!account) return
        await navigator.clipboard.writeText(account)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <div className="min-h-screen bg-gray-50/50 py-6 dark:bg-black sm:py-8 lg:py-12">
            <div className="container mx-auto px-4 sm:px-6">
                <div className="mb-6 sm:mb-8">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">Wallet Hub</h1>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 sm:text-base">Customer funding and operational payouts now live together here.</p>
                </div>

                <div className="flex flex-col gap-5 sm:gap-6 lg:flex-row lg:gap-8">
                    <aside className="w-full flex-shrink-0 lg:w-80">
                        <ProfileSidebar />
                    </aside>

                    <main className="min-w-0 flex-1 space-y-6">
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            {wallets.map((wallet) => (
                                <button
                                    key={wallet.id}
                                    type="button"
                                    onClick={() => handleWalletSelection(wallet.id)}
                                    className={cn(
                                        "rounded-2xl border p-4 text-left transition-all",
                                        wallet.id === activeWallet?.id
                                            ? "border-[#F58220] bg-orange-50/80 shadow-sm dark:border-orange-600 dark:bg-orange-950/20"
                                            : "border-gray-100 bg-white hover:border-orange-200 dark:border-zinc-800 dark:bg-zinc-900"
                                    )}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="font-bold text-gray-900 dark:text-white">{wallet.label}</p>
                                        <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-gray-600 dark:bg-zinc-800 dark:text-gray-300">
                                            {wallet.type}
                                        </span>
                                    </div>
                                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{wallet.description}</p>
                                    <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#F58220]">
                                        {wallet.actionSummary}
                                    </p>
                                    <p className="mt-4 text-2xl font-bold text-gray-900 dark:text-white">{formatKobo(wallet.balance)}</p>
                                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{wallet.withdrawPolicyHint}</p>
                                </button>
                            ))}
                        </div>

                        <section className="rounded-3xl border border-emerald-100 bg-emerald-50/70 p-6 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                <div>
                                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">Reward points</p>
                                    <h2 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
                                        {rewardSnapshot ? `${rewardSnapshot.availablePoints.toLocaleString()} available` : "Loading rewards..."}
                                    </h2>
                                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                                        {rewardSnapshot
                                            ? `${rewardSnapshot.pendingPoints.toLocaleString()} pending · ${rewardSnapshot.enabled ? "Rewards enabled" : "Rewards paused"}`
                                            : "Checking reward balance..."}
                                    </p>
                                    {rewardSnapshot?.reservedOrder ? (
                                        <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                                            {rewardSnapshot.reservedOrder.pointsUsed.toLocaleString()} points are reserved on unpaid order #{rewardSnapshot.reservedOrder.orderId.slice(0, 8)}.
                                        </p>
                                    ) : null}
                                </div>
                                <Button asChild className="rounded-full bg-[#F58220] text-white hover:bg-[#F58220]/90">
                                    <Link href="/account/rewards">Open rewards</Link>
                                </Button>
                            </div>
                        </section>

                        <section className="rounded-3xl bg-[#F58220] p-6 text-white shadow-lg shadow-orange-500/20 lg:p-8">
                            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                                <div>
                                    <div className="flex items-center gap-2 text-sm text-white/80">
                                        <Wallet className="h-4 w-4" />
                                        <span>{activeWallet?.label || "Wallet"}</span>
                                    </div>
                                    <h2 className="mt-3 text-4xl font-bold lg:text-5xl">{loading ? "Loading..." : formatKobo(activeWallet?.balance ?? 0)}</h2>
                                    <p className="mt-3 max-w-2xl text-sm text-white/80">{activeWallet?.description}</p>
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        <span className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white">
                                            {activeWallet?.actionSummary || "Loading actions"}
                                        </span>
                                        <span className="rounded-full bg-black/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/90">
                                            {activeWallet?.withdrawPolicyLabel || "Loading policy"}
                                        </span>
                                    </div>
                                    {activeWallet?.withdrawPolicyHint ? (
                                        <p className="mt-4 max-w-2xl text-sm text-white/80">{activeWallet.withdrawPolicyHint}</p>
                                    ) : null}
                                </div>

                                {activeWallet?.canWithdraw ? (
                                    <Dialog open={isWithdrawOpen} onOpenChange={setIsWithdrawOpen}>
                                        <DialogTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className="border-white/20 bg-white/10 text-white hover:bg-white/20 disabled:border-white/10 disabled:bg-white/5 disabled:text-white/70"
                                                disabled={!activeWallet?.withdrawAvailableNow}
                                            >
                                                <Banknote className="mr-2 h-4 w-4" />
                                                {activeWallet?.withdrawAvailableNow ? "Withdraw" : "Withdraw locked"}
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="sm:max-w-[440px] rounded-3xl border-gray-200 bg-white p-0 dark:border-zinc-800 dark:bg-zinc-900">
                                            <DialogHeader className="p-6 pb-0">
                                                <DialogTitle className="text-xl font-bold">Withdraw funds</DialogTitle>
                                                <DialogDescription>
                                                    Transfer money from your {activeWallet?.label?.toLowerCase() || "wallet"} to your verified bank account.
                                                </DialogDescription>
                                            </DialogHeader>
                                            <div className="space-y-5 p-6">
                                                <select className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm dark:border-zinc-800 dark:bg-zinc-800/50" value={selectedBank} onChange={(event) => handleBankChange(event.target.value)}>
                                                    <option value="">Choose a bank</option>
                                                    {banks.map((bank) => <option key={bank.code} value={bank.code}>{bank.name}</option>)}
                                                </select>
                                                <div className="flex gap-2">
                                                    <Input placeholder="Enter 10-digit account number" inputMode="numeric" maxLength={10} className="h-12 rounded-xl bg-gray-50 dark:bg-zinc-800/50" value={accountNumber} onChange={(event) => handleAccountNumberChange(event.target.value)} />
                                                    <Button type="button" variant="secondary" className="h-12 rounded-xl px-6 font-bold" onClick={handleVerifyAccount} disabled={verifying || accountNumber.length !== 10}>
                                                        {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
                                                    </Button>
                                                </div>
                                                {accountName ? (
                                                    <div className="flex items-center gap-3 rounded-xl border border-green-100 bg-green-50 p-4 text-sm text-green-700 dark:border-green-900/30 dark:bg-green-900/20 dark:text-green-300">
                                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/10">
                                                            <UserIcon className="h-4 w-4" />
                                                        </div>
                                                        <span className="font-bold uppercase tracking-tight">{accountName}</span>
                                                    </div>
                                                ) : null}
                                                <Input type="number" placeholder="Minimum ₦1,000" className="h-12 rounded-xl bg-gray-50 dark:bg-zinc-800/50" value={withdrawAmount} onChange={(event) => setWithdrawAmount(event.target.value)} />
                                                <p className="text-xs text-gray-500 dark:text-gray-400">Available balance: {formatKobo(activeWallet?.balance ?? 0)}</p>
                                            </div>
                                            <DialogFooter className="flex flex-col gap-3 p-6 pt-0 sm:flex-row">
                                                <Button variant="ghost" className="w-full sm:w-auto" onClick={() => setIsWithdrawOpen(false)}>Cancel</Button>
                                                <Button className="w-full bg-[#F58220] text-white hover:bg-[#E57210] sm:flex-1" onClick={handleWithdraw} disabled={withdrawLoading || !accountName || !activeWallet?.withdrawAvailableNow}>
                                                    {withdrawLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                                    Confirm withdrawal
                                                </Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                ) : (
                                    <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/80">Auto-settlement wallet</span>
                                )}
                            </div>

                            {activeWallet?.canTopUp ? (
                                <div className="mt-6 flex flex-col gap-4 sm:flex-row">
                                    <Input type="number" placeholder="Enter amount (₦)" className="h-12 max-w-xs border-white/20 bg-white/10 text-white placeholder:text-white/50" value={amount} onChange={(event) => setAmount(event.target.value)} />
                                    <Button className="h-12 rounded-xl bg-white px-8 text-lg font-bold text-[#F58220] hover:bg-white/90" onClick={handleTopUp} disabled={topupLoading}>
                                        {topupLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Top up now"}
                                    </Button>
                                </div>
                            ) : (
                                <div className="mt-6 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white/90">Role wallets are withdraw-only and are funded automatically by completed-order settlement.</div>
                            )}
                        </section>

                        {activeWallet?.canTopUp && activeWallet.virtual_account?.accountNumber ? (
                            <section className="relative overflow-hidden rounded-3xl border border-zinc-800/50 bg-gradient-to-br from-zinc-900 to-black p-5 text-white sm:p-6 lg:p-8">
                                <div className="absolute right-0 top-0 p-8 opacity-10"><Building2 className="h-32 w-32 -rotate-12" /></div>
                                <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                                    <div>
                                        <div className="mb-2 flex items-center gap-2 text-zinc-400">
                                            <span className="rounded bg-white/10 px-2 py-1 text-xs font-bold uppercase tracking-wider">Dedicated Account</span>
                                            <span className="text-xs">Monnify</span>
                                        </div>
                                        <h3 className="text-2xl font-bold lg:text-3xl">{activeWallet.virtual_account.bankName}</h3>
                                        <p className="text-sm text-zinc-400">{activeWallet.virtual_account.accountName}</p>
                                    </div>
                                    <div className="flex w-full flex-col items-start gap-2 lg:max-w-[420px] lg:items-end">
                                        <div className="flex w-full max-w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-1 pl-4 pr-2 sm:pl-6">
                                            <span className="break-all font-mono text-xl font-bold tracking-[0.12em] text-[#F58220] sm:text-2xl sm:tracking-widest lg:text-4xl">
                                                {activeWallet.virtual_account.accountNumber}
                                            </span>
                                            <Button size="icon" variant="ghost" className="h-12 w-12 shrink-0 rounded-xl text-white hover:bg-white/10 hover:text-[#F58220]" onClick={copyToClipboard}>
                                                {copied ? <Check className="h-6 w-6" /> : <Copy className="h-6 w-6" />}
                                            </Button>
                                        </div>
                                        <p className="text-xs text-zinc-500">Transfer to this account to fund your wallet instantly.</p>
                                    </div>
                                </div>
                            </section>
                        ) : null}

                        <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                            <div className="border-b border-gray-100 p-6 dark:border-zinc-800">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{activeWallet?.label || "Recent activity"}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{activeWallet?.canTopUp ? "Customer funding, withdrawals, and payment activity." : "Role payout and withdrawal history."}</p>
                            </div>
                            <div className="divide-y divide-gray-50 dark:divide-zinc-800">
                                {loading ? (
                                    <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-[#F58220]" /></div>
                                ) : (activeWallet?.entries?.length ?? 0) === 0 ? (
                                    <div className="p-12 text-center text-gray-500 dark:text-gray-400">No activity recorded for this wallet yet.</div>
                                ) : (
                                    activeWallet?.entries.map((entry) => (
                                        <div key={entry.id} className="flex flex-col gap-3 p-4 hover:bg-gray-50 dark:hover:bg-zinc-800/50 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className={cn("flex h-10 w-10 items-center justify-center rounded-full", entry.direction === "credit" ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600")}>
                                                    <CreditCard className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-900 dark:text-white">{entry.description}</p>
                                                    {entry.created_at ? (
                                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                                            {new Date(entry.created_at).toLocaleDateString()} • {new Date(entry.created_at).toLocaleTimeString()}
                                                            {entry.reference ? ` • ${entry.reference}` : ""}
                                                        </p>
                                                    ) : (
                                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                                            Time unavailable
                                                            {entry.reference ? ` • ${entry.reference}` : ""}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className={cn("text-lg font-bold", entry.direction === "credit" ? "text-green-600" : "text-red-600")}>
                                                    {entry.direction === "credit" ? "+" : "-"}{formatKobo(entry.amount)}
                                                </p>
                                                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">{entry.source === "ledger_entry" ? "Settlement" : entry.status}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </section>
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
