"use server"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { DEFAULT_WALLET_FEE_SETTINGS, normalizeWalletFeeSettings, type WalletFeeSettings } from "@/lib/walletFees"

async function getAdminClient() {
    const cookieStore = await cookies()
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        cookies: { getAll: () => cookieStore.getAll(), setAll: () => undefined },
    })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect("/login")
    const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", user.id).in("role", ["admin", "supa_admin"]).maybeSingle()
    if (!role) throw new Error("Admin access required")
    return supabase
}

export async function getWalletFeeSettings() {
    const supabase = await getAdminClient()
    const { data } = await supabase.from("app_settings").select("value").eq("key", "wallet_fee_settings").maybeSingle()
    return data ? normalizeWalletFeeSettings(data.value) : DEFAULT_WALLET_FEE_SETTINGS
}

export async function getWalletFinanceSummary() {
    const supabase = await getAdminClient()
    const { data, error } = await supabase.rpc("get_wallet_finance_summary")
    if (error) throw new Error(error.message)
    return data as Record<string, unknown>
}

export async function saveWalletFeeSettings(settings: WalletFeeSettings) {
    const supabase = await getAdminClient()
    const normalized = normalizeWalletFeeSettings({
        collection_fee_bps: settings.collectionFeeBps,
        collection_fee_cap_kobo: settings.collectionFeeCapKobo,
        fee_vat_bps: settings.feeVatBps,
        rss_topup_fee_bps: settings.rssTopupFeeBps,
        payout_below_10k_kobo: settings.payoutBelow10kKobo,
        payout_below_50k_kobo: settings.payoutBelow50kKobo,
        payout_50k_plus_kobo: settings.payout50kPlusKobo,
        rss_withdrawal_fee_bps: settings.rssWithdrawalFeeBps,
    })
    if (normalized.collectionFeeBps > 10000 || normalized.feeVatBps > 10000 || normalized.rssTopupFeeBps > 10000 || normalized.rssWithdrawalFeeBps > 10000) {
        throw new Error("Percentage values cannot exceed 100%")
    }
    const { error } = await supabase.from("app_settings").update({ value: {
        collection_fee_bps: normalized.collectionFeeBps,
        collection_fee_cap_kobo: normalized.collectionFeeCapKobo,
        fee_vat_bps: normalized.feeVatBps,
        rss_topup_fee_bps: normalized.rssTopupFeeBps,
        payout_below_10k_kobo: normalized.payoutBelow10kKobo,
        payout_below_50k_kobo: normalized.payoutBelow50kKobo,
        payout_50k_plus_kobo: normalized.payout50kPlusKobo,
        rss_withdrawal_fee_bps: normalized.rssWithdrawalFeeBps,
    } }).eq("key", "wallet_fee_settings")
    if (error) throw new Error(error.message)
    revalidatePath("/admin/finances")
    return { success: true }
}

