"use client"

import { cn } from "@/lib/utils"
// We'll use simple SVGs for the mini-charts to match the design without heavy recharts overhead for these small ones if possible, 
// or just use recharts TinyLineChart if installed. Since I installed recharts, I'll use it.
import { LineChart, Line, ResponsiveContainer } from "recharts"

interface StatsWidgetProps {
    title: string
    value: string
    trend: string
    isPositive: boolean
    data: number[] // simple array for the curve
    color: string
}

export function StatsWidget({ title, value, trend, isPositive, data, color }: StatsWidgetProps) {
    const chartData = data.map((val, i) => ({ i, val }))

    return (
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-[20px] border border-gray-100 dark:border-zinc-800 shadow-sm flex flex-col justify-between h-[160px]">
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1">{title}</h3>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
                </div>
                <span className={cn(
                    "text-xs font-bold px-2 py-1 rounded-full",
                    isPositive ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                )}>
                    {isPositive ? "+" : ""}{trend}
                </span>
            </div>

            <div className="h-12 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                        <Line
                            type="monotone"
                            dataKey="val"
                            stroke={color}
                            strokeWidth={3}
                            dot={false}
                            isAnimationActive={true}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}
