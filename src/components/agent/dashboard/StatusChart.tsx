"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"

const data = [
    { name: "Approved", value: 98, color: "#10B981" }, // Green
    { name: "Pending", value: 28, color: "#F59E0B" },  // Yellow/Orange
    { name: "Rejected", value: 16, color: "#EF4444" }, // Red
]

export function StatusChart() {
    return (
        <div className="bg-white dark:bg-zinc-900 p-6 lg:p-8 rounded-[24px] border border-gray-100 dark:border-zinc-800 shadow-sm h-full flex flex-col">
            <h3 className="text-lg font-bold text-[#1A1A1A] dark:text-white mb-6">Status Breakdown</h3>

            <div className="flex-1 flex items-center justify-center relative">
                <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={0}
                                dataKey="value"
                            >
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                                ))}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                    {/* Center Text */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span className="text-2xl font-extrabold text-[#1A1A1A] dark:text-white">64%</span>
                    </div>
                </div>
            </div>

            <div className="mt-6 space-y-3">
                {data.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                            <span className="text-gray-500 font-medium">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="font-bold text-[#1A1A1A] dark:text-white">{item.value}</span>
                            <span className="text-gray-400 text-xs">{Math.round((item.value / 142) * 100)}%</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
