"use client"

import { useState, useEffect } from "react"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    LayoutGrid,
    ShoppingBag,
    ShoppingCart,
    ClipboardList,
    Coins,
    Settings,
    LogOut,
    ChevronLeft,
    MapPin
} from "lucide-react"
import { cn } from "@/lib/utils"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"
import { performLogout } from "@/lib/auth/performLogout"

const navItems = [
    { label: "Dashboard", href: "/merchant", icon: LayoutGrid },
    { label: "Products", href: "/merchant/products", icon: ShoppingBag },
    { label: "Order", href: "/merchant/orders", icon: ShoppingCart },
    { label: "Transactions", href: "/merchant/transactions", icon: ClipboardList },
    { label: "Refer & Earn", href: "/account/referrals", icon: Coins },
    { label: "Location", href: "/merchant/verify-location", icon: MapPin },
    { label: "Settings", href: "/merchant/settings", icon: Settings },
]

export function MerchantSidebar({
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
    const [supabase] = useState(() => createClient())
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

    const [activeOrderCount, setActiveOrderCount] = useState(0)
    const [merchantId, setMerchantId] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false

        const initMerchant = async () => {
            const { data: { user } } = await supabase.auth.getUser()

            if (!cancelled) {
                setMerchantId(user?.id ?? null)
            }
        }

        void initMerchant()

        return () => {
            cancelled = true
        }
    }, [supabase])

    useEffect(() => {
        if (!merchantId) {
            return
        }

        const fetchCount = async () => {
            const { count } = await supabase
                .from("orders")
                .select("*", { count: "exact", head: true })
                .eq("merchant_id", merchantId)
                .in("status", ["awaiting_merchant_confirmation", "processing", "ready_for_pickup", "out_for_delivery"])

            setActiveOrderCount(count || 0)
        }

        void fetchCount()

        const channel = supabase
            .channel(`merchant-sidebar-badge-${merchantId}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "orders",
                    filter: `merchant_id=eq.${merchantId}`,
                },
                () => {
                    void fetchCount()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [merchantId, supabase])

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
                            <ShoppingBag className="h-6 w-6 text-white" />
                        </div>
                    ) : (
                        <div className="flex items-center gap-3">
                            <Image
                                src="/logo.png"
                                alt="RSS Foods"
                                width={160}
                                height={50}
                                className="h-auto w-auto dark:invert"
                                priority
                            />
                        </div>
                    )}
                </Link>
            </div>

            {/* Navigation Section */}
            <nav className={cn("flex-1 space-y-1.5", isCollapsed ? "w-full px-3" : "")}>
                {navItems.map((item) => {
                    const isActive = pathname === item.href
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
                            {!isCollapsed && (
                                <div className="flex-1 flex items-center justify-between">
                                    <span className="font-semibold text-[15px]">{item.label}</span>
                                    {item.label === "Order" && activeOrderCount > 0 && (
                                        <span className="bg-[#F58220] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                            {activeOrderCount}
                                        </span>
                                    )}
                                </div>
                            )}
                            {isCollapsed && item.label === "Order" && activeOrderCount > 0 && (
                                <span className="absolute top-2 right-2 bg-[#F58220] h-2 w-2 rounded-full border border-white dark:border-zinc-900" />
                            )}
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
