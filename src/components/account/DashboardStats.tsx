import { ShoppingBag, RefreshCcw, CheckCircle, Package } from "lucide-react"

interface DashboardStatsProps {
    totalOrders: number
    pendingOrders: number
    completedOrders: number
    processingOrders: number
}

export function DashboardStats({ totalOrders, pendingOrders, completedOrders, processingOrders }: DashboardStatsProps) {
    const stats = [
        { label: "Total Orders", value: totalOrders.toString(), icon: ShoppingBag },
        { label: "Pending Orders", value: pendingOrders.toString(), icon: RefreshCcw },
        { label: "Completed", value: completedOrders.toString(), icon: CheckCircle },
        { label: "Processing", value: processingOrders.toString(), icon: Package },
    ]

    return (
        <div className="mb-6 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 sm:gap-4 lg:mb-8 lg:grid-cols-4 lg:gap-6">
            {stats.map((stat) => (
                <div
                    key={stat.label}
                    className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 sm:items-center sm:gap-4 sm:p-5 lg:p-6"
                >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F58220]/10 text-[#F58220] sm:h-12 sm:w-12">
                        <stat.icon className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">{stat.value}</h3>
                        <p className="text-sm font-medium leading-tight text-gray-500 dark:text-gray-400">{stat.label}</p>
                    </div>
                </div>
            ))}
        </div>
    )
}
