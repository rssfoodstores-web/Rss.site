"use client"

import React, { createContext, useContext, useState } from "react"

interface CategoryContextType {
    isOpen: boolean
    toggle: () => void
    close: () => void
    open: () => void
}

const CategoryContext = createContext<CategoryContextType | undefined>(undefined)

export function CategoryProvider({ children }: { children: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(false) // Default to false (Closed) so banner starts full width

    return (
        <CategoryContext.Provider value={{
            isOpen,
            toggle: () => setIsOpen(prev => !prev),
            close: () => setIsOpen(false),
            open: () => setIsOpen(true)
        }}>
            {children}
        </CategoryContext.Provider>
    )
}

export function useCategory() {
    const context = useContext(CategoryContext)
    if (context === undefined) {
        throw new Error("useCategory must be used within a CategoryProvider")
    }
    return context
}
