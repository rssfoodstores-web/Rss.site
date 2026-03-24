"use client"

import { ArrowUp, ArrowDown, Package, CheckCircle, Clock, Wallet } from "lucide-react"

const stats = [
    {
        title: "Total Submission",
        value: "30",
        change: "- 25%",
        trend: "down",
        icon: Package,
        chartColor: "red" // Simulate sparkline color
    },
    {
        title: "Approved Products",
        value: "10",
        change: "+ 49%",
        trend: "up",
        icon: CheckCircle,
        chartColor: "green"
    },
    {
        title: "Pending",
        value: "20",
        change: "+ 1.9%",
        trend: "up",
        icon: Clock,
        chartColor: "orange"
    },
    {
        title: "Total Earning",
        value: "₦10,000",
        change: "+ 22%",
        trend: "up",
        icon: Wallet,
        chartColor: "green"
    }
]

export function StatsCards() {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
            {stats.map((stat, i) => (
                <div key={i} className="bg-white dark:bg-zinc-900 p-5 md:p-6 rounded-[20px] md:rounded-[24px] border border-gray-100 dark:border-zinc-800 shadow-sm relative overflow-hidden">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-gray-500 text-sm font-medium mb-1">{stat.title}</p>
                            <h3 className="text-3xl font-bold text-[#1A1A1A] dark:text-white">{stat.value}</h3>
                        </div>
                        <div className={`flex items-center gap-1 text-sm font-bold ${stat.trend === "up" ? "text-green-500" : "text-red-500"}`}>
                            {stat.trend === "up" ? "+" : ""} {stat.change}
                        </div>
                    </div>

                    {/* Simulated Sparkline (using SVG for simplicity or could be Recharts) */}
                    <div className="h-12 w-full mt-2">
                        <svg viewBox="0 0 100 25" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                            <path
                                d={stat.trend === "up"
                                    ? "M0 25 Q 25 25, 50 15 T 100 5 V 25 H 0"
                                    : "M0 25 Q 25 5, 50 15 T 100 20 V 25 H 0"
                                }
                                fill={`url(#gradient-${i})`}
                                stroke="none"
                                opacity="0.1"
                            />
                            <path
                                d={stat.trend === "up"
                                    ? "M0 25 Q 25 25, 50 15 T 100 5"
                                    : "M0 25 Q 25 5, 50 15 T 100 20"
                                }
                                fill="none"
                                stroke={stat.chartColor === "green" ? "#22c55e" : stat.chartColor === "red" ? "#ef4444" : "#f97316"}
                                strokeWidth="3"
                                strokeLinecap="round"
                            />
                            <defs>
                                <linearGradient id={`gradient-${i}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={stat.chartColor === "green" ? "#22c55e" : stat.chartColor === "red" ? "#ef4444" : "#f97316"} stopOpacity="0.5" />
                                    <stop offset="100%" stopColor={stat.chartColor === "green" ? "#22c55e" : stat.chartColor === "red" ? "#ef4444" : "#f97316"} stopOpacity="0" />
                                </linearGradient>
                            </defs>
                        </svg>
                    </div>
                </div>
            ))}
        </div>
    )
}
