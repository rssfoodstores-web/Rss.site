import { format } from "date-fns"
import { unstable_rethrow } from "next/navigation"
import { ReferralCard } from "@/components/account/ReferralCard"
import { getReferralData } from "./actions"

function formatKobo(amountKobo: number) {
    return new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
        maximumFractionDigits: 2,
    }).format(amountKobo / 100)
}

function formatSourceKind(sourceKind: string) {
    switch (sourceKind) {
        case "merchant_payout":
            return "Merchant payout"
        case "agent_commission":
            return "Agent commission"
        case "rider_earnings":
            return "Rider earnings"
        default:
            return "Referral payout"
    }
}

export default async function AffiliateSection() {
    const overview = await getReferralData().catch((error: unknown) => {
        unstable_rethrow(error)
        return null
    })
    if (!overview?.referralCode) {
        return <section id="affiliate" className="scroll-mt-24">
            <h2 className="text-xl font-bold">Affiliate link</h2>
            <p className="mt-2 text-sm text-muted-foreground">Your affiliate link is unavailable right now. Refresh the page to try again.</p>
        </section>
    }
    const { referralCode, commissionBps, stats, referrals, history } = overview
    const commissionPercent = commissionBps / 100

    return (
        <section id="affiliate" aria-labelledby="affiliate-title" className="min-w-0 scroll-mt-24">
                <div className="mb-6 sm:mb-8">
                    <h2 id="affiliate-title" className="text-xl font-bold">Affiliate link</h2>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 sm:text-base">
                        Copy your personal RSS Foods link and share it with someone who wants to sign up. If they join through your link and earn a qualifying payout or commission, RSS credits your referral reward to your wallet.
                    </p>
                </div>

                    <div className="min-w-0 space-y-6">
                        <ReferralCard
                            referralCode={referralCode}
                            referralPath={`/register?ref=${referralCode}`}
                            totalReferrals={stats.totalReferrals}
                            totalEarningsKobo={stats.totalEarningsKobo}
                            monthEarningsKobo={stats.monthEarningsKobo}
                            commissionPercent={commissionPercent}
                        />

                        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.92fr_1.08fr]">
                            <section className="rounded-[2rem] border border-gray-100 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                                <div className="border-b border-gray-100 px-6 py-5 dark:border-zinc-800">
                                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Referred users</h2>
                                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                        Everyone currently linked to your referral code.
                                    </p>
                                </div>

                                {referrals.length === 0 ? (
                                    <div className="p-10 text-center text-sm text-gray-500 dark:text-gray-400">
                                        No referrals linked yet. Share your invitation link to start earning.
                                    </div>
                                ) : (
                                    <div className="divide-y divide-gray-100 dark:divide-zinc-800">
                                        {referrals.map((referral) => (
                                            <div key={referral.id} className="flex items-center justify-between gap-4 px-6 py-4">
                                                <div>
                                                    <p className="font-semibold text-gray-900 dark:text-white">{referral.fullName}</p>
                                                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-gray-400">
                                                        {referral.rewardEvents} reward {referral.rewardEvents === 1 ? "event" : "events"}
                                                    </p>
                                                </div>
                                                <p className="text-right text-sm font-bold text-[#F58220]">
                                                    {formatKobo(referral.totalEarnedKobo)}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>

                            <section className="rounded-[2rem] border border-gray-100 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                                <div className="border-b border-gray-100 px-6 py-5 dark:border-zinc-800">
                                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Reward history</h2>
                                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                        Recent referral commissions already credited to your wallet.
                                    </p>
                                </div>

                                {history.length === 0 ? (
                                    <div className="p-10 text-center text-sm text-gray-500 dark:text-gray-400">
                                        Your reward history will appear here once referred users begin earning.
                                    </div>
                                ) : (
                                    <div className="divide-y divide-gray-100 dark:divide-zinc-800">
                                        {history.map((item) => (
                                            <div key={item.id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                                                <div>
                                                    <p className="font-semibold text-gray-900 dark:text-white">
                                                        {formatSourceKind(item.sourceKind)} from {item.referredUserName}
                                                    </p>
                                                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                                        Source payout: {formatKobo(item.sourceAmountKobo)}
                                                    </p>
                                                    <p className="mt-1 text-xs text-gray-400">
                                                        {item.createdAt ? format(new Date(item.createdAt), "MMM d, yyyy - h:mm a") : "-"}
                                                    </p>
                                                </div>
                                                <div className="text-left sm:text-right">
                                                    <p className="text-lg font-extrabold text-emerald-600">
                                                        +{formatKobo(item.commissionAmountKobo)}
                                                    </p>
                                                    <p className="text-xs uppercase tracking-[0.16em] text-gray-400">
                                                        {commissionPercent.toFixed(2)}% referral reward
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>
                        </div>
                    </div>
        </section>
    )
}
