"use client"

import { useEffect } from "react"
import { createClient } from "@/lib/supabase/client"

export function SessionRefresher() {
    useEffect(() => {
        const supabase = createClient()

        const refresh = async () => {
            try {
                await supabase.auth.refreshSession()
            } catch (error: any) {
                if (error?.name === "AbortError" || error?.message?.includes("aborted")) {
                    return
                }
                console.error("Failed to refresh session:", error)
            }
        }

        void refresh()

        const handleFocus = () => {
            void refresh()
        }

        window.addEventListener("focus", handleFocus)

        return () => {
            window.removeEventListener("focus", handleFocus)
        }
    }, [])

    return null
}
