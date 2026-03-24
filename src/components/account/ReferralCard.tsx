"use client"

import { useState } from "react"
import { Check, Copy, Share2, TrendingUp, Users, Wallet } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

interface ReferralCardProps {
    referralCode: string
    referralPath: string
    totalReferrals: number
    totalEarningsKobo: number
    monthEarningsKobo: number
    commissionPercent: number
}

function formatKobo(amountKobo: number) {
    return new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
        maximumFractionDigits: 2,
    }).format(amountKobo / 100)
}

export function ReferralCard({
    referralCode,
    referralPath,
    totalReferrals,
    totalEarningsKobo,
    monthEarningsKobo,
    commissionPercent,
}: ReferralCardProps) {
    const [copied, setCopied] = useState<"code" | "link" | null>(null)

    const referralUrl =
        typeof window === "undefined"
            ? referralPath
            : new URL(referralPath, window.location.origin).toString()

    const copyValue = async (value: string, type: "code" | "link") => {
        await navigator.clipboard.writeText(value)
        setCopied(type)
        toast.success(type === "code" ? "Referral code copied." : "Referral link copied.")
        window.setTimeout(() => setCopied(null), 2000)
    }

    const handleShare = async () => {
        const shareData = {
            title: "Join RSS Foods",
            text: `Use my referral code ${referralCode} to join RSS Foods.`,
            url: referralUrl,
        }

        if (!navigator.share) {
            await copyValue(referralUrl, "link")
            return
        }

        try {
            await navigator.share(shareData)
        } catch {
        }
    }

    return (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#F58220] via-[#E57210] to-[#191970] p-8 text-white shadow-xl shadow-orange-500/20">
                <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
                <div className="relative z-10 space-y-6">
                    <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/70">Referral earnings</p>
                        <h2 className="mt-3 text-4xl font-extrabold">{formatKobo(totalEarningsKobo)}</h2>
                        <p className="mt-2 max-w-xl text-sm text-white/85">
                            {commissionPercent.toFixed(2)}% of every eligible payout or commission earned by the users you brought to RSS Foods lands in your wallet automatically.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                            <div className="flex items-center gap-2 text-white/70">
                                <Users className="h-4 w-4" />
                                <span className="text-xs font-bold uppercase tracking-[0.16em]">Referrals</span>
                            </div>
                            <p className="mt-3 text-3xl font-extrabold">{totalReferrals}</p>
                        </div>

                        <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                            <div className="flex items-center gap-2 text-white/70">
                                <TrendingUp className="h-4 w-4" />
                                <span className="text-xs font-bold uppercase tracking-[0.16em]">This month</span>
                            </div>
                            <p className="mt-3 text-2xl font-extrabold">{formatKobo(monthEarningsKobo)}</p>
                        </div>

                        <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                            <div className="flex items-center gap-2 text-white/70">
                                <Wallet className="h-4 w-4" />
                                <span className="text-xs font-bold uppercase tracking-[0.16em]">Withdrawal</span>
                            </div>
                            <p className="mt-3 text-sm font-semibold leading-6 text-white/90">
                                Rewards go straight to your wallet and can be withdrawn anytime from the wallet page.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="rounded-[2rem] border border-gray-100 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-gray-400">
                    <Users className="h-4 w-4 text-[#F58220]" />
                    Your referral link
                </div>

                <div className="mt-5 rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/60">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-400">Referral code</p>
                    <p className="mt-2 font-mono text-2xl font-extrabold tracking-[0.18em] text-gray-900 dark:text-white">
                        {referralCode}
                    </p>
                    <p className="mt-4 break-all text-sm text-gray-500 dark:text-gray-400">{referralUrl}</p>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Button
                        type="button"
                        variant="outline"
                        className="h-12 rounded-xl"
                        onClick={() => copyValue(referralCode, "code")}
                    >
                        {copied === "code" ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                        {copied === "code" ? "Copied code" : "Copy code"}
                    </Button>
                    <Button
                        type="button"
                        className="h-12 rounded-xl bg-[#F58220] text-white hover:bg-[#E57210]"
                        onClick={() => copyValue(referralUrl, "link")}
                    >
                        {copied === "link" ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                        {copied === "link" ? "Copied link" : "Copy link"}
                    </Button>
                </div>

                <Button
                    type="button"
                    variant="outline"
                    className="mt-3 h-12 w-full rounded-xl"
                    onClick={handleShare}
                >
                    <Share2 className="mr-2 h-4 w-4" />
                    Share invitation
                </Button>
            </section>
        </div>
    )
}
