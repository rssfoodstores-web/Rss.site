"use client"

import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area } from "recharts"

const data = [
    { name: "Mon", value: 10 },
    { name: "Tue", value: 5 },
    { name: "Wed", value: 28 },
    { name: "Thu", value: 12 },
    { name: "Fri", value: 18 },
    { name: "Sat", value: 50 },
    { name: "Sun", value: 15 },
]

export function PerformanceChart() {
    return (
        <div className="bg-white dark:bg-zinc-900 p-6 lg:p-8 rounded-[24px] border border-gray-100 dark:border-zinc-800 shadow-sm h-full">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                    <h3 className="text-lg font-bold text-[#1A1A1A] dark:text-white mb-1">Performance Overview</h3>
                    <p className="text-sm text-gray-500">This Month <span className="font-bold text-[#1A1A1A] dark:text-white">₦10,000</span></p>
                </div>
                <select className="bg-gray-50 dark:bg-zinc-800 border-none text-sm font-medium rounded-lg px-3 py-2 outline-none w-full sm:w-auto">
                    <option>Last 7 Days</option>
                    <option>Last 30 Days</option>
                </select>
            </div>

            <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data}>
                        <defs>
                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#F58220" stopOpacity={0.1} />
                                <stop offset="95%" stopColor="#F58220" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#9ca3af', fontSize: 12 }}
                            dy={10}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#fff',
                                borderRadius: '12px',
                                border: 'none',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                            }}
                            cursor={{ stroke: '#F58220', strokeWidth: 1, strokeDasharray: '4 4' }}
                        />
                        <Line
                            type="monotone"
                            dataKey="value"
                            stroke="#F58220"
                            strokeWidth={3}
                            dot={false}
                            activeDot={{ r: 6, fill: "#F58220", stroke: "#fff", strokeWidth: 2 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}
