import Link from "next/link"
import { AlertCircle } from "lucide-react"

interface AuthErrorPageProps {
    searchParams: Promise<Record<string, string | string[] | undefined>>
}

interface AuthErrorContent {
    title: string
    summary: string
    detail: string
    primaryActionLabel: string
    primaryActionHref: string
}

function getFriendlyAuthErrorContent(error: string | null, errorCode: string | null): AuthErrorContent {
    const normalizedError = error?.toLowerCase() ?? ""
    const normalizedCode = errorCode?.toLowerCase() ?? ""
    const isExpiredLink = normalizedError.includes("otp_expired")
        || normalizedError.includes("expired")
        || normalizedCode.includes("otp_expired")
    const isAccessDenied = normalizedError.includes("access_denied")
    const needsManualLogin = normalizedCode === "session_exchange_failed"
        || normalizedError.includes("pkce code verifier not found")

    if (isExpiredLink) {
        return {
            title: "This link has expired",
            summary: "Your sign-in or verification link is no longer valid.",
            detail: "Please return to the login or sign-up page and request a new link to continue.",
            primaryActionLabel: "Go to Login",
            primaryActionHref: "/login",
        }
    }

    if (needsManualLogin) {
        return {
            title: "We couldn't complete sign-in here",
            summary: "The secure sign-in step did not finish on this device or browser.",
            detail: "If you opened the link in a different app, your account may already be confirmed. Please sign in again to continue.",
            primaryActionLabel: "Go to Login",
            primaryActionHref: "/login",
        }
    }

    if (isAccessDenied) {
        return {
            title: "We couldn't verify this request",
            summary: "This sign-in or confirmation link could not be accepted.",
            detail: "Please try again from the most recent email or start a fresh sign-in if the problem continues.",
            primaryActionLabel: "Try Login Again",
            primaryActionHref: "/login",
        }
    }

    return {
        title: "We couldn't complete that step",
        summary: "Something interrupted the sign-in or verification process.",
        detail: "Please try again. If the link is old, request a new one from the login or registration page.",
        primaryActionLabel: "Go to Login",
        primaryActionHref: "/login",
    }
}

export default async function AuthErrorPage({ searchParams }: AuthErrorPageProps) {
    const params = await searchParams
    const error = typeof params.error === "string" ? params.error : null
    const errorCode = typeof params.error_code === "string" ? params.error_code : null
    const content = getFriendlyAuthErrorContent(error, errorCode)

    return (
        <div className="min-h-screen bg-[#FAFAFA] px-4 py-10 dark:bg-black sm:px-6 lg:px-8">
            <div className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center">
                <div className="w-full rounded-3xl border border-gray-100 bg-white px-6 py-10 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:px-8 sm:py-12">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500 dark:bg-red-950/40 dark:text-red-300">
                        <AlertCircle className="h-8 w-8" />
                    </div>

                    <h1 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl">
                        {content.title}
                    </h1>
                    <p className="mt-4 text-base text-gray-600 dark:text-gray-300">
                        {content.summary}
                    </p>

                    <div className="mt-6 rounded-2xl border border-orange-100 bg-orange-50/70 px-5 py-4 text-left dark:border-orange-900/50 dark:bg-orange-950/20">
                        <p className="text-sm leading-6 text-gray-700 dark:text-gray-200">
                            {content.detail}
                        </p>
                    </div>

                    <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                        <Link
                            href={content.primaryActionHref}
                            className="inline-flex items-center justify-center rounded-full bg-[#F58220] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#E57210]"
                        >
                            {content.primaryActionLabel}
                        </Link>
                        <Link
                            href="/register"
                            className="inline-flex items-center justify-center rounded-full border border-gray-200 px-6 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-zinc-700 dark:text-gray-200 dark:hover:bg-zinc-800"
                        >
                            Create Account
                        </Link>
                    </div>

                    <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
                        If this keeps happening, try opening the newest email and using the latest link.
                    </p>
                </div>
            </div>
        </div>
    )
}
