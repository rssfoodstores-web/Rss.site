import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ALLOWED_EVENTS = new Set([
    "client_navigation_timeout",
    "wallet_returned_without_callback",
    "server_failure_returned",
    "provider_returned",
    "payment_verification_error",
    "payment_verification_complete",
])

function classifyPlatform(userAgent: string) {
    if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios_webkit"
    if (/Android/i.test(userAgent)) return "android"
    return "other"
}

export async function POST(request: NextRequest) {
    const requestUrl = new URL(request.url)
    const origin = request.headers.get("origin")
    const fetchSite = request.headers.get("sec-fetch-site")

    if ((origin && origin !== requestUrl.origin) || (!origin && fetchSite === "cross-site")) {
        return NextResponse.json({ error: "Invalid request origin." }, { status: 403 })
    }

    let payload: { attemptId?: unknown; event?: unknown }
    try {
        payload = await request.json()
    } catch {
        return NextResponse.json({ error: "Invalid diagnostic payload." }, { status: 400 })
    }

    if (
        typeof payload.attemptId !== "string"
        || !UUID_PATTERN.test(payload.attemptId)
        || typeof payload.event !== "string"
        || !ALLOWED_EVENTS.has(payload.event)
    ) {
        return NextResponse.json({ error: "Invalid diagnostic payload." }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) {
        return NextResponse.json({ error: "Your session could not be confirmed." }, { status: 401 })
    }

    const platform = classifyPlatform(request.headers.get("user-agent") ?? "")
    console.info("wallet_topup_client_diagnostic", JSON.stringify({
        event: payload.event,
        attemptId: payload.attemptId,
        platform,
        fetchSite: fetchSite ?? "unknown",
    }))

    return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } })
}

