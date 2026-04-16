"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { getSafeNextPath } from "@/lib/auth-redirects"
import { buildAbsoluteUrl, getClientSiteUrl } from "@/lib/site-url"

function isPkceCodeVerifierMissingError(message: string) {
    return message.toLowerCase().includes("pkce code verifier not found")
}

function buildAuthErrorUrl(message: string, description: string) {
    return buildAbsoluteUrl(getClientSiteUrl(), "/auth/auth-code-error", {
        error: message,
        error_code: "session_exchange_failed",
        error_description: description,
        callback_url: buildAbsoluteUrl(getClientSiteUrl(), "/auth/callback"),
    })
}

function buildLoginHelpUrl(next: string) {
    return buildAbsoluteUrl(getClientSiteUrl(), "/login", {
        next,
        auth_message: "This confirmation link finished in a different browser or app. Your email may already be verified, so please sign in to continue.",
    })
}

export default function AuthCallbackFallbackPage() {
    const searchParams = useSearchParams()
    const [statusMessage, setStatusMessage] = useState("Completing secure sign-in...")

    const code = searchParams.get("code")
    const next = useMemo(
        () => getSafeNextPath(searchParams.get("next")) ?? "/",
        [searchParams]
    )
    const referralCode = searchParams.get("ref")?.trim().toUpperCase() ?? ""

    useEffect(() => {
        let cancelled = false

        const completeAuth = async () => {
            if (!code) {
                window.location.assign(
                    buildAuthErrorUrl(
                        "Missing auth code",
                        "Supabase did not return an authorization code."
                    )
                )
                return
            }

            try {
                const supabase = createClient()
                const { error } = await supabase.auth.exchangeCodeForSession(code)

                if (error) {
                    if (isPkceCodeVerifierMissingError(error.message)) {
                        window.location.assign(buildLoginHelpUrl(next))
                        return
                    }

                    window.location.assign(
                        buildAuthErrorUrl(
                            error.message,
                            "This secure sign-in could not be completed in the browser fallback flow."
                        )
                    )
                    return
                }

                if (cancelled) {
                    return
                }

                setStatusMessage("Finalizing your account session...")

                window.location.assign(
                    buildAbsoluteUrl(getClientSiteUrl(), "/auth/callback/finalize", {
                        next,
                        ref: referralCode || undefined,
                    })
                )
            } catch (error) {
                console.error("Client auth callback fallback failed:", error)
                window.location.assign(
                    buildAuthErrorUrl(
                        "Authentication fallback failed",
                        "Sign-in started, but the callback could not be completed."
                    )
                )
            }
        }

        void completeAuth()

        return () => {
            cancelled = true
        }
    }, [code, next, referralCode])

    return (
        <div className="min-h-screen bg-[#FAFAFA] px-4 py-10 dark:bg-black sm:px-6 lg:px-8">
            <div className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center">
                <div className="w-full rounded-3xl border border-gray-100 bg-white px-8 py-12 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#F58220]/10 text-[#F58220]">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                    <h1 className="mt-6 text-2xl font-extrabold text-gray-900 dark:text-white">
                        Signing you in
                    </h1>
                    <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                        {statusMessage}
                    </p>
                </div>
            </div>
        </div>
    )
}
