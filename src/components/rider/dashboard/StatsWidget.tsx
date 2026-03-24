"use client"

import { ArrowUp, ArrowDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface StatsCardProps {
    title: string
    value: string
    trend?: {
        value: string
        direction: "up" | "down"
        label: string
    }
    subtitle?: string
}

function StatCard({ title, value, trend, subtitle }: StatsCardProps) {
    return (
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm flex flex-col justify-between h-full">
            <h3 className="text-gray-500 text-sm font-medium mb-2">{title}</h3>
            <div>
                <div className="flex items-end gap-2 mb-1">
                    <span className="text-2xl font-bold text-gray-900 dark:text-white leading-none">{value}</span>
                    {trend && (
                        <div className={cn(
                            "flex items-center text-xs font-bold px-1.5 py-0.5 rounded-full mb-0.5",
                            trend.direction === "up" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                        )}>
                            {trend.direction === "up" ? <ArrowUp className="h-3 w-3 mr-0.5" /> : <ArrowDown className="h-3 w-3 mr-0.5" />}
                            {trend.value}
                        </div>
                    )}
                </div>
                {(trend?.label || subtitle) && (
                    <p className="text-xs text-gray-400">
                        {subtitle || trend?.label}
                    </p>
                )}
            </div>
        </div>
    )
}

export function StatsWidget() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <StatCard
                title="Today's Earnings"
                value="₦5,000,000"
                trend={{ value: "24%", direction: "up", label: "from yesterday" }}
            />
            <StatCard
                title="Week Total"
                value="₦9,000,000"
                trend={{ value: "14.4%", direction: "up", label: "" }}
                subtitle="42 deliveries"
            />
            <StatCard
                title="Pending"
                value="2"
                subtitle="Awaiting pickup"
            />
            <StatCard
                title="Completed"
                value="5"
                subtitle="Today's total"
            />
        </div>
    )
}
