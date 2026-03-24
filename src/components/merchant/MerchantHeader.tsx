"use client"

import { Search, Bell, AlignLeft } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { MerchantSidebar } from "./MerchantSidebar"
import { useState } from "react"
import Link from "next/link"
import { useUser } from "@/context/UserContext"

export function MerchantHeader() {
    const [isOpen, setIsOpen] = useState(false)
    const { user, profile, unreadCount } = useUser()

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
                            <SheetTitle className="sr-only">Merchant navigation menu</SheetTitle>
                            <MerchantSidebar mobile onNavigate={() => setIsOpen(false)} />
                        </SheetContent>
                    </Sheet>
                </div>

                <h1 className="text-2xl font-extrabold text-[#1A1A1A] dark:text-white hidden md:block">Dashboard</h1>
            </div>

            {/* Search Bar */}
            <div className="flex-1 max-w-xl mx-4 lg:mx-12 hidden md:block">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <Input
                        placeholder="Search data, users, or reports"
                        className="h-12 pl-12 rounded-2xl bg-gray-50 dark:bg-zinc-900 border-none focus-visible:ring-1 focus-visible:ring-[#F58220] text-base"
                    />
                </div>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-4 lg:gap-6">
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
                            {user?.email?.[0].toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <div className="hidden lg:block">
                        <p className="text-sm font-bold text-[#1A1A1A] dark:text-white leading-none mb-1">
                            {profile?.full_name || user?.user_metadata?.full_name || "Merchant User"}
                        </p>
                        <p className="text-xs text-[#8E8E93] font-medium">Merchant</p>
                    </div>
                </div>
            </div>
        </header>
    )
}
