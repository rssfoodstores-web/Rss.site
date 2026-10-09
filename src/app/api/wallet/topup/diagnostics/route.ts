import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
    recordWalletTopupDiagnostic,
    type WalletTopupDiagnosticEvent,
    type WalletTopupDiagnosticPlatform,
} from "@/lib/walletTopupDiagnostics"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ALLOWED_EVENTS = new Set([
    "client_submit",
    "client_pagehide",
    "client_pageshow",
    "client_navigation_timeout",
    "wallet_returned_without_callback",
    "server_failure_returned",
    "provider_returned",
    "payment_verification_error",
    "payment_verification_complete",
] as const)

type ClientDiagnosticEvent = Extract<WalletTopupDiagnosticEvent,
    | "client_submit"
    | "client_pagehide"
    | "client_pageshow"
    | "client_navigation_timeout"
    | "wallet_returned_without_callback"
    | "server_failure_returned"
    | "provider_returned"
    | "payment_verification_error"
    | "payment_verification_complete"
>

function classifyPlatform(userAgent: string): WalletTopupDiagnosticPlatform {
    if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios_webkit"
    if (/Android/i.test(userAgent)) return "android"
    return "other"
}

function sanitizeDetails(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {}

    const candidate = value as Record<string, unknown>
    const details: Record<string, string | number | boolean | null> = {}

    if (typeof candidate.persisted === "boolean") details.persisted = candidate.persisted
    if (typeof candidate.online === "boolean") details.online = candidate.online
    if (typeof candidate.returnedFromMonnify === "boolean") details.returnedFromMonnify = candidate.returnedFromMonnify
    if (typeof candidate.paymentReturnPresent === "boolean") details.paymentReturnPresent = candidate.paymentReturnPresent
    if (typeof candidate.topupErrorPresent === "boolean") details.topupErrorPresent = candidate.topupErrorPresent
    if (candidate.visibilityState === "visible" || candidate.visibilityState === "hidden") {
        details.visibilityState = candidate.visibilityState
    }
    if (
        typeof candidate.pendingAgeMs === "number"
        && Number.isFinite(candidate.pendingAgeMs)
        && candidate.pendingAgeMs >= 0
        && candidate.pendingAgeMs <= 30 * 60 * 1000
    ) {
        details.pendingAgeMs = Math.round(candidate.pendingAgeMs)
    }

    return details
}

export async function POST(request: NextRequest) {
    const requestUrl = new URL(request.url)
    const origin = request.headers.get("origin")
    const fetchSite = request.headers.get("sec-fetch-site")

    if ((origin && origin !== requestUrl.origin) || (!origin && fetchSite === "cross-site")) {
        return NextResponse.json({ error: "Invalid request origin." }, { status: 403 })
    }

    let payload: { attemptId?: unknown; event?: unknown; details?: unknown }
    try {
        payload = await request.json()
    } catch {
        return NextResponse.json({ error: "Invalid diagnostic payload." }, { status: 400 })
    }

    if (
        typeof payload.attemptId !== "string"
        || !UUID_PATTERN.test(payload.attemptId)
        || typeof payload.event !== "string"
        || !ALLOWED_EVENTS.has(payload.event as ClientDiagnosticEvent)
    ) {
        return NextResponse.json({ error: "Invalid diagnostic payload." }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) {
        return NextResponse.json({ error: "Your session could not be confirmed." }, { status: 401 })
    }

    const platform = classifyPlatform(request.headers.get("user-agent") ?? "")
    const event = payload.event as ClientDiagnosticEvent
    const details = sanitizeDetails(payload.details)

    console.info("wallet_topup_client_diagnostic", JSON.stringify({
        event,
        attemptId: payload.attemptId,
        platform,
        fetchSite: fetchSite ?? "unknown",
        details,
    }))
    await recordWalletTopupDiagnostic({
        attemptId: payload.attemptId,
        source: "client",
        event,
        platform,
        details: { ...details, fetchSite: fetchSite ?? "unknown" },
    })

    return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } })
}

