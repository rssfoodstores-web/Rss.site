"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    LayoutDashboard,
    Bell,
    CreditCard,
    User,
    LogOut,
    ChevronLeft,
    ClipboardList,
    HandCoins,
    History,
    MessageSquare,
    Tags,
    Users,
} from "lucide-react"
import { cn } from "@/lib/utils"
// import Image from "next/image" // Keeping image import if we decide to use it later for logo
import { createClient } from "@/lib/supabase/client"
import { useState } from "react"
import { performLogout } from "@/lib/auth/performLogout"

const navItems = [
    { label: "Overview", href: "/agent", icon: LayoutDashboard },
    { label: "Orders", href: "/agent/orders", icon: ClipboardList },
    { label: "Messages", href: "/agent/messages", icon: MessageSquare },
    { label: "Pricing", href: "/agent/pricing", icon: Tags },
    { label: "History", href: "/agent/history", icon: History },
    { label: "Referrals", href: "/account/referrals", icon: Users },
    { label: "Wallet", href: "/account/wallet", icon: CreditCard },
    { label: "Notifications", href: "/account/notifications", icon: Bell },
    { label: "Profile", href: "/account/profile", icon: User },
]

export function AgentSidebar({
    mobile,
    onNavigate,
    isCollapsed,
    setIsCollapsed
}: {
    mobile?: boolean;
    onNavigate?: () => void;
    isCollapsed?: boolean;
    setIsCollapsed?: (val: boolean) => void;
}) {
    const pathname = usePathname()
    const supabase = createClient()
    const [isLoggingOut, setIsLoggingOut] = useState(false)

    const handleLogout = async () => {
        if (isLoggingOut) {
            return
        }

        onNavigate?.()
        setIsLoggingOut(true)
        const didLogout = await performLogout(supabase)

        if (!didLogout) {
            setIsLoggingOut(false)
        }
    }

    return (
        <aside className={cn(
            "flex flex-col py-8 transition-all duration-500 ease-in-out bg-white dark:bg-zinc-950 h-full relative border-r border-gray-100 dark:border-zinc-800",
            mobile ? "w-full px-6" : cn(
                "sticky top-0 hidden lg:flex",
                isCollapsed ? "w-24 items-center" : "w-80 px-6"
            )
        )}>
            {/* Toggle Button Handle (Desktop Only) */}
            {!mobile && setIsCollapsed && (
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="absolute -right-3.5 top-12 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 h-7 w-7 rounded-full shadow-sm hover:shadow-md hover:border-[#F58220] transition-all z-50 flex items-center justify-center group"
                    title={isCollapsed ? "Expand" : "Collapse"}
                >
                    <ChevronLeft className={cn(
                        "h-4 w-4 text-gray-400 group-hover:text-[#F58220] transition-transform duration-500",
                        isCollapsed ? "rotate-180" : ""
                    )} />
                </button>
            )}

            {/* Logo Section */}
            <div className={cn(
                "mb-12 transition-all duration-500",
                isCollapsed ? "px-0" : "px-4"
            )}>
                <Link href="/" onClick={onNavigate} className="block">
                    {isCollapsed ? (
                        <div className="h-12 w-12 bg-gradient-to-br from-[#F58220] to-[#E57210] rounded-[1rem] flex items-center justify-center shadow-lg shadow-orange-500/20 mx-auto">
                            <HandCoins className="h-6 w-6 text-white" />
                        </div>
                    ) : (
                        <div className="flex items-center gap-3">
                            <span className="text-2xl font-extrabold text-[#F58220]">RSS FOODS</span>
                        </div>
                    )}
                </Link>
            </div>

            {/* Navigation Section */}
            <nav className={cn("flex-1 space-y-1.5", isCollapsed ? "w-full px-3" : "")}>
                {navItems.map((item) => {
                    const isActive =
                        item.href === "/agent"
                            ? pathname === item.href
                            : pathname === item.href || pathname.startsWith(`${item.href}/`)
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={onNavigate}
                            title={isCollapsed ? item.label : undefined}
                            className={cn(
                                "flex items-center gap-4 rounded-xl transition-all duration-300 group relative",
                                isCollapsed ? "justify-center p-3.5" : "px-5 py-3.5",
                                isActive
                                    ? "bg-orange-50 dark:bg-orange-950/20 text-[#F58220]"
                                    : "text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-900 hover:text-gray-900 dark:hover:text-white"
                            )}
                        >
                            {/* Active Indicator Line */}
                            {isActive && !isCollapsed && (
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#F58220] rounded-r-full" />
                            )}

                            <item.icon className={cn(
                                "h-5 w-5 transition-colors shrink-0",
                                isActive ? "text-[#F58220]" : "text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white"
                            )} />
                            {!isCollapsed && <span className="font-semibold text-[15px]">{item.label}</span>}
                        </Link>
                    )
                })}
            </nav>

            {/* Bottom Section (User/Logout) */}
            <div className={cn("mt-auto pt-6 border-t border-gray-50 dark:border-zinc-900", isCollapsed ? "px-2" : "px-2")}>
                <button
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    title={isCollapsed ? "Logout" : undefined}
                    className={cn(
                        "flex items-center gap-4 w-full rounded-xl text-gray-400 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-500 transition-all duration-300 group",
                        isCollapsed ? "justify-center p-3.5" : "px-5 py-3.5"
                    )}
                >
                    <LogOut className="h-5 w-5 group-hover:text-red-500 shrink-0" />
                    {!isCollapsed && <span className="font-semibold text-[15px]">{isLoggingOut ? "Signing Out..." : "Logout"}</span>}
                </button>
            </div>
        </aside>
    )
}
