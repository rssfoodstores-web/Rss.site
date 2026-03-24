"use client"

import React, { createContext, useContext, useState, useEffect } from "react"

interface DashboardLayoutContextType {
    isSidebarCollapsed: boolean
    setSidebarCollapsed: (value: boolean) => void
    isMobileMenuOpen: boolean
    setMobileMenuOpen: (value: boolean) => void
    toggleSidebar: () => void
    toggleMobileMenu: () => void
}

const DashboardLayoutContext = createContext<DashboardLayoutContextType | undefined>(undefined)

export function DashboardLayoutProvider({ children }: { children: React.ReactNode }) {
    const [isSidebarCollapsed, setSidebarCollapsed] = useState(false)
    const [isMobileMenuOpen, setMobileMenuOpen] = useState(false)

    // Close mobile menu on resize if screen becomes large
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 1024) {
                setMobileMenuOpen(false)
            }
        }
        window.addEventListener("resize", handleResize)
        return () => window.removeEventListener("resize", handleResize)
    }, [])

    const toggleSidebar = () => setSidebarCollapsed(prev => !prev)
    const toggleMobileMenu = () => setMobileMenuOpen(prev => !prev)

    return (
        <DashboardLayoutContext.Provider value={{
            isSidebarCollapsed,
            setSidebarCollapsed,
            isMobileMenuOpen,
            setMobileMenuOpen,
            toggleSidebar,
            toggleMobileMenu
        }}>
            {children}
        </DashboardLayoutContext.Provider>
    )
}

export function useDashboardLayout() {
    const context = useContext(DashboardLayoutContext)
    if (context === undefined) {
        throw new Error("useDashboardLayout must be used within a DashboardLayoutProvider")
    }
    return context
}
