"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    Bell,
    ChevronDown,
    ChevronRight,
    ClipboardList,
    Clock3,
    Gift,
    History,
    LayoutDashboard,
    Lock,
    LogOut,
    MapPin,
    Menu,
    MessageSquare,
    RefreshCcw,
    ShoppingBag,
    ShoppingCart,
    Trophy,
    Truck,
    User,
    Users,
    Wallet,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Sheet,
    SheetClose,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/context/UserContext"
import { canUpdateAccountPassword } from "@/lib/authProviders"
import { getNotificationCountForHrefs } from "@/lib/notifications"
import { performLogout } from "@/lib/auth/performLogout"

interface ProfileSidebarProps {
    className?: string
}

type WorkspaceRole = "merchant" | "agent" | "rider"

interface NavItem {
    label: string
    href: string
    icon: React.ComponentType<{ className?: string }>
    badge?: string | number
    matchHrefs?: string[]
}

interface NavSection {
    key: string
    title: string
    status?: string | null
    items: NavItem[]
}

const accountItems: NavItem[] = [
    { label: "My Account", href: "/account", icon: User },
    { label: "Edit Profile", href: "/account/profile", icon: User },
    { label: "Order History", href: "/account/orders", icon: RefreshCcw },
    { label: "My Referrals", href: "/account/referrals", icon: Users },
    { label: "My Cook-Off", href: "/account/cook-off", icon: Trophy },
    { label: "My Gift Card", href: "/account/gift-card", icon: Gift },
    { label: "My Rewards", href: "/account/rewards", icon: Trophy },
    { label: "Password", href: "/account/password", icon: Lock },
]

const workspaceItems: Record<WorkspaceRole, NavItem[]> = {
    merchant: [
        { label: "Merchant Overview", href: "/merchant", icon: LayoutDashboard },
        { label: "Products", href: "/merchant/products", icon: ShoppingBag },
        { label: "Orders", href: "/merchant/orders", icon: ShoppingCart },
        { label: "Transactions", href: "/merchant/transactions", icon: Wallet },
        { label: "Location", href: "/merchant/verify-location", icon: MapPin },
    ],
    agent: [
        { label: "Agent Overview", href: "/agent", icon: LayoutDashboard },
        { label: "Orders", href: "/agent/orders", icon: ClipboardList },
        { label: "Pricing", href: "/agent/pricing", icon: ShoppingBag },
        { label: "History", href: "/agent/history", icon: History },
    ],
    rider: [
        { label: "Rider Overview", href: "/rider", icon: LayoutDashboard },
        { label: "Deliveries", href: "/rider/deliveries", icon: Truck },
    ],
}

const messageRouteByRole: Record<WorkspaceRole, string> = {
    merchant: "/merchant/messages",
    agent: "/agent/messages",
    rider: "/rider/messages",
}

const messageMatchHrefs = [
    "/account/messages",
    messageRouteByRole.merchant,
    messageRouteByRole.agent,
    messageRouteByRole.rider,
]

function formatWorkspaceStatus(status: string | null) {
    if (!status) {
        return "inactive"
    }

    return status.replace(/_/g, " ")
}

function getStatusBadgeClasses(status: string | null) {
    if (status === "approved") {
        return "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300"
    }

    if (status === "pending") {
        return "border-orange-200 bg-orange-50 text-[#F58220] dark:border-orange-950 dark:bg-orange-950/20 dark:text-orange-300"
    }

    if (status === "rejected") {
        return "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
    }

    return "border-gray-200 bg-gray-50 text-gray-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-300"
}

function matchesPath(pathname: string, href: string) {
    if (href === "/account") {
        return pathname === href
    }

    return pathname === href || pathname.startsWith(`${href}/`)
}

function isItemActive(pathname: string, item: NavItem) {
    return [item.href, ...(item.matchHrefs ?? [])].some((href) => matchesPath(pathname, href))
}

function getSharedMessagesHref(pathname: string, approvedRoles: WorkspaceRole[]) {
    const currentWorkspaceRoute = Object.values(messageRouteByRole).find((href) => matchesPath(pathname, href))

    if (currentWorkspaceRoute) {
        return currentWorkspaceRoute
    }

    const activeWorkspaceRole = (["merchant", "agent", "rider"] as const).find(
        (role) => approvedRoles.includes(role) && matchesPath(pathname, `/${role}`)
    )

    if (activeWorkspaceRole) {
        return messageRouteByRole[activeWorkspaceRole]
    }

    if (approvedRoles.length === 1) {
        return messageRouteByRole[approvedRoles[0]]
    }

    return "/account/messages"
}

function LoadingSkeleton() {
    return (
        <div className="space-y-3">
            <div className="h-5 w-28 rounded bg-gray-100 dark:bg-zinc-800" />
            <div className="space-y-2">
                <div className="h-11 rounded-xl bg-gray-100 dark:bg-zinc-800" />
                <div className="h-11 rounded-xl bg-gray-100 dark:bg-zinc-800" />
                <div className="h-11 rounded-xl bg-gray-100 dark:bg-zinc-800" />
            </div>
        </div>
    )
}

export function ProfileSidebar({ className }: ProfileSidebarProps) {
    const pathname = usePathname()
    const { unreadCount, notificationPathCounts, roleNames, workspaceStatuses, isLoading, user } = useUser()
    const [supabase] = useState(() => createClient())
    const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})
    const [isLoggingOut, setIsLoggingOut] = useState(false)
    const [mobileSheetOpen, setMobileSheetOpen] = useState(false)
    const mobileNavRef = useRef<HTMLDivElement | null>(null)
    const showLoadingSkeleton =
        isLoading &&
        roleNames.length === 0 &&
        Object.values(workspaceStatuses).every((status) => status === null)

    const roleSet = useMemo(() => new Set(roleNames), [roleNames])
    const approvedRoles = useMemo(
        () =>
            (["merchant", "agent", "rider"] as const).filter((role) => workspaceStatuses[role] === "approved"),
        [workspaceStatuses]
    )
    const visibleAccountItems = useMemo(
        () => accountItems.filter((item) => item.href !== "/account/password" || canUpdateAccountPassword(user)),
        [user]
    )

    const withNotificationBadge = useCallback((item: NavItem): NavItem => {
        if (item.href === "/account/notifications") {
            return {
                ...item,
                badge: unreadCount > 0 ? unreadCount : undefined,
            }
        }

        const routeNotificationCount = getNotificationCountForHrefs(
            [item.href, ...(item.matchHrefs ?? [])],
            notificationPathCounts
        )

        if (routeNotificationCount === 0) {
            return item.badge ? { ...item, badge: undefined } : item
        }

        return {
            ...item,
            badge: routeNotificationCount,
        }
    }, [notificationPathCounts, unreadCount])

    const sharedItems = useMemo<NavItem[]>(() => {
        const messagesHref = getSharedMessagesHref(pathname, approvedRoles)

        return [
            {
                label: "Messages",
                href: messagesHref,
                icon: MessageSquare,
                matchHrefs: messageMatchHrefs.filter((href) => href !== messagesHref),
            },
            { label: "Wallet", href: "/account/wallet", icon: Wallet },
            {
                label: "Notifications",
                href: "/account/notifications",
                icon: Bell,
            },
        ]
    }, [approvedRoles, pathname])

    const sections = useMemo<NavSection[]>(
        () => [
            {
                key: "account",
                title: "My Account",
                items: visibleAccountItems.map(withNotificationBadge),
            },
            {
                key: "shared",
                title: "Shared",
                items: sharedItems.map(withNotificationBadge),
            },
            ...(["merchant", "agent", "rider"] as const)
                .filter((role) => roleSet.has(role) || workspaceStatuses[role] !== null)
                .map((role) => {
                    const status = workspaceStatuses[role]
                    const approved = status === "approved"

                    return {
                        key: role,
                        title: `${role.charAt(0).toUpperCase()}${role.slice(1)} Pages`,
                        status,
                        items: (approved
                            ? workspaceItems[role]
                            : [
                                {
                                    label: "Account in process",
                                    href: `/${role}`,
                                    icon: Clock3,
                                },
                            ]).map(withNotificationBadge),
                    }
                }),
        ],
        [roleSet, sharedItems, visibleAccountItems, withNotificationBadge, workspaceStatuses]
    )

    const activeSection = useMemo(
        () => sections.find((section) => section.items.some((item) => isItemActive(pathname, item))) ?? sections[0] ?? null,
        [pathname, sections]
    )

    const activeItem = useMemo(
        () => activeSection?.items.find((item) => isItemActive(pathname, item)) ?? activeSection?.items[0] ?? null,
        [activeSection, pathname]
    )

    const mobileSwipeItems = useMemo(() => {
        const uniqueItems = new Map<string, NavItem>()

        for (const section of sections) {
            for (const item of section.items) {
                uniqueItems.set(item.href, item)
            }
        }

        return Array.from(uniqueItems.values())
    }, [sections])

    useEffect(() => {
        const activeChip = mobileNavRef.current?.querySelector<HTMLElement>('[data-active-nav="true"]')
        activeChip?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
            inline: "center",
        })
    }, [pathname])

    const handleLogout = async () => {
        if (isLoggingOut) {
            return
        }

        setMobileSheetOpen(false)
        setIsLoggingOut(true)
        const didLogout = await performLogout(supabase)

        if (!didLogout) {
            setIsLoggingOut(false)
        }
    }

    const toggleSection = (key: string) => {
        setCollapsedSections((current) => ({
            ...current,
            [key]: !current[key],
        }))
    }

    const renderNavItem = (item: NavItem, closeOnSelect = false) => {
        const isActive = isItemActive(pathname, item)
        const content = (
            <Link
                href={item.href}
                className={cn(
                    "group flex min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 lg:px-4 lg:py-3",
                    isActive
                        ? "bg-[#F58220]/10 text-[#F58220]"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-zinc-800 dark:hover:text-white"
                )}
            >
                <item.icon
                    className={cn(
                        "h-4 w-4 shrink-0 lg:h-5 lg:w-5",
                        isActive ? "text-[#F58220]" : "text-gray-400 group-hover:text-[#F58220]"
                    )}
                />
                <span className="min-w-0 flex-1 text-sm font-medium lg:text-base">{item.label}</span>
                {item.badge ? (
                    <span className="ml-auto shrink-0 rounded-full bg-[#F58220] px-2 py-0.5 text-xs font-bold text-white">
                        {item.badge}
                    </span>
                ) : null}
            </Link>
        )

        if (closeOnSelect) {
            return (
                <SheetClose asChild key={item.href}>
                    {content}
                </SheetClose>
            )
        }

        return <div key={item.href}>{content}</div>
    }

    const renderSections = (closeOnSelect = false) => (
        <>
            {sections.map((section) => {
                const isExpanded = !collapsedSections[section.key]

                return (
                    <section key={section.key} className="space-y-2">
                        <button
                            type="button"
                            onClick={() => toggleSection(section.key)}
                            className="flex w-full items-center justify-between rounded-xl px-2 py-1 text-left transition hover:bg-gray-50 dark:hover:bg-zinc-800/70"
                        >
                            <div className="flex min-w-0 items-center gap-2">
                                <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                                    {section.title}
                                </h3>
                                {section.status ? (
                                    <Badge className={cn("shrink-0 capitalize", getStatusBadgeClasses(section.status))}>
                                        {formatWorkspaceStatus(section.status)}
                                    </Badge>
                                ) : null}
                            </div>
                            {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-gray-400" />
                            ) : (
                                <ChevronRight className="h-4 w-4 text-gray-400" />
                            )}
                        </button>

                        <div
                            className={cn(
                                "grid transition-all duration-200",
                                isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-70"
                            )}
                        >
                            <div className="overflow-hidden">
                                <div className="flex flex-col gap-1 pt-1">
                                    {section.items.map((item) => renderNavItem(item, closeOnSelect))}
                                </div>
                            </div>
                        </div>
                    </section>
                )
            })}
        </>
    )

    return (
        <>
            <div
                className={cn(
                    "rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 lg:hidden",
                    className
                )}
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gray-400 dark:text-gray-500">
                            Account menu
                        </p>
                        <div className="mt-2 flex min-w-0 items-center gap-3">
                            {activeItem ? (
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#F58220]/10 text-[#F58220]">
                                    <activeItem.icon className="h-5 w-5" />
                                </div>
                            ) : null}
                            <div className="min-w-0">
                                <p className="truncate text-base font-bold text-gray-900 dark:text-white">
                                    {showLoadingSkeleton ? "Loading navigation..." : activeItem?.label ?? "Browse your account"}
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {activeSection?.title ?? "Wallet, orders, notifications, and workspaces"}
                                </p>
                            </div>
                        </div>
                    </div>

                    <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
                        <SheetTrigger asChild>
                            <Button
                                type="button"
                                variant="outline"
                                className="h-11 shrink-0 rounded-xl border-gray-200 px-4 font-semibold dark:border-zinc-700"
                            >
                                <Menu className="mr-2 h-4 w-4" />
                                Open
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="left" className="w-[92vw] max-w-sm overflow-y-auto p-0">
                            <SheetHeader className="border-b border-gray-100 px-5 py-5 dark:border-zinc-800">
                                <SheetTitle>Account navigation</SheetTitle>
                                <SheetDescription>
                                    Jump between your account pages, shared tools, and any approved workspace pages.
                                </SheetDescription>
                            </SheetHeader>

                            <div className="space-y-5 px-4 py-4">
                                {showLoadingSkeleton ? <LoadingSkeleton /> : renderSections(true)}

                                <div className="border-t border-gray-100 pt-4 dark:border-zinc-800">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={handleLogout}
                                        disabled={isLoggingOut}
                                        className="w-full justify-start rounded-xl px-4 py-3 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/10"
                                    >
                                        <LogOut className="mr-3 h-5 w-5" />
                                        {isLoggingOut ? "Signing Out..." : "Log Out"}
                                    </Button>
                                </div>
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>

                {!showLoadingSkeleton && mobileSwipeItems.length > 0 ? (
                    <div
                        ref={mobileNavRef}
                        aria-label="Swipeable account navigation"
                        className="mt-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-0.5 pb-1 scroll-smooth touch-pan-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    >
                        {mobileSwipeItems.map((item) => {
                            const isActive = isItemActive(pathname, item)

                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    data-active-nav={isActive ? "true" : "false"}
                                    className={cn(
                                        "inline-flex shrink-0 snap-start items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition",
                                        isActive
                                            ? "border-[#F58220] bg-[#F58220]/10 text-[#F58220]"
                                            : "border-gray-200 bg-white text-gray-600 hover:border-[#F58220]/40 hover:text-[#F58220] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                                    )}
                                >
                                    <item.icon className="h-4 w-4" />
                                    <span>{item.label}</span>
                                    {item.badge ? (
                                        <span className="rounded-full bg-[#F58220] px-1.5 py-0.5 text-[10px] font-bold text-white">
                                            {item.badge}
                                        </span>
                                    ) : null}
                                </Link>
                            )
                        })}
                    </div>
                ) : null}
            </div>

            <div
                className={cn(
                    "hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 lg:block",
                    className
                )}
            >
                <div className="border-b border-gray-100 p-6 dark:border-zinc-800">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Navigation</h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Account pages, shared tools, and approved role workspaces live together here.
                    </p>
                </div>

                <nav className="space-y-5 p-4">
                    {showLoadingSkeleton ? <LoadingSkeleton /> : renderSections()}

                    <button
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-red-500 transition-all duration-200 hover:bg-red-50 dark:hover:bg-red-900/10"
                    >
                        <LogOut className="h-5 w-5" />
                        <span className="font-medium">{isLoggingOut ? "Signing Out..." : "Log Out"}</span>
                    </button>
                </nav>
            </div>
        </>
    )
}
