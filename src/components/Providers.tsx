"use client"

import * as React from "react"
import { ThemeProvider } from "@/components/theme-provider"

import { Toaster } from "sonner"
import { CartProvider } from "@/context/CartContext"
import { WishlistProvider } from "@/context/WishlistContext"
import { UserProvider } from "@/context/UserContext"
import { RealtimeNotificationBridge } from "@/components/notifications/RealtimeNotificationBridge"

export default function Providers({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem={false}
            disableTransitionOnChange
        >
            <UserProvider>
                <CartProvider>
                    <WishlistProvider>
                        <RealtimeNotificationBridge />
                        {children}
                        <Toaster position="top-center" richColors />
                    </WishlistProvider>
                </CartProvider>
            </UserProvider>
        </ThemeProvider>
    )
}
