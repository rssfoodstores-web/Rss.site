"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { ClipboardList, House, LogOut, MapPin, Menu, MessageCircle, Package, ShoppingBag, Truck, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { useUser } from "@/context/UserContext"
import { getNotificationCountForHrefs } from "@/lib/notifications"
import { performLogout } from "@/lib/auth/performLogout"
import { createClient } from "@/lib/supabase/client"
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
        { label: "Wallet & gift cards", href: "/account/wallet", icon: Wallet },
    ],
    rider: [
        { label: "Deliveries", href: "/rider", icon: Truck },
        { label: "Overview", href: "/rider/overview", icon: House },
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

export function DashboardTopBar({ role, approved, name, avatarUrl }: {
    role: DashboardRole
    approved: boolean
    name?: string
    avatarUrl?: string | null
}) {
    const { profile, roleNames, workspaceStatuses } = useUser()
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const displayName = profile?.full_name?.trim() || (typeof name === "string" ? name.trim() : "") || "My profile"
    const rawAvatar = profile?.avatar_url ?? avatarUrl
    const avatar = typeof rawAvatar === "string" && /^(https?:\/\/|\/(?!\/))/.test(rawAvatar) ? rawAvatar : null
    const initials = displayName.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("")
    const available = workspaces.filter((item) => item === role || roleNames.includes(item) || workspaceStatuses[item] !== null)

    useEffect(() => {
        if (!open) return
        const desktop = window.matchMedia("(min-width: 1024px)")
        function closeOnDesktop() {
            if (desktop.matches) setOpen(false)
        }
        closeOnDesktop()
        desktop.addEventListener("change", closeOnDesktop)
        return () => desktop.removeEventListener("change", closeOnDesktop)
    }, [open])

    const switcher = available.length > 0 && (
        <label className="grid gap-1 text-sm font-medium sm:flex sm:items-center sm:gap-2">
            Switch dashboard
            <select value={role} onChange={(event) => {
                const destination = roots[event.target.value as DashboardRole]
                if (!destination) return
                setOpen(false)
                router.push(destination)
            }} className="min-h-11 min-w-0 rounded-lg border bg-background px-3 text-sm">
                <option value="customer">Customer</option>
                {available.map((item) => (
                    <option key={item} value={item}>{titles[item]}{workspaceStatuses[item] === "pending" ? " · Pending" : ""}</option>
                ))}
            </select>
        </label>
    )

    return (
        <div className="mb-4 flex min-w-0 items-center justify-between gap-2 rounded-2xl border bg-card p-2 sm:px-4">
            <div className="flex min-w-0 flex-1 items-center gap-2">
                <Sheet open={open} onOpenChange={setOpen}>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-11 shrink-0 text-orange-800 dark:text-orange-300 lg:hidden" aria-label="Open dashboard menu">
                            <Menu className="size-5" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="flex w-[min(86vw,22rem)] flex-col gap-4 overflow-y-auto px-4 py-5 motion-reduce:animate-none">
                        <SheetHeader className="pr-7 text-left">
                            <SheetTitle>Dashboard menu</SheetTitle>
                            <SheetDescription>Switch dashboards or open a page.</SheetDescription>
                        </SheetHeader>
                        {switcher}
                        <DashboardSidebar role={role} approved={approved} onNavigate={() => setOpen(false)} />
                    </SheetContent>
                </Sheet>
                <Link href="/account/profile" className="flex min-h-11 min-w-0 items-center gap-2 rounded-xl p-1 hover:bg-muted/60">
                    {avatar ? <Image src={avatar} alt="" width={36} height={36} unoptimized className="size-9 shrink-0 rounded-full object-cover" />
                        : <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-orange-100 font-bold text-orange-900 dark:bg-orange-950 dark:text-orange-200">{initials}</span>}
                    <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{displayName}</span>
                        <span className="block text-xs text-muted-foreground">Edit profile</span>
                    </span>
                </Link>
            </div>
            <span className="shrink-0 text-xs font-semibold text-muted-foreground lg:hidden">{titles[role]}</span>
            <div className="hidden shrink-0 lg:block">{switcher}</div>
        </div>
    )
}

export function DashboardSidebar({ role, approved, onNavigate }: { role: DashboardRole; approved: boolean; onNavigate?: () => void }) {
    const pathname = usePathname()
    const { notificationPathCounts } = useUser()
    const pages = approved ? navigation[role] : [{ label: "Application status", href: roots[role], icon: ClipboardList }]
    const currentPath = role === "customer" && pathname === "/account/gift-card" ? "/account/wallet"
        : role === "customer" && pathname === "/account/track-order" ? "/account/orders" : pathname

    return (
        <div>
            <nav aria-label={`${titles[role]} dashboard pages`} className="rounded-2xl border bg-card p-2 sm:p-3">
                <p className="px-2 pb-2 pt-1 text-xs font-bold uppercase tracking-wider text-orange-800 dark:text-orange-300">{titles[role]}</p>
                <ul className="grid gap-1">
                    {pages.map(({ label, href, icon: Icon }) => {
                        const active = currentPath === href || (href !== roots[role] && currentPath?.startsWith(href + "/"))
                        const unread = getNotificationCountForHrefs([href], notificationPathCounts)
                        return (
                            <li key={href} className="min-w-0">
                                <Link href={href} onNavigate={onNavigate} aria-current={active ? "page" : undefined}
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
            {role === "customer" && <CustomerSignOut />}
        </div>
    )
}

function CustomerSignOut() {
    const [busy, setBusy] = useState(false)
    const [failed, setFailed] = useState(false)

    async function signOut() {
        setBusy(true)
        setFailed(false)
        if (!await performLogout(createClient())) {
            setBusy(false)
            setFailed(true)
        }
    }

    return (
        <div className="mt-2 px-2">
            <Button type="button" variant="ghost" className="min-h-11 justify-start" onClick={() => void signOut()} disabled={busy}>
                <LogOut className="size-4" aria-hidden="true" /> {busy ? "Signing out…" : "Sign out"}
            </Button>
            {failed && <p role="alert" className="text-sm text-destructive">Couldn’t sign out. Please try again.</p>}
        </div>
    )
}
