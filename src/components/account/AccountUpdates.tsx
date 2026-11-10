"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, Bell, ChevronRight, LogOut, Package, ShoppingBag, Truck, type LucideIcon } from "lucide-react"
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
    const { user, unreadCount, unreadNotificationIds } = useUser()
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
    }, [open, unreadNotificationIds, userId])

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
                {current?.rows.map((row) => {
                    const seen = isNotificationRead(row) || (unreadNotificationIds !== null && !unreadNotificationIds.has(row.id))
                    return (
                        <DropdownMenuItem key={row.id} onSelect={() => void openUpdate({ ...row, read: seen })} className="block min-h-11 whitespace-normal">
                            <span className="flex items-start justify-between gap-3 font-medium">
                                <span>{row.title}</span>
                                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${seen ? "bg-muted text-muted-foreground" : "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200"}`}>{seen ? "Seen" : "New"}</span>
                            </span>
                            <span className="mt-1 block text-xs text-muted-foreground">{row.message}</span>
                        </DropdownMenuItem>
                    )
                })}
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

type OverviewOrder = { id: string; status: string }

type OverviewAction = {
    title: string
    detail: string
    label: string
    category: string
    href: string
    icon: LucideIcon
    notification?: AppNotification
}

function getOrderAction(order: OverviewOrder): OverviewAction {
    const delivery = order.status === "out_for_delivery"
    const pending = order.status === "pending"
    return {
        title: delivery ? "Your order is on the way" : pending ? "Payment pending" : "Your order is in progress",
        detail: `Order #${order.id.slice(0, 8).toUpperCase()}`,
        label: delivery ? "Track delivery" : pending ? "View payment status" : "View order",
        category: delivery ? "Active delivery" : pending ? "Payment status" : "Active order",
        href: `/account/orders/${order.id}`,
        icon: delivery ? Truck : Package,
    }
}

function orderPriority(status: string) {
    if (status === "out_for_delivery") return 0
    if (status === "pending") return 1
    return 2
}

export function CustomerAccount({ name, updates, orders }: {
    name: string
    updates: AppNotification[]
    orders: OverviewOrder[]
}) {
    const openUpdate = useOpenUpdate()
    const { unreadNotificationIds } = useUser()
    const [signingOut, setSigningOut] = useState(false)
    const [signOutError, setSignOutError] = useState(false)
    const actionable = updates.filter((entry) => attentionTypes.has(entry.type ?? "") && getDestination(entry)
        && (unreadNotificationIds === null || unreadNotificationIds.has(entry.id)))
    const notificationActions: OverviewAction[] = actionable.map((row) => ({
        title: row.title,
        detail: row.message,
        label: getAction(row),
        category: getDestination(row)?.name ?? "Update",
        icon: getNotificationPresentation(row.type).icon,
        href: getSafeNotificationHref(row.action_url) ?? "/account",
        notification: row,
    }))
    const orderActions = [...orders].sort((a, b) => orderPriority(a.status) - orderPriority(b.status)).map(getOrderAction)
    const actions = [...notificationActions, ...orderActions].filter((entry, index, entries) =>
        entries.findIndex((candidate) => candidate.href === entry.href) === index)
    const [first, ...remaining] = actions
    const next: OverviewAction = first ?? {
        title: "What are you shopping for today?",
        detail: "Browse stores near your delivery address.",
        label: "Continue shopping", category: "Ready to shop", href: "/", icon: ShoppingBag,
    }
    const Icon = next.icon

    async function signOut() {
        if (signingOut) return
        setSigningOut(true)
        setSignOutError(false)
        if (!await performLogout(createClient())) {
            setSignOutError(true)
            setSigningOut(false)
        }
    }

    return (
        <main className="mx-auto min-w-0 max-w-4xl px-1 py-2 sm:px-2 lg:py-4">
            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-orange-800 dark:text-orange-300">Customer dashboard</p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Overview</h1>
            <p className="mt-1 text-sm text-muted-foreground">Good to see you, {name}.</p>
            <section aria-labelledby="customer-next-action" className="mt-5 rounded-3xl border border-orange-100 bg-gradient-to-br from-orange-100/75 via-orange-50 to-card p-5 dark:border-orange-900 dark:from-orange-950/65 dark:via-orange-950/25 sm:p-7">
                <div className="flex min-w-0 flex-col items-start gap-4 sm:flex-row sm:items-center">
                    <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-orange-200/80 text-orange-900 dark:bg-orange-900/55 dark:text-orange-200"><Icon className="size-6" aria-hidden="true" /></span>
                    <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-wider text-orange-800 dark:text-orange-300">{next.category}</p>
                        <h2 id="customer-next-action" className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{next.title}</h2>
                        {next.detail && <p className="mt-1 break-words text-sm text-muted-foreground">{next.detail}</p>}
                    </div>
                </div>
                <div className="mt-5">
                    {next.notification ? (
                        <Button onClick={() => next.notification && void openUpdate(next.notification)} className="min-h-11 w-full sm:w-auto">{next.label}<ArrowRight className="size-4" aria-hidden="true" /></Button>
                    ) : <Button asChild className="min-h-11 w-full sm:w-auto"><Link href={next.href}>{next.label}<ArrowRight className="size-4" aria-hidden="true" /></Link></Button>}
                </div>
            </section>
            {remaining.length > 0 && (
                <section aria-labelledby="customer-other-actions" className="mt-5">
                    <h2 id="customer-other-actions" className="mb-2 text-sm font-semibold">Also on your radar</h2>
                    <div className="divide-y rounded-2xl border bg-card">
                        {remaining.slice(0, 2).map((entry) => {
                            const row = <><span className="min-w-0"><strong className="block text-sm">{entry.title}</strong><span className="block break-words text-xs text-muted-foreground">{entry.detail}</span></span><ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /></>
                            const style = "flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40"
                            return entry.notification
                                ? <button key={entry.href} type="button" className={style} onClick={() => entry.notification && void openUpdate(entry.notification)}>{row}</button>
                                : <Link key={entry.href} className={style} href={entry.href}>{row}</Link>
                        })}
                    </div>
                </section>
            )}
            <div className="mt-6 border-t pt-3">
                <Button variant="ghost" onClick={() => void signOut()} disabled={signingOut}>
                    <LogOut className="size-4" aria-hidden="true" /> {signingOut ? "Signing out…" : "Sign out"}
                </Button>
                {signOutError && <p role="alert" className="text-sm text-destructive">Couldn’t sign out. Please try again.</p>}
            </div>
        </main>
    )
}
