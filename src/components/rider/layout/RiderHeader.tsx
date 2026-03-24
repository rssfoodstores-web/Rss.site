"use client"

import { Bell, Search, Menu } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useDashboardLayout } from "@/contexts/DashboardLayoutContext"

export function RiderHeader({ user }: { user?: any }) {
    const { toggleMobileMenu } = useDashboardLayout()

    return (
        <header className="bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800 px-4 md:px-8 py-4 flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center gap-4">
                <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden text-gray-500"
                    onClick={toggleMobileMenu}
                >
                    <Menu className="h-6 w-6" />
                </Button>
                <h1 className="text-xl font-bold text-[#191970] dark:text-white hidden md:block">Dashboard</h1>
                {/* Mobile Title */}
                <h1 className="text-lg font-bold text-[#191970] dark:text-white md:hidden">RSS Dashboard</h1>
            </div>

            <div className="flex items-center gap-3 lg:gap-6">
                <div className="relative hidden md:block w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="Search data, users, or reports"
                        className="pl-10 bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 rounded-full h-10 focus-visible:ring-[#F58220]"
                    />
                </div>

                <div className="flex items-center gap-2 md:gap-3">
                    <Button variant="ghost" size="icon" className="relative text-gray-500 hover:text-[#F58220]">
                        <Bell className="h-5 w-5" />
                        <span className="absolute top-2 right-2 h-2 w-2 bg-red-500 rounded-full border-2 border-white dark:border-zinc-900"></span>
                    </Button>

                    <div className="h-8 w-[1px] bg-gray-200 dark:bg-zinc-700 mx-1 hidden md:block"></div>

                    <div className="flex items-center gap-3 pl-1">
                        <Avatar className="h-8 w-8 md:h-9 md:w-9 border-2 border-white shadow-sm ring-1 ring-gray-100">
                            <AvatarImage src={user?.user_metadata?.avatar_url || "/images/avatars/rider-default.png"} />
                            <AvatarFallback>RD</AvatarFallback>
                        </Avatar>
                        <div className="hidden md:block text-sm">
                            <p className="font-bold text-gray-900 dark:text-white leading-none mb-1">
                                {user?.user_metadata?.full_name || user?.email?.split('@')[0] || "Rider"}
                            </p>
                            <p className="text-xs text-gray-500">Rider</p>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    )
}
