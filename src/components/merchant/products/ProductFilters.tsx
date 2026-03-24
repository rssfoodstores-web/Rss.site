"use client"

import { cn } from "@/lib/utils"

const statuses = ["All Products", "Pending", "Approved", "Rejected"]

export function ProductFilters({
    activeTab,
    setActiveTab,
    counts
}: {
    activeTab: string,
    setActiveTab: (tab: string) => void,
    counts: Record<string, number>
}) {
    return (
        <div className="mb-8">
            <div className="bg-[#F58220] p-1.5 rounded-2xl flex items-center gap-1">
                {statuses.map((status) => (
                    <button
                        key={status}
                        onClick={() => setActiveTab(status)}
                        className={cn(
                            "px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 whitespace-nowrap",
                            activeTab === status
                                ? "bg-white text-[#F58220] shadow-sm"
                                : "text-white hover:bg-white/10"
                        )}
                    >
                        {status} {counts[status.toLowerCase().replace(' ', '_')] !== undefined && (
                            <span className={cn(
                                "ml-2 text-[10px] opacity-60",
                                activeTab === status ? "text-[#F58220]" : "text-white"
                            )}>
                                {counts[status.toLowerCase().replace(' ', '_')]}
                            </span>
                        )}
                        {status === "All Products" && counts["all"] !== undefined && (
                            <span className={cn(
                                "ml-2 text-[10px] opacity-60",
                                activeTab === status ? "text-[#F58220]" : "text-white"
                            )}>
                                {counts["all"]}
                            </span>
                        )}
                    </button>
                ))}
            </div>
        </div>
    )
}
