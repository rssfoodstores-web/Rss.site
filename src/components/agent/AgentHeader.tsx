"use client"

import { Bell, AlignLeft, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { AgentSidebar } from "./AgentSidebar"
import { useState } from "react"
import Link from "next/link"
import { useUser } from "@/context/UserContext"
import { usePathname } from "next/navigation"

const PAGE_COPY: Record<string, { title: string; description: string; href?: string; cta?: string }> = {
    "/agent": {
        title: "Agent overview",
        description: "See your live queue, pricing workload, and the orders that need intervention first.",
        href: "/agent/orders",
        cta: "Open orders",
    },
    "/agent/orders": {
        title: "Orders",
        description: "Monitor active handoffs, accept assignments, and keep rider dispatch moving.",
        href: "/agent/history",
        cta: "View history",
    },
    "/agent/messages": {
        title: "Order messages",
        description: "Keep every customer, merchant, and rider conversation attached to the correct order.",
        href: "/agent/orders",
        cta: "Open orders",
    },
    "/agent/pricing": {
        title: "Pricing queue",
        description: "Submit market survey inputs for products waiting on final pricing approval.",
    },
    "/agent/history": {
        title: "Order history",
        description: "Review completed, refunded, disputed, and cancelled assignments from one place.",
    },
}

export function AgentHeader() {
    const [isOpen, setIsOpen] = useState(false)
    const { user, profile, unreadCount } = useUser()
    const pathname = usePathname()
    const pageCopy = PAGE_COPY[pathname] ?? PAGE_COPY["/agent"]

    return (
        <header className="h-20 bg-white dark:bg-zinc-950 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between px-6 lg:px-10 sticky top-0 z-20">
            <div className="flex items-center gap-4">
                {/* Mobile Menu Trigger */}
                <div className="lg:hidden">
                    <Sheet open={isOpen} onOpenChange={setIsOpen}>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <AlignLeft className="h-7 w-7" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="left" className="p-0 border-r-0 w-80">
                            <SheetTitle className="sr-only">Agent navigation menu</SheetTitle>
                            <AgentSidebar mobile onNavigate={() => setIsOpen(false)} />
                        </SheetContent>
                    </Sheet>
                </div>

                <div className="hidden md:block">
                    <h1 className="text-2xl font-extrabold text-[#1A1A1A] dark:text-white">{pageCopy.title}</h1>
                    <p className="text-sm text-gray-500">{pageCopy.description}</p>
                </div>
            </div>

            <div className="flex items-center gap-4 lg:gap-6">
                {pageCopy.href && pageCopy.cta ? (
                    <Button asChild variant="outline" className="hidden rounded-xl border-orange-200 text-[#F58220] hover:bg-orange-50 md:inline-flex">
                        <Link href={pageCopy.href}>
                            {pageCopy.cta}
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                ) : null}

                <Link href="/account/notifications">
                    <Button variant="ghost" size="icon" className="relative rounded-xl hover:bg-gray-50 dark:hover:bg-zinc-900">
                        <Bell className="h-6 w-6 text-[#1A1A1A] dark:text-white" />
                        {unreadCount > 0 && (
                            <span className="absolute top-2 right-2 h-4 w-4 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full border-2 border-white dark:border-zinc-950 font-bold">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </Button>
                </Link>

                <div className="flex items-center gap-3 pl-4 border-l border-gray-100 dark:border-zinc-800">
                    <Avatar className="h-10 w-10 border-2 border-white dark:border-zinc-800 shadow-sm">
                        <AvatarImage src={profile?.avatar_url ?? undefined} />
                        <AvatarFallback className="bg-[#F58220] text-white font-bold">
                            {user?.email?.[0]?.toUpperCase() || "A"}
                        </AvatarFallback>
                    </Avatar>
                    <div className="hidden lg:block">
                        <p className="text-sm font-bold text-[#1A1A1A] dark:text-white leading-none mb-1">
                            {profile?.full_name || (typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "Agent User")}
                        </p>
                        <p className="text-xs text-[#8E8E93] font-medium">Agent</p>
                    </div>
                </div>
            </div>
        </header>
    )
}
