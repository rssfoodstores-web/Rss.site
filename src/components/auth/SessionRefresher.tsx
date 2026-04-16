"use client"

import { useEffect } from "react"
import { createClient } from "@/lib/supabase/client"

function isAbortLike(error: unknown) {
    return error instanceof Error
        && (error.name === "AbortError" || error.message.includes("aborted"))
}

export function SessionRefresher() {
    useEffect(() => {
        const supabase = createClient()

        const refresh = async () => {
            try {
                await supabase.auth.refreshSession()
            } catch (error: unknown) {
                if (isAbortLike(error)) {
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
