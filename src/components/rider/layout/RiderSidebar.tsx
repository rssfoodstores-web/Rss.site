"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Truck, Wallet, MessageSquare, Users, Settings, LogOut, ChevronLeft, ChevronRight, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useDashboardLayout } from "@/contexts/DashboardLayoutContext"
import { createClient } from "@/lib/supabase/client"
import { useState, useEffect } from "react"
import { performLogout } from "@/lib/auth/performLogout"

const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/rider" },
    { icon: Truck, label: "Deliveries", href: "/rider/deliveries" },
    { icon: Wallet, label: "Earnings", href: "/rider/earnings" },
    { icon: MessageSquare, label: "Messages", href: "/rider/messages", badge: true },
    { icon: Users, label: "Refer & Earn", href: "/account/referrals" },
    { icon: Settings, label: "Settings", href: "/rider/settings" },
]

export function RiderSidebar() {
    const pathname = usePathname()
    const { isSidebarCollapsed, toggleSidebar, isMobileMenuOpen, setMobileMenuOpen } = useDashboardLayout()
    const [availableCount, setAvailableCount] = useState(0)
    const [isLoggingOut, setIsLoggingOut] = useState(false)
    const [supabase] = useState(() => createClient())

    const handleLogout = async () => {
        if (isLoggingOut) {
            return
        }

        setMobileMenuOpen(false)
        setIsLoggingOut(true)
        const didLogout = await performLogout(supabase)

        if (!didLogout) {
            setIsLoggingOut(false)
        }
    }

    useEffect(() => {
        const fetchCount = async () => {
            const { count } = await supabase
                .from('orders')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'ready_for_pickup')
                .is('rider_id', null)

            setAvailableCount(count || 0)
        }

        fetchCount()

        const channel = supabase
            .channel('rider-sidebar-badge')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'orders' },
                () => { fetchCount() }
            )
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [supabase])

    return (
        <>
            {/* Mobile Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
                    onClick={() => setMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar */}
            <div className={cn(
                "fixed lg:sticky top-0 left-0 h-screen bg-white dark:bg-zinc-900 border-r border-gray-100 dark:border-zinc-800 flex flex-col transition-all duration-300 z-50",
                isSidebarCollapsed ? "w-20" : "w-64",
                isMobileMenuOpen ? "translate-x-0 w-64 shadow-2xl" : "-translate-x-full lg:translate-x-0"
            )}>
                {/* Header Area */}
                <div className={cn("p-6 flex items-center", isSidebarCollapsed ? "justify-center px-2" : "justify-between")}>
                    {!isSidebarCollapsed && (
                        <Link href="/" className="flex items-center gap-2">
                            <div className="bg-[#F58220] p-1.5 rounded-lg shrink-0">
                                <span className="text-white font-bold text-lg">RSS</span>
                            </div>
                            <span className="text-[#191970] dark:text-white font-bold text-xl">FOODS</span>
                        </Link>
                    )}
                    {isSidebarCollapsed && (
                        <Link href="/" className="bg-[#F58220] p-2 rounded-lg shrink-0">
                            <span className="text-white font-bold text-sm">RSS</span>
                        </Link>
                    )}

                    {/* Mobile Close Button */}
                    <Button variant="ghost" size="icon" className="lg:hidden -mr-2" onClick={() => setMobileMenuOpen(false)}>
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-4 space-y-2 py-4">
                    {menuItems.map((item) => {
                        const isActive = pathname === item.href
                        // Logic for badge
                        const showBadge = (item.label === "Deliveries" && availableCount > 0) || item.badge
                        const badgeCount = item.label === "Deliveries" ? availableCount : null

                        return (
                            <Link key={item.href} href={item.href} title={isSidebarCollapsed ? item.label : ""}>
                                <Button
                                    variant="ghost"
                                    className={cn(
                                        "w-full justify-start h-12 text-base font-medium transition-all duration-200",
                                        isSidebarCollapsed ? "px-0 justify-center" : "gap-3 px-4",
                                        isActive
                                            ? "bg-[#F58220] text-white hover:bg-[#E57210]"
                                            : "text-gray-500 hover:text-[#F58220] hover:bg-orange-50 dark:hover:bg-zinc-800"
                                    )}
                                >
                                    <item.icon className={cn("h-5 w-5", isSidebarCollapsed ? "" : "shrink-0")} />
                                    {!isSidebarCollapsed && (
                                        <>
                                            <span className="truncate">{item.label}</span>
                                            {showBadge && (
                                                <div className="ml-auto flex items-center">
                                                    {badgeCount ? (
                                                        <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                                                            {badgeCount}
                                                        </span>
                                                    ) : (
                                                        <span className="bg-red-500 text-white text-[10px] h-2 w-2 rounded-full animate-pulse shrink-0" />
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    )}
                                    {isSidebarCollapsed && showBadge && (
                                        <span className="absolute top-3 right-3 bg-red-500 text-white text-[10px] h-2 w-2 rounded-full animate-pulse" />
                                    )}
                                </Button>
                            </Link>
                        )
                    })}
                </nav>

                {/* Footer / Logout / Collapse Toggle */}
                <div className="p-4 border-t border-gray-100 dark:border-zinc-800 space-y-2">
                    <Button
                        variant="ghost"
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className={cn(
                            "w-full justify-start text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10",
                            isSidebarCollapsed ? "justify-center px-0" : "gap-3"
                        )}
                    >
                        <LogOut className="h-5 w-5" />
                        {!isSidebarCollapsed && (isLoggingOut ? "Signing Out..." : "Logout")}
                    </Button>

                    {/* Desktop Collapse Toggle */}
                    <div className="hidden lg:flex justify-end pt-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={toggleSidebar}
                            className="w-full h-8 bg-gray-50 dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-400"
                        >
                            {isSidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                        </Button>
                    </div>
                </div>
            </div>
        </>
    )
}
