import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { MONNIFY_API_URL, corsHeaders, getAccessToken } from "../_shared/monnify.ts"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? ""
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
const SOURCE_ACCOUNT_NUMBER = Deno.env.get("MONNIFY_WALLET_ACCOUNT") ?? ""

type WithdrawalStatus = "submitting" | "submitted" | "pending_authorization" | "submission_unknown" | "success" | "failed" | "reversed"

interface WithdrawalRequestRow {
    reference: string
    user_id: string
    amount_kobo: number
    bank_code: string
    account_number: string
    bank_name: string
    status: string
}

async function updateStatus(
    service: ReturnType<typeof createClient>,
    reference: string,
    status: WithdrawalStatus,
    details: { accountName?: string; monnifyReference?: string; message?: string } = {}
) {
    const { data, error } = await service.rpc("update_wallet_withdrawal_status", {
        p_reference: reference,
        p_status: status,
        p_account_name: details.accountName ?? null,
        p_monnify_reference: details.monnifyReference ?? null,
        p_message: details.message ?? null,
    })
    if (error || !data?.success) throw new Error(error?.message ?? data?.error ?? "Unable to update withdrawal")
}

function mapStatus(status: unknown): WithdrawalStatus {
    const value = String(status ?? "").toUpperCase()
    if (value === "SUCCESS" || value === "COMPLETED") return "success"
    if (value === "FAILED" || value === "EXPIRED") return "failed"
    if (value === "REVERSED") return "reversed"
    if (value === "PENDING_AUTHORIZATION" || value === "OTP_EMAIL_DISPATCH_FAILED") return "pending_authorization"
    return "submitted"
}

async function verifyAccount(accessToken: string, bankCode: string, accountNumber: string) {
    const url = new URL(`${MONNIFY_API_URL}/api/v1/disbursements/account/validate`)
    url.searchParams.set("accountNumber", accountNumber)
    url.searchParams.set("bankCode", bankCode)
    const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
    const data = await response.json()
    if (!response.ok || !data?.requestSuccessful || !data?.responseBody?.accountName) {
        throw new Error(data?.responseMessage ?? "Monnify could not verify this account")
    }
    return String(data.responseBody.accountName)
}

serve(async (request) => {
    if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

    try {
        const authorization = request.headers.get("authorization") ?? ""
        if (!authorization.toLowerCase().startsWith("bearer ")) throw new Error("Authentication required")

        const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: authorization } },
            auth: { persistSession: false, autoRefreshToken: false },
        })
        const token = authorization.slice(7).trim()
        const { data: authData, error: authError } = await authClient.auth.getUser(token)
        if (authError || !authData.user) throw new Error("Authentication required")

        const payload = await request.json() as { reference?: string }
        if (!payload.reference?.startsWith("WIT-")) throw new Error("Valid withdrawal reference required")

        const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
        const { data, error } = await service
            .from("wallet_withdrawal_requests")
            .select("reference,user_id,amount_kobo,bank_code,account_number,bank_name,status")
            .eq("reference", payload.reference)
            .eq("user_id", authData.user.id)
            .single()
        if (error || !data) throw new Error("Withdrawal request not found")

        const withdrawal = data as WithdrawalRequestRow
        if (["success", "failed", "reversed"].includes(withdrawal.status)) {
            return Response.json({ success: true, status: withdrawal.status, message: `Withdrawal is ${withdrawal.status}` }, { headers: corsHeaders })
        }
        if (withdrawal.status !== "pending_submission") {
            return Response.json({ success: true, status: withdrawal.status, message: "Withdrawal is awaiting confirmation" }, { headers: corsHeaders })
        }

        if (!SOURCE_ACCOUNT_NUMBER) {
            await updateStatus(service, withdrawal.reference, "failed", { message: "Withdrawal source account is not configured" })
            throw new Error("Withdrawal source account is not configured")
        }

        let accessToken: string
        let accountName: string
        try {
            accessToken = await getAccessToken()
            accountName = await verifyAccount(accessToken, withdrawal.bank_code, withdrawal.account_number)
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unable to verify the destination account"
            await updateStatus(service, withdrawal.reference, "failed", { message })
            throw error
        }
        await updateStatus(service, withdrawal.reference, "submitting", { accountName, message: "Submitting transfer to Monnify" })

        let response: Response
        try {
            response = await fetch(`${MONNIFY_API_URL}/api/v2/disbursements/single`, {
                method: "POST",
                headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    amount: withdrawal.amount_kobo / 100,
                    reference: withdrawal.reference,
                    narration: "RSS Foods wallet withdrawal",
                    destinationBankCode: withdrawal.bank_code,
                    destinationAccountNumber: withdrawal.account_number,
                    destinationAccountName: accountName,
                    currency: "NGN",
                    sourceAccountNumber: SOURCE_ACCOUNT_NUMBER,
                    async: true,
                }),
            })
        } catch (error) {
            await updateStatus(service, withdrawal.reference, "submission_unknown", { accountName, message: "Transfer submission result is unknown; awaiting reconciliation" })
            console.error("Withdrawal submission transport error", error)
            return Response.json({ success: true, status: "submission_unknown", message: "Withdrawal is awaiting confirmation" }, { headers: corsHeaders })
        }

        const result = await response.json()
        if (!response.ok || !result?.requestSuccessful || !result?.responseBody) {
            const message = String(result?.responseMessage ?? "Monnify rejected the withdrawal")
            await updateStatus(service, withdrawal.reference, "failed", { accountName, message })
            throw new Error(message)
        }

        const monnify = result.responseBody
        if (String(monnify.reference ?? withdrawal.reference) !== withdrawal.reference || Math.round(Number(monnify.amount) * 100) !== withdrawal.amount_kobo) {
            await updateStatus(service, withdrawal.reference, "submission_unknown", {
                accountName,
                monnifyReference: String(monnify.transactionReference ?? ""),
                message: "Monnify response did not match the withdrawal; manual reconciliation required",
            })
            throw new Error("Withdrawal response could not be safely verified")
        }

        const status = mapStatus(monnify.status)
        await updateStatus(service, withdrawal.reference, status, {
            accountName,
            monnifyReference: String(monnify.transactionReference ?? ""),
            message: String(monnify.transactionDescription ?? monnify.status ?? "Transfer submitted"),
        })

        return Response.json({
            success: true,
            status,
            message: status === "success" ? "Withdrawal completed" : status === "pending_authorization" ? "Withdrawal requires Monnify authorization" : "Withdrawal submitted for processing",
        }, { headers: corsHeaders })
    } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : "Unable to initialize withdrawal" }, { status: 400, headers: corsHeaders })
    }
})

