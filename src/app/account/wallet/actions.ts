"use server"

import {
    FunctionsFetchError,
    FunctionsHttpError,
    FunctionsRelayError,
} from "@supabase/functions-js"
import { createServerClient } from "@supabase/ssr"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"

type WalletType = "customer" | "merchant" | "agent" | "rider"

interface WalletActivity {
    id: string
    wallet_id: string
    amount: number
    direction: "credit" | "debit"
    description: string
    reference: string | null
    created_at: string | null
    source: "wallet_transaction" | "ledger_entry"
    status: string
}

interface WalletSummary {
    id: string
    owner_id: string
    balance: number
    type: WalletType
    virtual_account: Record<string, string> | null
    label: string
    description: string
    canTopUp: boolean
    canWithdraw: boolean
    entries: WalletActivity[]
}

async function getSupabase() {
    const cookieStore = await cookies()

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                    }
                },
            },
        }
    )
}

async function invokeEdgeFunction<T>(
    supabase: Awaited<ReturnType<typeof getSupabase>>,
    functionName: string,
    body?: Record<string, unknown>
) {
    const { data, error } = await supabase.functions.invoke(functionName, {
        body,
    })

    if (error) {
        const message = await getEdgeFunctionErrorMessage(error)

        if (shouldRetryWithAnon(error, message)) {
            const fallbackResult = await getEdgeFunctionClient().functions.invoke(functionName, {
                body,
            })

            if (fallbackResult.error) {
                throw new Error(await getEdgeFunctionErrorMessage(fallbackResult.error))
            }

            if (fallbackResult.data?.error) {
                throw new Error(fallbackResult.data.error)
            }

            return fallbackResult.data as T
        }

        throw new Error(message)
    }

    if (data?.error) {
        throw new Error(data.error)
    }

    return data as T
}

function getEdgeFunctionClient() {
    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                detectSessionInUrl: false,
                persistSession: false,
            },
        }
    )
}

async function getEdgeFunctionErrorMessage(error: unknown) {
    if (error instanceof FunctionsHttpError) {
        const response = error.context as Response | undefined

        if (response) {
            try {
                const payload = await response.clone().json() as {
                    error?: string
                    message?: string
                }

                if (typeof payload.error === "string" && payload.error) {
                    return payload.error
                }

                if (typeof payload.message === "string" && payload.message) {
                    return payload.message
                }
            } catch {
                try {
                    const text = await response.clone().text()
                    if (text) {
                        return text
                    }
                } catch {
                }
            }

            return `Edge Function returned status ${response.status}.`
        }
    }

    if (error instanceof FunctionsRelayError) {
        return "Supabase relay could not reach the Edge Function."
    }

    if (error instanceof FunctionsFetchError) {
        return "Unable to reach Supabase Edge Functions."
    }

    if (error instanceof Error) {
        return error.message
    }

    return "Unexpected Edge Function error."
}

function shouldRetryWithAnon(error: unknown, message: string) {
    const normalizedMessage = message.trim().toLowerCase()

    if (normalizedMessage === "invalid jwt") {
        return true
    }

    if (error instanceof FunctionsHttpError) {
        const response = error.context as Response | undefined
        return response?.status === 401
    }

    return false
}

async function createMonnifyReservedAccount(
    supabase: Awaited<ReturnType<typeof getSupabase>>,
    user: {
        id: string
        email?: string | null
        user_metadata?: Record<string, unknown>
    },
    walletId: string
) {
    try {
        const data = await invokeEdgeFunction<{ accounts?: Array<Record<string, unknown>> }>(
            supabase,
            "monnify-reserved-account",
            {
                walletId,
                customerName: String(user.user_metadata?.full_name ?? "RSS Foods User"),
                customerEmail: user.email ?? "support@rssfoods.com",
            }
        )

        return data.accounts ?? null
    } catch (error) {
        console.error("Reserved account creation error:", error)
        return null
    }
}

async function ensureWalletExists(userId: string) {
    const supabase = await getSupabase()

    let { data: currentWallet } = await supabase
        .from("wallets")
        .select("*")
        .eq("id", userId)
        .single()

    if (!currentWallet) {
        const { data: newWallet, error } = await supabase
            .from("wallets")
            .insert({
                id: userId,
                owner_id: userId,
                balance: 0,
                type: "customer",
            })
            .select()
            .single()

        if (error) {
            if (error.code === "23505") {
                const { data: existingWallet } = await supabase
                    .from("wallets")
                    .select("*")
                    .eq("id", userId)
                    .single()

                currentWallet = existingWallet
            } else {
                throw error
            }
        } else {
            currentWallet = newWallet
        }
    }

    if (currentWallet && !currentWallet.virtual_account) {
        const { data: { user } } = await supabase.auth.getUser()

        if (user) {
            const accounts = await createMonnifyReservedAccount(supabase, user, currentWallet.id)
            const mainAccount = accounts?.[0]

            if (mainAccount) {
                const virtualAccountData = {
                    bankName: mainAccount.bankName,
                    accountNumber: mainAccount.accountNumber,
                    bankCode: mainAccount.bankCode,
                    accountName: mainAccount.accountName,
                }

                await supabase
                    .from("wallets")
                    .update({ virtual_account: virtualAccountData })
                    .eq("id", currentWallet.id)

                currentWallet.virtual_account = virtualAccountData
            }
        }
    }

    return currentWallet
}

function getWalletSortOrder(type: WalletType) {
    switch (type) {
        case "merchant":
            return 0
        case "agent":
            return 1
        case "rider":
            return 2
        case "customer":
        default:
            return 3
    }
}

function getWalletLabel(type: WalletType) {
    switch (type) {
        case "merchant":
            return "Merchant Wallet"
        case "agent":
            return "Agent Wallet"
        case "rider":
            return "Rider Wallet"
        case "customer":
        default:
            return "Customer Wallet"
    }
}

function getWalletDescription(type: WalletType) {
    switch (type) {
        case "merchant":
            return "Tracks settled merchant payouts from completed orders."
        case "agent":
            return "Tracks agent commissions from delivered orders."
        case "rider":
            return "Tracks rider earnings from completed deliveries."
        case "customer":
        default:
            return "Use this wallet for top-ups, direct wallet payments, and withdrawals."
    }
}

export async function initializeTopUp(amount: number) {
    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: "Not authenticated" }
    }

    if (amount <= 0) {
        return { error: "Invalid amount" }
    }

    try {
        const customerWallet = await ensureWalletExists(user.id)

        const reference = `WAL-${Date.now()}-${Math.floor(Math.random() * 1000)}`
        const amountKobo = Math.round(amount * 100)

        const { error: transactionError } = await supabase
            .from("wallet_transactions")
            .insert({
                wallet_id: customerWallet.id,
                amount: amountKobo,
                type: "credit",
                status: "pending",
                reference,
                description: `Wallet top-up: NGN ${amount.toLocaleString()}`,
            })

        if (transactionError) {
            throw transactionError
        }

        const data = await invokeEdgeFunction<{
            checkoutUrl: string
            paymentReference: string
        }>(supabase, "monnify-init-topup", {
            amount,
            customerName: String(user.user_metadata?.full_name ?? "Customer"),
            customerEmail: user.email,
            paymentReference: reference,
            paymentDescription: `Wallet top-up: NGN ${amount.toLocaleString()}`,
            redirectPath: `/account/wallet?ref=${reference}`,
            metadata: {
                type: "wallet_topup",
                wallet_id: customerWallet.id,
                user_kobo_amount: amountKobo,
            },
        })

        return {
            success: true,
            checkoutUrl: data.checkoutUrl,
            reference,
        }
    } catch (error: any) {
        console.error("Top-up initialization error:", error)
        return { error: error.message ?? "Unable to initialize top-up" }
    }
}

export async function getWalletData() {
    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: "Not authenticated" }
    }

    const customerWallet = await ensureWalletExists(user.id)

    const { data: wallets } = await supabase
        .from("wallets")
        .select("*")
        .eq("owner_id", user.id)

    const allWallets = ((wallets ?? []) as Array<{
        id: string
        owner_id: string
        balance: number
        type: WalletType
        virtual_account: Record<string, string> | null
    }>)
        .filter((wallet): wallet is typeof wallet & { type: WalletType } =>
            ["customer", "merchant", "agent", "rider"].includes(wallet.type)
        )
        .sort((left, right) => getWalletSortOrder(left.type) - getWalletSortOrder(right.type))

    const walletIds = allWallets.map((wallet) => wallet.id)

    const [{ data: transactionRows }, { data: ledgerRows }] = await Promise.all([
        supabase
            .from("wallet_transactions")
            .select("*")
            .eq("wallet_id", customerWallet.id)
            .order("created_at", { ascending: false })
            .limit(20),
        walletIds.length
            ? supabase
                .from("ledger_entries")
                .select("*")
                .in("wallet_id", walletIds)
                .order("created_at", { ascending: false })
                .limit(80)
            : Promise.resolve({ data: [] as never[] }),
    ])

    const entriesByWallet = new Map<string, WalletActivity[]>()

    for (const tx of transactionRows ?? []) {
        const activity: WalletActivity = {
            id: `wallet-tx-${tx.id}`,
            wallet_id: tx.wallet_id ?? customerWallet.id,
            amount: Math.abs(tx.amount ?? 0),
            direction: tx.type === "debit" ? "debit" : "credit",
            description: tx.description ?? "Wallet activity",
            reference: tx.reference ?? null,
            created_at: tx.created_at,
            source: "wallet_transaction",
            status: tx.status ?? "success",
        }

        const bucket = entriesByWallet.get(activity.wallet_id) ?? []
        bucket.push(activity)
        entriesByWallet.set(activity.wallet_id, bucket)
    }

    for (const entry of ledgerRows ?? []) {
        const activity: WalletActivity = {
            id: `ledger-${entry.id}`,
            wallet_id: entry.wallet_id,
            amount: Math.abs(entry.amount ?? 0),
            direction: (entry.amount ?? 0) < 0 ? "debit" : "credit",
            description: entry.description ?? "Settlement entry",
            reference: entry.reference_id ?? null,
            created_at: entry.created_at,
            source: "ledger_entry",
            status: "success",
        }

        const bucket = entriesByWallet.get(activity.wallet_id) ?? []
        bucket.push(activity)
        entriesByWallet.set(activity.wallet_id, bucket)
    }

    const walletSummaries: WalletSummary[] = allWallets.map((wallet) => ({
        ...wallet,
        label: getWalletLabel(wallet.type),
        description: getWalletDescription(wallet.type),
        canTopUp: wallet.type === "customer",
        canWithdraw: wallet.type === "customer",
        entries: (entriesByWallet.get(wallet.id) ?? [])
            .sort((left, right) => {
                const leftTime = left.created_at ? new Date(left.created_at).getTime() : 0
                const rightTime = right.created_at ? new Date(right.created_at).getTime() : 0
                return rightTime - leftTime
            })
            .slice(0, 20),
    }))

    const primaryWallet =
        walletSummaries.find((wallet) => wallet.type !== "customer") ??
        walletSummaries.find((wallet) => wallet.type === "customer") ??
        null

    return {
        wallet: primaryWallet,
        wallets: walletSummaries,
        primaryWalletId: primaryWallet?.id ?? null,
        transactions: primaryWallet?.entries ?? [],
    }
}

export async function getBanks() {
    const supabase = await getSupabase()

    try {
        const data = await invokeEdgeFunction<{ banks: Array<Record<string, unknown>> }>(supabase, "monnify-banks")
        return { success: true, banks: data.banks }
    } catch (error: any) {
        return { error: error.message ?? "Unable to fetch banks" }
    }
}

export async function verifyAccount(bankCode: string, accountNumber: string) {
    const supabase = await getSupabase()

    try {
        const data = await invokeEdgeFunction<{ accountName: string }>(supabase, "monnify-verify-account", {
            bankCode,
            accountNumber,
        })

        return { success: true, accountName: data.accountName, code: null }
    } catch (error: any) {
        console.error("Account verification error:", error)
        return { error: error.message ?? "Verification service is unavailable", code: undefined }
    }
}

export async function initiateWithdrawal(bankCode: string, accountNumber: string, amount: number, bankName: string) {
    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: "Not authenticated" }
    }

    if (amount <= 0) {
        return { error: "Invalid amount" }
    }

    const reference = `WIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const amountKobo = Math.round(amount * 100)

    try {
        const { data: rpcResult, error: rpcError } = await supabase.rpc("initiate_withdrawal", {
            amount_kobo: amountKobo,
            bank_code: bankCode,
            account_number: accountNumber,
            bank_name: bankName,
            reference,
            description: `Withdrawal to ${bankName} (${accountNumber})`,
        })

        if (rpcError) {
            throw rpcError
        }

        if (rpcResult && !rpcResult.success) {
            throw new Error(rpcResult.error || "Withdrawal initiation failed")
        }

        try {
            await invokeEdgeFunction(supabase, "monnify-init-withdrawal", {
                amount,
                reference,
                bankCode,
                accountNumber,
                narration: "Withdrawal from RSS Foods Wallet",
            })
        } catch (error: any) {
            const { data: compensationResult, error: compensationError } = await supabase.rpc("refund_failed_withdrawal", {
                p_reference: reference,
                p_reason: error.message ?? "Monnify withdrawal failed",
            })

            if (compensationError || !compensationResult?.success) {
                console.error("Withdrawal compensation failed:", compensationError ?? compensationResult)
                return {
                    error: "Withdrawal failed and automatic reversal could not be confirmed. Use the reference for manual reconciliation.",
                    reference,
                }
            }

            throw error
        }

        const { data: markResult, error: markError } = await supabase.rpc("mark_withdrawal_success", {
            p_reference: reference,
        })

        if (markError || !markResult?.success) {
            console.error("Withdrawal finalization failed:", markError ?? markResult)
            return {
                error: "Withdrawal was submitted but local finalization failed. Reconcile with the reference before retrying.",
                reference,
            }
        }

        revalidatePath("/account/wallet")

        return {
            success: true,
            message: "Withdrawal initiated successfully",
            reference,
        }
    } catch (error: any) {
        console.error("Withdrawal error:", error)
        return { error: error.message ?? "Unable to initiate withdrawal" }
    }
}
