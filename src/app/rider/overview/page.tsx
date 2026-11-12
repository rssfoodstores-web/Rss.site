import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, CircleCheck, Wallet } from "lucide-react"
import { formatKobo } from "@/lib/money"
import { createClient } from "@/lib/supabase/server"

function formatAmount(value: number | null) {
    return value === null ? "Unavailable" : formatKobo(value)
}

export default async function RiderOverviewPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect("/login")

    const date = new Intl.DateTimeFormat("sv-SE", { timeZone: "Africa/Lagos" }).format(new Date())
    const today = new Date(`${date}T00:00:00+01:00`).toISOString()
    const week = new Date(Date.parse(today) - 6 * 86400000).toISOString()
    const completed = () => supabase.from("orders").select("id", { count: "exact", head: true })
        .eq("rider_id", user.id).in("status", ["completed", "delivered"])
    const [dayTrips, weekTrips, allTrips, wallet] = await Promise.all([
        completed().gte("delivery_verified_at", today),
        completed().gte("delivery_verified_at", week),
        completed(),
        supabase.from("wallets").select("id,balance").eq("owner_id", user.id).eq("type", "rider").maybeSingle(),
    ])
    const payouts = wallet.data ? await supabase.from("ledger_entries").select("created_at,amount")
        .eq("wallet_id", wallet.data.id).eq("description", "Rider payout for order")
        .gte("created_at", week).gt("amount", 0) : null
    const earningsUnavailable = Boolean(wallet.error || payouts?.error)
    const rows = payouts?.data ?? []
    const sum = (entries: typeof rows) => entries.reduce((total, entry) => total + Number(entry.amount), 0)
    const periods = [
        { label: "Today", trips: dayTrips.count, earnings: earningsUnavailable ? null : sum(rows.filter((entry) => Date.parse(entry.created_at) >= Date.parse(today))) },
        { label: "Last 7 days", trips: weekTrips.count, earnings: earningsUnavailable ? null : sum(rows) },
    ]

    return <div className="mx-auto max-w-4xl space-y-5">
        <header className="space-y-1">
            <Link href="/rider" className="inline-flex min-h-10 items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                <ArrowLeft className="size-4" aria-hidden="true" /> Back to deliveries
            </Link>
            <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        </header>
        <div className="grid gap-4 sm:grid-cols-2">
            {periods.map((period) => <section key={period.label} className="rounded-2xl border bg-card p-4 sm:p-5" aria-label={period.label}>
                <h2 className="font-semibold">{period.label}</h2>
                <dl className="mt-3 grid grid-cols-2 gap-3">
                    <div><dt className="text-sm text-muted-foreground">Completed deliveries</dt>
                        <dd className="mt-1 text-xl font-semibold tabular-nums">{period.trips ?? "Unavailable"}</dd></div>
                    <div><dt className="text-sm text-muted-foreground">Delivery earnings</dt>
                        <dd className="mt-1 text-xl font-semibold tabular-nums">{formatAmount(period.earnings)}</dd></div>
                </dl>
            </section>)}
        </div>
        <dl className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border bg-card p-4 sm:p-5">
                <dt className="flex items-center gap-2 text-sm text-muted-foreground"><CircleCheck className="size-4" aria-hidden="true" /> All-time deliveries completed</dt>
                <dd className="mt-2 text-xl font-semibold tabular-nums">{allTrips.count ?? "Unavailable"}</dd>
            </div>
            <div className="rounded-2xl border bg-card p-4 sm:p-5">
                <dt className="flex items-center gap-2 text-sm text-muted-foreground"><Wallet className="size-4" aria-hidden="true" /> Rider wallet balance</dt>
                <dd className="mt-2 text-xl font-semibold tabular-nums">{formatAmount(wallet.error ? null : wallet.data?.balance ?? 0)}</dd>
            </div>
        </dl>
    </div>
}
