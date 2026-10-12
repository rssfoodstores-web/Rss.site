import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export type WalletTopupDiagnosticSource = "client" | "app_server" | "monnify_edge"
export type WalletTopupDiagnosticPlatform = "ios_webkit" | "android" | "other"

export type WalletTopupDiagnosticEvent =
    | "client_submit"
    | "client_pagehide"
    | "client_pageshow"
    | "client_navigation_timeout"
    | "wallet_returned_without_callback"
    | "server_failure_returned"
    | "provider_returned"
    | "payment_verification_error"
    | "payment_verification_complete"
    | "request_received"
    | "request_rejected"
    | "initialization_started"
    | "initialization_threw"
    | "initialization_returned_without_checkout"
    | "checkout_url_rejected"
    | "redirect_issued"
    | "provider_request_received"
    | "monnify_response"
    | "checkout_created"
    | "provider_initialization_failed"

export type WalletTopupDiagnosticDetails = Record<string, string | number | boolean | null>

export async function recordWalletTopupDiagnostic(input: {
    attemptId: string
    source: WalletTopupDiagnosticSource
    event: WalletTopupDiagnosticEvent
    platform: WalletTopupDiagnosticPlatform
    details?: WalletTopupDiagnosticDetails
}) {
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        try {
            const { error } = await createAdminClient()
                .from("wallet_topup_diagnostics")
                .insert({
                    attempt_id: input.attemptId,
                    source: input.source,
                    event: input.event,
                    platform: input.platform,
                    details: input.details ?? {},
                })

            if (!error) return { success: true }
            console.error("wallet_topup_diagnostic_persist_failed", JSON.stringify({
                attemptId: input.attemptId,
                source: input.source,
                event: input.event,
                transport: "app_server",
                errorCode: error.code,
            }))
        } catch (error) {
            console.error("wallet_topup_diagnostic_persist_failed", JSON.stringify({
                attemptId: input.attemptId,
                source: input.source,
                event: input.event,
                transport: "app_server",
                errorType: error instanceof Error ? error.name : "unknown",
            }))
        }
    }

    try {
        if (input.source === "monnify_edge") throw new Error("Unsupported diagnostic source.")

        const supabase = await createClient()
        // Retrieve the caller's token for transport. The Edge Function validates it with getUser.
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        if (sessionError || !session?.access_token) throw new Error("Authenticated session unavailable.")

        const { data, error } = await supabase.functions.invoke<{ success: boolean }>("wallet-topup-diagnostics", {
            headers: { Authorization: `Bearer ${session.access_token}` },
            body: {
                attemptId: input.attemptId,
                source: input.source,
                event: input.event,
                platform: input.platform,
                details: input.details ?? {},
            },
        })

        if (error || data?.success !== true) throw error ?? new Error("Diagnostic was not saved.")
        return { success: true }
    } catch (error) {
        console.error("wallet_topup_diagnostic_persist_failed", JSON.stringify({
            attemptId: input.attemptId,
            source: input.source,
            event: input.event,
            transport: "edge",
            errorType: error instanceof Error ? error.name : "unknown",
        }))
        return { success: false }
    }
}

