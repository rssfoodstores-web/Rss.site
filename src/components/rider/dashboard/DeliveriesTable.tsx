"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

const deliveries = [
    {
        id: "#ORD-123",
        customer: "Mfoniso Ibokette",
        pickup: "15 Allen Ave, Ikeja",
        dropoff: "24 Admiralty Way",
        items: 3,
        status: "Pending",
        distance: "12.3KM",
        amount: "₦20,000"
    },
    {
        id: "#ORD-124",
        customer: "Mfoniso Ibokette",
        pickup: "15 Allen Ave, Ikeja",
        dropoff: "24 Admiralty Way",
        items: 4,
        status: "Pending",
        distance: "12.3KM",
        amount: "₦20,000"
    },
    {
        id: "#ORD-125",
        customer: "Mfoniso Ibokette",
        pickup: "15 Allen Ave, Ikeja",
        dropoff: "24 Admiralty Way",
        items: 1,
        status: "Completed",
        distance: "12.3KM",
        amount: "₦20,000"
    },
    {
        id: "#ORD-128",
        customer: "Mfoniso Ibokette",
        pickup: "15 Allen Ave, Ikeja",
        dropoff: "24 Admiralty Way",
        items: 5,
        status: "Completed",
        distance: "12.3KM",
        amount: "₦20,000"
    },
]

export function DeliveriesTable() {
    const [filter, setFilter] = useState("All")

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-3">
                <h3 className="text-xl font-bold text-[#191970] dark:text-white">Assigned Deliveries</h3>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {["All", "In Progress", "Completed"].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setFilter(tab)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${filter === tab
                            ? "bg-[#F58220] text-white"
                            : "bg-gray-100 dark:bg-zinc-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-zinc-700"
                            }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                <div className="space-y-3 p-4 md:hidden">
                    {deliveries.map((order) => (
                        <div key={order.id} className="rounded-2xl border border-gray-100 p-4 dark:border-zinc-800">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Order ID</p>
                                    <p className="mt-1 font-semibold text-gray-900 dark:text-white">{order.id}</p>
                                </div>
                                <Badge
                                    variant="secondary"
                                    className={`font-medium ${order.status === "Completed"
                                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100"
                                        : "bg-[#FFF8E6] text-[#B88700] dark:bg-yellow-900/20 dark:text-yellow-400 hover:bg-[#FFF8E6]"
                                        }`}
                                >
                                    {order.status}
                                </Badge>
                            </div>
                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Customer</p>
                                    <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{order.customer}</p>
                                </div>
                                <div>
                                    <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Items</p>
                                    <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{order.items}</p>
                                </div>
                                <div>
                                    <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Pickup</p>
                                    <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{order.pickup}</p>
                                </div>
                                <div>
                                    <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Drop-off</p>
                                    <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{order.dropoff}</p>
                                </div>
                                <div>
                                    <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Distance</p>
                                    <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{order.distance}</p>
                                </div>
                                <div>
                                    <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Amount</p>
                                    <p className="mt-1 text-sm font-bold text-gray-900 dark:text-white">{order.amount}</p>
                                </div>
                            </div>
                            <Button size="sm" className="mt-4 h-9 w-full bg-[#F58220] text-white hover:bg-[#E57210]">
                                View Details
                            </Button>
                        </div>
                    ))}
                </div>
                <div className="hidden overflow-x-auto md:block">
                    <table className="w-full">
                        <thead className="bg-gray-50/50 dark:bg-zinc-800/50">
                            <tr>
                                <th className="text-left py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Order ID</th>
                                <th className="text-left py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer&apos;s Name</th>
                                <th className="text-left py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">PickUp</th>
                                <th className="text-left py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Drop-Off</th>
                                <th className="text-left py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">No. Items</th>
                                <th className="text-left py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Delivery Status</th>
                                <th className="text-left py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Distance</th>
                                <th className="text-left py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                                <th className="text-left py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                            {deliveries.map((order) => (
                                <tr key={order.id} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/50 transition-colors">
                                    <td className="py-4 px-6 text-sm font-medium text-gray-900 dark:text-white">{order.id}</td>
                                    <td className="py-4 px-6 text-sm text-gray-600 dark:text-gray-300">{order.customer}</td>
                                    <td className="py-4 px-6 text-sm text-gray-600 dark:text-gray-300 max-w-[150px] truncate">{order.pickup}</td>
                                    <td className="py-4 px-6 text-sm text-gray-600 dark:text-gray-300 max-w-[150px] truncate">{order.dropoff}</td>
                                    <td className="py-4 px-6 text-sm text-gray-600 dark:text-gray-300">{order.items}</td>
                                    <td className="py-4 px-6">
                                        <Badge
                                            variant="secondary"
                                            className={`font-medium ${order.status === "Completed"
                                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100"
                                                : "bg-[#FFF8E6] text-[#B88700] dark:bg-yellow-900/20 dark:text-yellow-400 hover:bg-[#FFF8E6]"
                                                }`}
                                        >
                                            {order.status}
                                        </Badge>
                                    </td>
                                    <td className="py-4 px-6 text-sm text-gray-600 dark:text-gray-300">{order.distance}</td>
                                    <td className="py-4 px-6 text-sm font-bold text-gray-900 dark:text-white">{order.amount}</td>
                                    <td className="py-4 px-6">
                                        <Button size="sm" className="bg-[#F58220] hover:bg-[#E57210] text-white font-bold h-8 text-xs">
                                            View Details
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
