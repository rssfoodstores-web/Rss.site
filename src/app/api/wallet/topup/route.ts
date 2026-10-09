import { NextRequest, NextResponse } from "next/server"
import { initializeTopUp } from "@/app/account/wallet/actions"
import {
    recordWalletTopupDiagnostic,
    type WalletTopupDiagnosticEvent,
    type WalletTopupDiagnosticPlatform,
} from "@/lib/walletTopupDiagnostics"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type SafeFailureCode = "invalid_request" | "topup_initialization_failed" | "invalid_checkout_url"

function classifyPlatform(userAgent: string): WalletTopupDiagnosticPlatform {
    if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios_webkit"
    if (/Android/i.test(userAgent)) return "android"
    return "other"
}

async function logTopupEvent(
    level: "info" | "error",
    event: WalletTopupDiagnosticEvent,
    attemptId: string,
    fields: Record<string, string | number | boolean | null | undefined> = {}
) {
    const entry = JSON.stringify({ event, attemptId, ...fields })
    if (level === "error") {
        console.error("wallet_topup_diagnostic", entry)
    } else {
        console.info("wallet_topup_diagnostic", entry)
    }

    const platform = fields.platform === "ios_webkit" || fields.platform === "android"
        ? fields.platform
        : "other"
    const details = Object.fromEntries(
        Object.entries(fields).filter(([, value]) => value !== undefined)
    ) as Record<string, string | number | boolean | null>

    await recordWalletTopupDiagnostic({
        attemptId,
        source: "app_server",
        event,
        platform,
        details,
    })
}

export async function POST(request: NextRequest) {
    const startedAt = Date.now()
    const requestUrl = new URL(request.url)
    const origin = request.headers.get("origin")
    const fetchSite = request.headers.get("sec-fetch-site")
    const platform = classifyPlatform(request.headers.get("user-agent") ?? "")
    const generatedAttemptId = crypto.randomUUID()

    if ((origin && origin !== requestUrl.origin) || (!origin && fetchSite === "cross-site")) {
        await logTopupEvent("error", "request_rejected", generatedAttemptId, { reason: "origin_mismatch", platform })
        return NextResponse.json(
            { error: "Invalid request origin.", diagnosticId: generatedAttemptId },
            { status: 403, headers: { "Cache-Control": "no-store", "X-Topup-Diagnostic-ID": generatedAttemptId } }
        )
    }

    let attemptId = generatedAttemptId
    let amount = Number.NaN
    try {
        const formData = await request.formData()
        const submittedAttemptId = formData.get("attemptId")
        if (typeof submittedAttemptId === "string" && UUID_PATTERN.test(submittedAttemptId)) {
            attemptId = submittedAttemptId
        }

        const amountValue = formData.get("amount")
        amount = typeof amountValue === "string" ? Number(amountValue) : Number.NaN
    } catch {
        await logTopupEvent("error", "request_rejected", attemptId, { reason: "invalid_form_data", platform })
        return redirectWithTopupError(requestUrl, attemptId, "We could not read the top-up request. Please try again.", "invalid_request")
    }

    await logTopupEvent("info", "request_received", attemptId, {
        platform,
        fetchSite: fetchSite ?? "unknown",
        amountValid: Number.isFinite(amount) && amount >= 100,
    })

    if (!Number.isFinite(amount) || amount < 100) {
        await logTopupEvent("error", "request_rejected", attemptId, { reason: "invalid_amount", platform })
        return redirectWithTopupError(requestUrl, attemptId, "Enter a top-up amount of at least ₦100.", "invalid_request")
    }

    await logTopupEvent("info", "initialization_started", attemptId, { platform })
    let result: Awaited<ReturnType<typeof initializeTopUp>>
    try {
        result = await initializeTopUp(amount, attemptId, platform)
    } catch (error) {
        await logTopupEvent("error", "initialization_threw", attemptId, {
            platform,
            errorType: error instanceof Error ? error.name : "unknown",
            durationMs: Date.now() - startedAt,
        })
        return redirectWithTopupError(
            requestUrl,
            attemptId,
            "We could not prepare Monnify checkout. Please try again and share the support code if it repeats.",
            "topup_initialization_failed"
        )
    }

    if (!result.success || !result.checkoutUrl) {
        await logTopupEvent("error", "initialization_returned_without_checkout", attemptId, {
            platform,
            resultHasError: Boolean(result.error),
            durationMs: Date.now() - startedAt,
        })
        return redirectWithTopupError(
            requestUrl,
            attemptId,
            "We could not prepare Monnify checkout. Please try again and share the support code if it repeats.",
            "topup_initialization_failed"
        )
    }

    let checkoutUrl: URL
    try {
        checkoutUrl = new URL(result.checkoutUrl)
    } catch {
        await logTopupEvent("error", "checkout_url_rejected", attemptId, { platform, reason: "invalid_url" })
        return redirectWithTopupError(
            requestUrl,
            attemptId,
            "Monnify returned an invalid checkout link. Please share the support code with us.",
            "invalid_checkout_url"
        )
    }

    if (checkoutUrl.protocol !== "https:" || !checkoutUrl.hostname.endsWith(".monnify.com")) {
        await logTopupEvent("error", "checkout_url_rejected", attemptId, {
            platform,
            reason: "untrusted_checkout_host",
            protocol: checkoutUrl.protocol,
        })
        return redirectWithTopupError(
            requestUrl,
            attemptId,
            "Monnify returned an invalid checkout link. Please share the support code with us.",
            "invalid_checkout_url"
        )
    }

    await logTopupEvent("info", "redirect_issued", attemptId, {
        platform,
        checkoutHost: checkoutUrl.hostname,
        responseStatus: 303,
        durationMs: Date.now() - startedAt,
    })

    const response = NextResponse.redirect(checkoutUrl, 303)
    response.headers.set("Cache-Control", "no-store")
    response.headers.set("X-Topup-Diagnostic-ID", attemptId)
    return response
}

function redirectWithTopupError(
    requestUrl: URL,
    attemptId: string,
    message: string,
    code: SafeFailureCode
) {
    const walletUrl = new URL("/account/wallet", requestUrl)
    walletUrl.searchParams.set("topup_error", message)
    walletUrl.searchParams.set("topup_attempt", attemptId)
    walletUrl.searchParams.set("topup_code", code)

    const response = NextResponse.redirect(walletUrl, 303)
    response.headers.set("Cache-Control", "no-store")
    response.headers.set("X-Topup-Diagnostic-ID", attemptId)
    return response
}

