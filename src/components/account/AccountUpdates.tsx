"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Bell, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { performLogout } from "@/lib/auth/performLogout"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/context/UserContext"
import { getNotificationPresentation, getSafeNotificationHref, isNotificationRead, type AppNotification } from "@/lib/notifications"

function useOpenUpdate() {
    const router = useRouter()
    const { markNotificationsRead } = useUser()
    return async (notification: AppNotification) => {
        if (!isNotificationRead(notification)) {
            await markNotificationsRead([notification.id])
        }
        const href = getSafeNotificationHref(notification.action_url)
        if (href) router.push(href)
        router.refresh()
    }
}

export function AccountUpdatesBell() {
    const { user, unreadCount } = useUser()
    const [open, setOpen] = useState(false)
    const [feed, setFeed] = useState<{ userId: string; rows: AppNotification[]; failed: boolean }>()
    const openUpdate = useOpenUpdate()
    const userId = user?.id

    useEffect(() => {
        if (!open || !userId) return
        let active = true
        const supabase = createClient()
        void (async () => {
            const { data, error } = await supabase.from("notifications").select("*")
                .eq("user_id", userId).order("created_at", { ascending: false }).limit(12)
            if (active) setFeed({ userId, rows: (data ?? []) as AppNotification[], failed: Boolean(error) })
        })()
        return () => { active = false }
    }, [open, unreadCount, userId])

    if (!userId) return null
    const current = feed?.userId === userId ? feed : undefined

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative rounded-xl" aria-label={unreadCount ? `Updates, ${unreadCount} unread` : "Updates"}>
                    <Bell className="size-5" />
                    {unreadCount > 0 && <span aria-hidden="true" className="absolute right-0 top-0 rounded-full bg-red-600 px-1 text-[10px] text-white">{unreadCount > 9 ? "9+" : unreadCount}</span>}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-[65dvh] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto p-2">
                <p className="px-2 py-2 font-semibold">Recent updates</p>
                {!current && <p className="p-2 text-sm text-muted-foreground">Loading updates…</p>}
                {current && !current.rows.length && <p className="p-2 text-sm text-muted-foreground">{current.failed ? "Could not load updates. Close and reopen to try again." : "You’re all caught up."}</p>}
                {current?.rows.map((row) => (
                    <DropdownMenuItem key={row.id} onSelect={() => void openUpdate(row)} className="block min-h-11 whitespace-normal">
                        <span className="block font-medium">{!isNotificationRead(row) && <span className="mr-2 text-orange-700 dark:text-orange-300">New</span>}{row.title}</span>
                        <span className="mt-1 block text-xs text-muted-foreground">{row.message}</span>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

const attentionTypes = new Set(["order_message", "order_issue", "wallet_issue", "payment_failed", "payment_issue"])

const destinations = [
    { name: "Orders", href: "/account/orders" },
    { name: "Messages", href: "/account/messages" },
    { name: "Delivery addresses", href: "/account/address" },
    { name: "Wallet", href: "/account/wallet" },
    { name: "Personal details", href: "/account/profile" },
]

function getDestination(row: AppNotification) {
    const href = getSafeNotificationHref(row.action_url)
    if (href && row.type === "order_message") return destinations[1]
    if (href && /^\/account\/gift-card(?:[/?#]|$)/.test(href)) return destinations[3]
    return destinations.find((entry) => href === entry.href || href?.startsWith(entry.href + "/") || href?.startsWith(entry.href + "?"))
}

function getAction(row: AppNotification) {
    if (row.type === "order_message" || getDestination(row)?.name === "Messages") return "Open chat"
    if (row.type?.startsWith("gift_card")) return "View gift card"
    if (getDestination(row)?.name === "Orders") return "View order"
    if (getDestination(row)?.name === "Wallet") return "View wallet update"
    return "View update"
}

export function CustomerAccount({ name, updates, order }: {
    name: string
    updates: AppNotification[]
    order: { id: string; status: string } | null
}) {
    const openUpdate = useOpenUpdate()
    const [signingOut, setSigningOut] = useState(false)
    const [signOutError, setSignOutError] = useState(false)
    const actionable = updates.filter((entry) => attentionTypes.has(entry.type ?? "") && getDestination(entry))
    const featured = actionable[0]
    const remaining = actionable.slice(1)

    async function signOut() {
        if (signingOut) return
        setSigningOut(true)
        setSignOutError(false)
        if (!await performLogout(createClient())) {
            setSignOutError(true)
            setSigningOut(false)
        }
    }
    const delivery = order?.status === "out_for_delivery"
    const pending = order?.status === "pending"
    const active = featured ? getDestination(featured) : order ? destinations[0] : undefined
    const Icon = featured ? getNotificationPresentation(featured.type).icon : null

    return (
        <main className="min-w-0 px-1 py-2 sm:px-2 lg:py-4">
            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-orange-800 dark:text-orange-300">Your RSS Foods account</p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">My Account</h1>
            <p className="mt-1 text-sm text-muted-foreground">Welcome back, {name}.</p>
            <div className="mt-6 space-y-6">
                <section className="space-y-4 rounded-2xl border border-orange-100 bg-orange-50/60 p-5 dark:border-orange-900 dark:bg-orange-950/30 sm:p-6">
                    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                    <div className="min-w-0 space-y-2">
                    <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-orange-800 dark:text-orange-300">
                        {Icon && <Icon className="size-4" aria-hidden="true" />}
                        {featured ? `${active?.name} · New update` : order ? "Active order" : "Ready to shop"}
                    </p>
                    <h2 className="text-xl font-semibold tracking-tight">{featured?.title ?? (delivery ? "Your order is on the way" : pending ? "Payment pending" : order ? "Your order is in progress" : "What are you shopping for today?")}</h2>
                    {featured && <p className="text-sm text-muted-foreground">{featured.message}</p>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {featured ? <Button onClick={() => void openUpdate(featured)}>{getAction(featured)}</Button>
                            : <Button asChild><Link href={order ? `/account/orders/${order.id}` : "/"}>{delivery ? "Track delivery" : pending ? "View payment status" : order ? "View order" : "Continue shopping"}</Link></Button>}
                        {active && <Button variant="ghost" asChild><Link href={active.href}>{active.name === "Orders" || active.name === "Messages" ? `All ${active.name.toLowerCase()}` : active.name}</Link></Button>}
                    </div>
                    </div>
                    {remaining.length > 0 && (
                        <details className="border-t pt-3">
                            <summary className="cursor-pointer text-sm font-semibold">{remaining.length} more {remaining.length === 1 ? "update" : "updates"}</summary>
                            {remaining.map((row) => <button key={row.id} type="button" className="block min-h-11 w-full border-b py-2 text-left text-sm last:border-0" onClick={() => void openUpdate(row)}><strong className="block">{row.title}</strong><span className="text-muted-foreground">{row.message}</span></button>)}
                        </details>
                    )}
                </section>
                <div className="border-t pt-3">
                    <Button variant="ghost" onClick={() => void signOut()} disabled={signingOut}>
                        <LogOut className="size-4" aria-hidden="true" /> {signingOut ? "Signing out…" : "Sign out"}
                    </Button>
                    {signOutError && <p role="alert" className="text-sm text-destructive">Couldn’t sign out. Please try again.</p>}
                </div>
            </div>
        </main>
    )
}
