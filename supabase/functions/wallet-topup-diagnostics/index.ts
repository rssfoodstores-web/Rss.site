import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_PAYLOAD_LENGTH = 8192
const EVENTS_BY_SOURCE = {
    client: new Set([
        "client_submit", "client_pagehide", "client_pageshow", "client_navigation_timeout",
        "wallet_returned_without_callback", "server_failure_returned", "provider_returned",
        "payment_verification_error", "payment_verification_complete",
    ]),
    app_server: new Set([
        "request_received", "request_rejected", "initialization_started", "initialization_threw",
        "initialization_returned_without_checkout", "checkout_url_rejected", "redirect_issued", "checkout_created",
    ]),
}
const SAFE_REASONS = new Set([
    "origin_mismatch", "conflicting_attempt_ids", "missing_attempt_id", "invalid_attempt_id",
    "invalid_form_data", "invalid_amount", "invalid_url", "untrusted_checkout_host",
])
const SAFE_ERROR_TYPES = new Set([
    "Error", "TypeError", "RangeError", "SyntaxError", "AbortError", "TimeoutError",
    "FunctionsHttpError", "FunctionsFetchError", "FunctionsRelayError", "unknown",
])
const BOOLEAN_DETAILS = [
    "persisted", "online", "returnedFromMonnify", "paymentReturnPresent", "topupErrorPresent",
    "amountValid", "resultHasError", "broadcastChannelAvailable", "cryptoUUIDAvailable",
    "browserReturned", "checkoutPrepared",
]

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value)
}

function sanitizeDetails(value: unknown) {
    const details: Record<string, string | number | boolean | null> = {}
    if (!isRecord(value)) return details

    for (const key of BOOLEAN_DETAILS) {
        if (typeof value[key] === "boolean") details[key] = value[key]
    }
    for (const key of ["pendingAgeMs", "durationMs"]) {
        const duration = value[key]
        if (typeof duration === "number" && Number.isFinite(duration) && duration >= 0 && duration <= 40 * 60 * 1000) {
            details[key] = Math.round(duration)
        }
    }
    if (typeof value.responseStatus === "number" && Number.isInteger(value.responseStatus) && value.responseStatus >= 100 && value.responseStatus <= 599) {
        details.responseStatus = value.responseStatus
    }
    if (value.visibilityState === "visible" || value.visibilityState === "hidden") details.visibilityState = value.visibilityState
    if (typeof value.fetchSite === "string" && ["same-origin", "same-site", "cross-site", "none", "unknown"].includes(value.fetchSite)) details.fetchSite = value.fetchSite
    if (typeof value.platform === "string" && ["ios_webkit", "android", "other"].includes(value.platform)) details.platform = value.platform
    if (typeof value.reason === "string" && SAFE_REASONS.has(value.reason)) details.reason = value.reason
    if (typeof value.errorType === "string" && SAFE_ERROR_TYPES.has(value.errorType)) details.errorType = value.errorType
    if (typeof value.protocol === "string" && /^[a-z]{2,16}:$/.test(value.protocol)) details.protocol = value.protocol
    if (typeof value.checkoutHost === "string" && value.checkoutHost.length <= 253 && /^(?:[a-z0-9-]+\.)+monnify\.com$/i.test(value.checkoutHost)) {
        details.checkoutHost = value.checkoutHost.toLowerCase()
    }
    if (typeof value.browserIOSVersion === "string" && value.browserIOSVersion.length <= 12 && /^\d+(?:\.\d+){0,2}$/.test(value.browserIOSVersion)) {
        details.browserIOSVersion = value.browserIOSVersion
    }
    return details
}

function respond(status: number, success: boolean) {
    return new Response(JSON.stringify({ success }), {
        status,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    })
}

export async function handleWalletTopupDiagnosticRequest(request: Request) {
    if (request.method !== "POST") return respond(405, false)

    const authorization = request.headers.get("authorization") ?? ""
    const token = /^Bearer\s+(\S+)$/i.exec(authorization)?.[1]
    if (!token) return respond(401, false)

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
        const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? ""
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authorization } },
            auth: { persistSession: false, autoRefreshToken: false },
        })
        const { data: { user }, error: authError } = await supabase.auth.getUser(token)
        if (authError || !user || user.is_anonymous) return respond(401, false)

        if (Number(request.headers.get("content-length") ?? 0) > MAX_PAYLOAD_LENGTH) return respond(413, false)
        const body = await request.text()
        if (body.length > MAX_PAYLOAD_LENGTH) return respond(413, false)

        let payload: unknown
        try {
            payload = JSON.parse(body)
        } catch {
            return respond(400, false)
        }
        if (
            !isRecord(payload)
            || typeof payload.attemptId !== "string" || !UUID_PATTERN.test(payload.attemptId)
            || (payload.source !== "client" && payload.source !== "app_server")
            || typeof payload.event !== "string" || !EVENTS_BY_SOURCE[payload.source].has(payload.event)
            || (payload.platform !== "ios_webkit" && payload.platform !== "android" && payload.platform !== "other")
        ) return respond(400, false)

        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        if (!serviceRoleKey) throw new Error("Diagnostic persistence unavailable.")
        const admin = createClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
        })
        const { error } = await admin.from("wallet_topup_diagnostics").insert({
            attempt_id: payload.attemptId,
            source: payload.source,
            event: payload.event,
            platform: payload.platform,
            details: sanitizeDetails(payload.details),
        })
        if (error) {
            console.error("wallet_topup_diagnostic_persist_failed", JSON.stringify({
                attemptId: payload.attemptId, source: payload.source, event: payload.event, errorCode: error.code,
            }))
            return respond(500, false)
        }
        return respond(200, true)
    } catch (error) {
        console.error("wallet_topup_diagnostic_persist_failed", JSON.stringify({
            errorType: error instanceof Error ? error.name : "unknown",
        }))
        return respond(500, false)
    }
}

Deno.serve(handleWalletTopupDiagnosticRequest)
