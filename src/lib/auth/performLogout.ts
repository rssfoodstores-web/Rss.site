"use client"

import type { SupabaseClient } from "@supabase/supabase-js"

function isAbortLike(error: unknown) {
    return error instanceof Error && (
        error.name === "AbortError"
        || error.message.includes("aborted")
        || error.message.includes("LockManager")
    )
}

function wait(ms: number) {
    return new Promise((resolve) => {
        window.setTimeout(resolve, ms)
    })
}

export async function performLogout(
    supabase: SupabaseClient,
    redirectTo = "/login"
) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
            const { error } = await supabase.auth.signOut()

            if (error) {
                throw error
            }

            window.location.assign(redirectTo)
            return true
        } catch (error) {
            if (!isAbortLike(error) || attempt === 1) {
                console.error("Failed to sign out:", error)
                return false
            }

            // Give any in-flight auth lock a moment to settle before retrying.
            await wait(150)
        }
    }

    return false
}
