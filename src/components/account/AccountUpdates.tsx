"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Bell, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/context/UserContext"
import { useDeliveryDestination } from "@/context/DeliveryDestinationContext"
import { markAsRead } from "@/app/account/notifications/actions"
import { getNotificationPresentation, isNotificationRead, type AppNotification } from "@/lib/notifications"

function updateHref(notification: AppNotification) {
    const href = notification.action_url
    return href?.startsWith("/") && !href.startsWith("//") && !href.includes("\\") ? href : null
}

function useOpenUpdate() {
    const router = useRouter()
    const { refreshUnreadCount, user } = useUser()
    return async (notification: AppNotification) => {
        if (!isNotificationRead(notification)) {
            const result = await markAsRead(notification.id)
            if (result.success && user) void refreshUnreadCount(user.id)
        }
        const href = updateHref(notification)
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

const destinations = [
    { name: "Orders", href: "/account/orders", detail: "Active deliveries and past orders" },
    { name: "Messages", href: "/account/messages", detail: "Order conversations" },
    { name: "Delivery addresses", href: "/account/address", detail: "Manage your saved destinations" },
    { name: "Wallet", href: "/account/wallet", detail: "Balance and transactions" },
    { name: "Personal details", href: "/account/profile", detail: "Name, email and phone" },
]

function getDestination(row: AppNotification) {
    const href = updateHref(row)
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
    const { selectedAddress } = useDeliveryDestination()
    const openUpdate = useOpenUpdate()
    const featured = updates.find((entry) => updateHref(entry) && getDestination(entry))
    const remaining = updates.filter((entry) => entry.id !== featured?.id)
    const delivery = order?.status === "out_for_delivery"
    const pending = order?.status === "pending"
    const active = featured ? getDestination(featured) : order ? destinations[0] : undefined
    const Icon = featured ? getNotificationPresentation(featured.type).icon : null

    return (
        <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-12">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">My Account</h1>
            <p className="mt-1 text-sm text-muted-foreground">Welcome back, {name}.</p>
            <div className="mt-6 grid items-start gap-5 md:grid-cols-[1.15fr_1fr]">
                <section className="space-y-3 rounded-2xl border bg-card p-5">
                    <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-orange-800 dark:text-orange-300">
                        {Icon && <Icon className="size-4" aria-hidden="true" />}
                        {featured ? `${active?.name} · New update` : order ? "Active order" : "Ready to shop"}
                    </p>
                    <h2 className="text-xl font-semibold tracking-tight">{featured?.title ?? (delivery ? "Your order is on the way" : pending ? "Payment pending" : order ? "Your order is in progress" : "What are you shopping for today?")}</h2>
                    {featured && <p className="text-sm text-muted-foreground">{featured.message}</p>}
                    <div className="flex flex-wrap items-center gap-2">
                        {featured ? <Button onClick={() => void openUpdate(featured)}>{getAction(featured)}</Button>
                            : <Button asChild><Link href={order ? `/account/orders/${order.id}` : "/"}>{delivery ? "Track delivery" : pending ? "View payment status" : order ? "View order" : "Continue shopping"}</Link></Button>}
                        {active && <Button variant="ghost" asChild><Link href={active.href}>{active.name === "Orders" || active.name === "Messages" ? `All ${active.name.toLowerCase()}` : active.name}</Link></Button>}
                    </div>
                    {remaining.length > 0 && (
                        <details className="border-t pt-3">
                            <summary className="cursor-pointer text-sm font-semibold">{remaining.length} more {remaining.length === 1 ? "update" : "updates"}</summary>
                            {remaining.map((row) => <button key={row.id} type="button" className="block min-h-11 w-full border-b py-2 text-left text-sm last:border-0" onClick={() => void openUpdate(row)}><strong className="block">{row.title}</strong><span className="text-muted-foreground">{row.message}</span></button>)}
                        </details>
                    )}
                </section>
                <nav aria-label="Account destinations" className="divide-y rounded-2xl border bg-card px-4">
                    {destinations.filter((item) => item.href !== active?.href).map((item) => (
                        <Link key={item.href} href={item.href} className="flex min-h-14 items-center justify-between gap-3 py-3">
                            <span><strong className="block text-sm">{item.name}</strong><span className="text-xs text-muted-foreground">{item.name === "Delivery addresses" && selectedAddress ? selectedAddress.label : item.detail}</span></span>
                            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        </Link>
                    ))}
                </nav>
            </div>
        </main>
    )
}
