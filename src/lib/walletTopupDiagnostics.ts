import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"

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

        if (error) {
            console.error("wallet_topup_diagnostic_persist_failed", JSON.stringify({
                attemptId: input.attemptId,
                source: input.source,
                event: input.event,
                errorCode: error.code,
            }))
        }
    } catch (error) {
        console.error("wallet_topup_diagnostic_persist_failed", JSON.stringify({
            attemptId: input.attemptId,
            source: input.source,
            event: input.event,
            errorType: error instanceof Error ? error.name : "unknown",
        }))
    }
}

