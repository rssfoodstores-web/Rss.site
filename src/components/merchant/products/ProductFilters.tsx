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
        <div className="mb-5 min-w-0 max-w-full sm:mb-8">
            <div className="max-w-full overflow-x-auto overscroll-x-contain rounded-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div role="group" aria-label="Filter products" className="flex w-max min-w-full items-center gap-1 rounded-2xl bg-[#F58220] p-1.5">
                {statuses.map((status) => (
                    <button
                        key={status}
                        type="button"
                        onClick={() => setActiveTab(status)}
                        aria-pressed={activeTab === status}
                        className={cn(
                            "shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold whitespace-nowrap transition-all duration-300 sm:px-6",
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
        </div>
    )
}
