import Link from "next/link"
import { AlertCircle, Clock3, Coins, Gift, TimerReset } from "lucide-react"
import { ProfileSidebar } from "@/components/account/ProfileSidebar"
import { Button } from "@/components/ui/button"
import { formatKobo } from "@/lib/money"
import { getRewardDashboardData } from "./actions"

export const dynamic = "force-dynamic"

function formatPoints(points: number) {
    return `${points.toLocaleString()} pts`
}

function getEventLabel(eventType: string) {
    switch (eventType) {
        case "earned_pending":
            return "Pending earn"
        case "earned_available":
            return "Points earned"
        case "redeemed":
            return "Redeemed"
        case "restored":
            return "Restored"
        case "expired":
            return "Expired"
        case "reversed":
            return "Reversed"
        case "cancelled":
            return "Cancelled"
        default:
            return "Activity"
    }
}

function getEventTone(pointsDelta: number) {
    if (pointsDelta > 0) {
        return "text-emerald-700 dark:text-emerald-300"
    }

    if (pointsDelta < 0) {
        return "text-red-600 dark:text-red-300"
    }

    return "text-gray-500 dark:text-gray-400"
}

export default async function RewardsPage() {
    const { activity, expiringLots, pendingLots, reservedOrder, summary } = await getRewardDashboardData()
    const availableValueKobo = summary.availablePoints * summary.pointValueKobo

    return (
        <div className="min-h-screen bg-gray-50/50 py-6 dark:bg-black sm:py-8 lg:py-12">
            <div className="container mx-auto px-4 sm:px-6">
                <div className="mb-6 sm:mb-8">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">Reward Points</h1>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 sm:text-base">
                        Track what is available now, what is still pending on delivered orders, and what you have already used at checkout.
                    </p>
                </div>

                <div className="flex flex-col gap-5 sm:gap-6 lg:flex-row lg:gap-8">
                    <aside className="w-full flex-shrink-0 lg:w-80">
                        <ProfileSidebar />
                    </aside>

                    <main className="min-w-0 flex-1 space-y-6">
                        <div className="grid gap-4 md:grid-cols-3">
                            <section className="rounded-3xl bg-[#F58220] p-6 text-white shadow-lg shadow-orange-500/20">
                                <div className="flex items-center gap-2 text-sm text-white/80">
                                    <Coins className="h-4 w-4" />
                                    <span>Available now</span>
                                </div>
                                <p className="mt-4 text-4xl font-bold">{formatPoints(summary.availablePoints)}</p>
                                <p className="mt-2 text-sm text-white/80">Worth {formatKobo(availableValueKobo)} at checkout.</p>
                            </section>

                            <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                    <Clock3 className="h-4 w-4" />
                                    <span>Pending</span>
                                </div>
                                <p className="mt-4 text-4xl font-bold text-gray-900 dark:text-white">{formatPoints(summary.pendingPoints)}</p>
                                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">These unlock after the linked orders are delivered or completed.</p>
                            </section>

                            <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                    <Gift className="h-4 w-4" />
                                    <span>Status</span>
                                </div>
                                <p className="mt-4 text-2xl font-bold text-gray-900 dark:text-white">
                                    {summary.enabled ? "Rewards enabled" : "Rewards paused"}
                                </p>
                                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                                    Current conversion: 1 point = {formatKobo(summary.pointValueKobo)}.
                                </p>
                            </section>
                        </div>

                        {reservedOrder ? (
                            <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900/40 dark:bg-amber-950/20">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                    <div>
                                        <p className="flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-100">
                                            <AlertCircle className="h-4 w-4" />
                                            Reward points are currently reserved on an unpaid order.
                                        </p>
                                        <p className="mt-2 text-sm text-amber-800/80 dark:text-amber-200/80">
                                            {formatPoints(reservedOrder.pointsUsed)} is locked against order #{reservedOrder.orderId.slice(0, 8)} until payment completes or the order is cancelled.
                                        </p>
                                    </div>
                                    <Button asChild className="rounded-full bg-[#F58220] text-white hover:bg-[#F58220]/90">
                                        <Link href={`/account/orders/${reservedOrder.orderId}`}>Open order</Link>
                                    </Button>
                                </div>
                            </section>
                        ) : null}

                        <div className="grid gap-6 xl:grid-cols-2">
                            <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                                <div className="flex items-center gap-2">
                                    <TimerReset className="h-5 w-5 text-[#F58220]" />
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Pending releases</h2>
                                </div>
                                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                                    Points waiting on delivery confirmation before they become usable.
                                </p>
                                <div className="mt-5 space-y-3">
                                    {pendingLots.length === 0 ? (
                                        <p className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-sm text-gray-500 dark:border-zinc-800 dark:text-gray-400">
                                            No pending point awards right now.
                                        </p>
                                    ) : (
                                        pendingLots.map((lot) => (
                                            <div key={lot.id} className="rounded-2xl border border-gray-100 px-4 py-4 dark:border-zinc-800">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div>
                                                        <p className="font-semibold text-gray-900 dark:text-white">{lot.description || "Pending reward entry"}</p>
                                                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-gray-400">{lot.sourceKind.replaceAll("_", " ")}</p>
                                                    </div>
                                                    <p className="text-sm font-bold text-[#F58220]">{formatPoints(lot.remainingPoints)}</p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </section>

                            <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                                <div className="flex items-center gap-2">
                                    <Clock3 className="h-5 w-5 text-violet-700" />
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Upcoming expiries</h2>
                                </div>
                                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                                    Available points that already have an expiry date assigned.
                                </p>
                                <div className="mt-5 space-y-3">
                                    {expiringLots.length === 0 ? (
                                        <p className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-sm text-gray-500 dark:border-zinc-800 dark:text-gray-400">
                                            Nothing is due to expire yet.
                                        </p>
                                    ) : (
                                        expiringLots.map((lot) => (
                                            <div key={lot.id} className="rounded-2xl border border-gray-100 px-4 py-4 dark:border-zinc-800">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div>
                                                        <p className="font-semibold text-gray-900 dark:text-white">{lot.description || "Reward lot"}</p>
                                                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                                            Expires {lot.expiresAt ? new Date(lot.expiresAt).toLocaleDateString() : "later"}
                                                        </p>
                                                    </div>
                                                    <p className="text-sm font-bold text-violet-700 dark:text-violet-300">{formatPoints(lot.remainingPoints)}</p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </section>
                        </div>

                        <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                            <div className="border-b border-gray-100 px-6 py-5 dark:border-zinc-800">
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Reward history</h2>
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                    Every reward earn, redemption, reversal, and expiry tied to your account.
                                </p>
                            </div>

                            <div className="divide-y divide-gray-100 dark:divide-zinc-800">
                                {activity.length === 0 ? (
                                    <div className="px-6 py-12 text-sm text-gray-500 dark:text-gray-400">
                                        No reward activity yet.
                                    </div>
                                ) : (
                                    activity.map((item) => (
                                        <div key={item.id} className="flex flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
                                            <div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="font-semibold text-gray-900 dark:text-white">{item.description}</p>
                                                    <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-600 dark:bg-zinc-800 dark:text-gray-300">
                                                        {getEventLabel(item.eventType)}
                                                    </span>
                                                </div>
                                                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                                                    {new Date(item.createdAt).toLocaleString()}
                                                </p>
                                            </div>
                                            <div className="text-left lg:text-right">
                                                <p className={`text-lg font-bold ${getEventTone(item.pointsDelta)}`}>
                                                    {item.pointsDelta > 0 ? "+" : ""}
                                                    {formatPoints(item.pointsDelta)}
                                                </p>
                                                <p className="mt-1 text-xs text-gray-400">
                                                    Available {formatPoints(item.availableBalanceAfter)} · Pending {formatPoints(item.pendingBalanceAfter)}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </section>
                    </main>
                </div>
            </div>
        </div>
    )
}
