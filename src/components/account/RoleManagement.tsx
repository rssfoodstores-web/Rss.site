"use client"

import { Button } from "@/components/ui/button"
import { Store, Users, Bike, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"

type AppRole = "customer" | "merchant" | "rider" | "admin" | "agent" | "supa_admin" | "sub_admin"

interface RoleManagementProps {
    currentRoles: AppRole[]
}

export function RoleManagement({ currentRoles }: RoleManagementProps) {
    const availableRoles: { role: AppRole; label: string; icon: LucideIcon; desc: string }[] = [
        { role: "merchant", label: "Become a Merchant", icon: Store, desc: "Sell your products on RSS Foods." },
        { role: "agent", label: "Become an Agent", icon: Users, desc: "Earn commissions by referring customers." },
        { role: "rider", label: "Become a Rider", icon: Bike, desc: "Deliver orders and earn money." },
    ]

    const dashboardPathByRole: Partial<Record<AppRole, string>> = {
        merchant: "/merchant",
        agent: "/agent",
        rider: "/rider",
    }

    const joinPathByRole: Partial<Record<AppRole, string>> = {
        merchant: "/register/merchant",
        agent: "/join/agent/register",
        rider: "/join/rider/register",
    }

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden shadow-sm col-span-1 md:col-span-2 lg:col-span-3">
            <div className="border-b border-gray-100 p-4 dark:border-zinc-800 sm:p-6">
                <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                    Expand Your Horizons
                </h3>
            </div>
            <div className="grid grid-cols-1 gap-4 p-4 sm:gap-6 sm:p-6 lg:grid-cols-3">
                {availableRoles.map((item) => {
                    const isJoined = currentRoles.includes(item.role)
                    return (
                        <div key={item.role} className={cn(
                            "flex h-full flex-col rounded-xl border p-4 transition-all",
                            isJoined ? "bg-[#F58220]/5 border-[#F58220]/20" : "bg-gray-50 dark:bg-zinc-800 border-transparent hover:border-gray-200"
                        )}>
                            <div className="mb-3 flex items-start gap-3">
                                <div className={cn("p-2 rounded-full", isJoined ? "bg-[#F58220]/10 text-[#F58220]" : "bg-white dark:bg-zinc-700 text-gray-500")}>
                                    <item.icon className="h-5 w-5" />
                                </div>
                                <h4 className="font-bold text-gray-900 dark:text-white">{item.label}</h4>
                            </div>
                            <p className="mb-4 text-sm text-gray-500">{item.desc}</p>

                            <div className="mt-auto">
                            {isJoined ? (
                                dashboardPathByRole[item.role] ? (
                                    <Link href={dashboardPathByRole[item.role]!} className="w-full block">
                                        <Button className="w-full bg-[#F58220] hover:bg-[#E57210] text-white border-transparent">
                                            Open {item.role.charAt(0).toUpperCase() + item.role.slice(1)} Pages
                                        </Button>
                                    </Link>
                                ) : (
                                    <Button disabled className="w-full bg-green-500/10 text-green-600 hover:bg-green-500/10 border border-green-200">
                                        Active
                                    </Button>
                                )
                            ) : (
                                <Link href={joinPathByRole[item.role] ?? "#"} className="w-full block">
                                    <Button
                                        className="w-full bg-white dark:bg-zinc-700 border border-gray-200 dark:border-zinc-600 hover:bg-gray-50 text-gray-900 dark:text-white"
                                    >
                                        Join {item.role.charAt(0).toUpperCase() + item.role.slice(1)}
                                    </Button>
                                </Link>
                            )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
