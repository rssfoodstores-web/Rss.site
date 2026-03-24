"use client"

import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from "recharts"
import { formatKobo } from "@/lib/money"

interface RevenuePoint {
    name: string
    revenue: number
}

export function RevenueChart({ totalRevenue, data }: { totalRevenue: number; data: RevenuePoint[] }) {
    return (
        <div className="bg-white dark:bg-zinc-900 p-6 lg:p-8 rounded-[24px] border border-gray-100 dark:border-zinc-800 shadow-sm">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">Gross Sales</h3>
                    <div className="flex items-baseline gap-4">
                        <h2 className="text-3xl font-extrabold text-[#1A1A1A] dark:text-white">
                            {formatKobo(totalRevenue)}
                        </h2>
                    </div>
                </div>
                <div className="flex gap-6">
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-[#F58220]"></span>
                        <span className="text-sm font-medium text-gray-500">Gross sales</span>
                    </div>
                </div>
            </div>

            <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} barGap={8}>
                        <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: "#8E8E93", fontSize: 12 }}
                            dy={10}
                        />
                        <Tooltip formatter={(value: number | undefined) => formatKobo(value ?? 0)} />
                        <Bar dataKey="revenue" fill="#F58220" radius={[4, 4, 4, 4]} barSize={20} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}
