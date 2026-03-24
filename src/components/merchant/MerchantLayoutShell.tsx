"use client"

import { useState } from "react"
import { MerchantSidebar } from "@/components/merchant/MerchantSidebar"
import { MerchantHeader } from "@/components/merchant/MerchantHeader"
import { cn } from "@/lib/utils"

export function MerchantLayoutShell({
    children,
}: {
    children: React.ReactNode
}) {
    const [isCollapsed, setIsCollapsed] = useState(false)

    return (
        <div className="flex min-h-screen bg-[#FDFDFD] dark:bg-black">
            <MerchantSidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />

            <main
                className={cn(
                    "relative flex h-screen flex-1 flex-col overflow-hidden transition-all duration-300",
                    isCollapsed ? "lg:pl-0" : ""
                )}
            >
                <MerchantHeader />
                <div className="flex-1 overflow-y-auto bg-[#FAFAFA] p-4 dark:bg-black lg:p-8">
                    <div className="mx-auto w-full max-w-[1600px]">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    )
}
