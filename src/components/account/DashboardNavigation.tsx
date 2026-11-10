"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { ClipboardList, House, MapPin, MessageCircle, Package, ShoppingBag, Truck, Wallet } from "lucide-react"
import { useUser } from "@/context/UserContext"
import { getNotificationCountForHrefs } from "@/lib/notifications"
import { cn } from "@/lib/utils"

const workspaces = ["rider", "merchant", "agent"] as const
export type DashboardRole = "customer" | (typeof workspaces)[number]

const titles: Record<DashboardRole, string> = {
    customer: "Customer", rider: "Rider", merchant: "Merchant", agent: "Agent",
}

const roots: Record<DashboardRole, string> = {
    customer: "/account", rider: "/rider", merchant: "/merchant", agent: "/agent",
}

const navigation = {
    customer: [
        { label: "Overview", href: "/account", icon: House },
        { label: "Orders", href: "/account/orders", icon: Package },
        { label: "Messages", href: "/account/messages", icon: MessageCircle },
        { label: "Delivery addresses", href: "/account/address", icon: MapPin },
        { label: "Wallet", href: "/account/wallet", icon: Wallet },
    ],
    rider: [
        { label: "Overview", href: "/rider", icon: House },
        { label: "Deliveries", href: "/rider/deliveries", icon: Truck },
        { label: "Messages", href: "/rider/messages", icon: MessageCircle },
    ],
    merchant: [
        { label: "Overview", href: "/merchant", icon: House },
        { label: "Orders", href: "/merchant/orders", icon: ClipboardList },
        { label: "Products", href: "/merchant/products", icon: ShoppingBag },
        { label: "Messages", href: "/merchant/messages", icon: MessageCircle },
        { label: "Transactions", href: "/merchant/transactions", icon: Wallet },
    ],
    agent: [
        { label: "Overview", href: "/agent", icon: House },
        { label: "Orders", href: "/agent/orders", icon: ClipboardList },
        { label: "Messages", href: "/agent/messages", icon: MessageCircle },
        { label: "Pricing", href: "/agent/pricing", icon: Wallet },
        { label: "History", href: "/agent/history", icon: Package },
    ],
}

export function DashboardTopBar({ role, name, avatarUrl }: { role: DashboardRole; name?: string; avatarUrl?: string | null }) {
    const { profile, roleNames, workspaceStatuses } = useUser()
    const router = useRouter()
    const displayName = profile?.full_name?.trim() || (typeof name === "string" ? name.trim() : "") || "My profile"
    const rawAvatar = profile?.avatar_url ?? avatarUrl
    const avatar = typeof rawAvatar === "string" && /^(https?:\/\/|\/(?!\/))/.test(rawAvatar) ? rawAvatar : null
    const initials = displayName.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("")
    const available = workspaces.filter((item) => item === role || roleNames.includes(item) || workspaceStatuses[item] !== null)

    return (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-3 sm:px-5">
            <Link href="/account/profile" className="flex min-h-11 max-w-full items-center gap-3 rounded-xl p-1 hover:bg-muted/60">
                {avatar ? <Image src={avatar} alt="" width={40} height={40} unoptimized className="size-10 shrink-0 rounded-full object-cover" />
                    : <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-orange-100 font-bold text-orange-900 dark:bg-orange-950 dark:text-orange-200">{initials}</span>}
                <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{displayName}</span>
                    <span className="block text-xs text-muted-foreground">Edit profile</span>
                </span>
            </Link>
            {available.length > 0 && (
                <label className="flex min-h-11 max-w-full flex-wrap items-center gap-2 text-sm font-medium">
                    Dashboard
                    <select value={role} onChange={(event) => router.push(roots[event.target.value as DashboardRole])}
                        className="min-h-11 max-w-full rounded-lg border bg-background px-3 text-sm">
                        <option value="customer">Customer</option>
                        {available.map((item) => (
                            <option key={item} value={item}>{titles[item]}{workspaceStatuses[item] === "pending" ? " · Pending" : ""}</option>
                        ))}
                    </select>
                </label>
            )}
        </div>
    )
}

export function DashboardSidebar({ role, approved }: { role: DashboardRole; approved: boolean }) {
    const pathname = usePathname()
    const { notificationPathCounts } = useUser()
    const pages = approved ? navigation[role] : [{ label: "Application status", href: roots[role], icon: ClipboardList }]
    const currentPath = role === "customer" && pathname === "/account/gift-card" ? "/account/wallet"
        : role === "customer" && pathname === "/account/track-order" ? "/account/orders" : pathname

    return (
        <nav aria-label={`${titles[role]} dashboard pages`} className="rounded-2xl border bg-card p-2 sm:p-3">
            <p className="px-2 pb-2 pt-1 text-xs font-bold uppercase tracking-wider text-orange-800 dark:text-orange-300">{titles[role]}</p>
            <ul className="grid grid-cols-2 gap-1 lg:grid-cols-1">
                {pages.map(({ label, href, icon: Icon }) => {
                    const active = currentPath === href || (href !== roots[role] && currentPath?.startsWith(href + "/"))
                    const unread = getNotificationCountForHrefs(href === "/account/wallet" ? [href, "/account/gift-card"] : [href], notificationPathCounts)
                    return (
                        <li key={href} className="min-w-0">
                            <Link href={href} aria-current={active ? "page" : undefined}
                                className={cn("flex min-h-11 min-w-0 items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium hover:bg-muted/60", active && "bg-orange-100 text-orange-950 hover:bg-orange-100 dark:bg-orange-950/70 dark:text-orange-200")}>
                                <Icon className="size-4 shrink-0" aria-hidden="true" />
                                <span className="min-w-0 flex-1 break-words">{label}</span>
                                {unread > 0 && <span className="shrink-0 rounded-full bg-orange-700 px-1.5 text-xs text-white" aria-label={`${unread} unread`}>{unread > 9 ? "9+" : unread}</span>}
                            </Link>
                        </li>
                    )
                })}
            </ul>
        </nav>
    )
}
