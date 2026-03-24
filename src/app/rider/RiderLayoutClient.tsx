"use client"

import { DashboardLayoutProvider } from "@/contexts/DashboardLayoutContext"

export function RiderLayoutClient({ children }: { children: React.ReactNode }) {
    return (
        <DashboardLayoutProvider>
            {children}
        </DashboardLayoutProvider>
    )
}
