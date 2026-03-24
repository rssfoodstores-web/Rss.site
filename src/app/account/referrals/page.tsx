import { format } from "date-fns"
import { ProfileSidebar } from "@/components/account/ProfileSidebar"
import { ReferralCard } from "@/components/account/ReferralCard"
import { getReferralData } from "./actions"

export const dynamic = "force-dynamic"

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

export default async function ReferralPage() {
    const { referralCode, commissionBps, stats, referrals, history } = await getReferralData()
    const commissionPercent = commissionBps / 100

    return (
        <div className="min-h-screen bg-gray-50/50 py-6 dark:bg-black sm:py-8 lg:py-12">
            <div className="container mx-auto px-4 sm:px-6">
                <div className="mb-6 sm:mb-8">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">My Referrals</h1>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 sm:text-base">
                        Share your referral link. When referred users earn payouts or commissions on RSS Foods, your wallet is credited automatically.
                    </p>
                </div>

                <div className="flex flex-col gap-5 sm:gap-6 lg:flex-row lg:gap-8">
                    <aside className="w-full flex-shrink-0 lg:sticky lg:top-4 lg:z-10 lg:w-80">
                        <ProfileSidebar />
                    </aside>

                    <main className="min-w-0 flex-1 space-y-6">
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
                    </main>
                </div>
            </div>
        </div>
    )
}
