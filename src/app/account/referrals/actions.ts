"use server"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

interface ReferralStats {
    totalReferrals: number
    totalEarningsKobo: number
    monthEarningsKobo: number
}

export interface ReferralListItem {
    id: string
    fullName: string
    totalEarnedKobo: number
    rewardEvents: number
}

export interface ReferralHistoryItem {
    id: string
    commissionAmountKobo: number
    sourceAmountKobo: number
    sourceKind: string
    createdAt: string
    referredUserId: string
    referredUserName: string
}

export interface ReferralOverview {
    referralCode: string
    commissionBps: number
    stats: ReferralStats
    referrals: ReferralListItem[]
    history: ReferralHistoryItem[]
}

type ReferralOverviewRpc = {
    success?: boolean
    error?: string
    referral_code?: string
    commission_bps?: number
    stats?: {
        total_referrals?: number
        total_earnings_kobo?: number
        month_earnings_kobo?: number
    }
    referrals?: Array<{
        id?: string
        full_name?: string
        total_earned_kobo?: number
        reward_events?: number
    }>
    history?: Array<{
        id?: string
        commission_amount_kobo?: number
        source_amount_kobo?: number
        source_kind?: string
        created_at?: string
        referred_user_id?: string
        referred_user_name?: string
    }>
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

function toNumber(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : 0
}

export async function getReferralData(): Promise<ReferralOverview> {
    const supabase = await getSupabase()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect("/login")
    }

    const { data, error } = await supabase.rpc("get_my_referral_overview")

    if (error) {
        throw new Error(error.message)
    }

    const overview = (data ?? {}) as ReferralOverviewRpc

    if (overview.success === false) {
        throw new Error(overview.error ?? "Unable to load referral overview")
    }

    return {
        referralCode: String(overview.referral_code ?? ""),
        commissionBps: toNumber(overview.commission_bps),
        stats: {
            totalReferrals: toNumber(overview.stats?.total_referrals),
            totalEarningsKobo: toNumber(overview.stats?.total_earnings_kobo),
            monthEarningsKobo: toNumber(overview.stats?.month_earnings_kobo),
        },
        referrals: Array.isArray(overview.referrals)
            ? overview.referrals.map((item) => ({
                id: String(item.id ?? ""),
                fullName: String(item.full_name ?? "RSS User"),
                totalEarnedKobo: toNumber(item.total_earned_kobo),
                rewardEvents: toNumber(item.reward_events),
            }))
            : [],
        history: Array.isArray(overview.history)
            ? overview.history.map((item) => ({
                id: String(item.id ?? ""),
                commissionAmountKobo: toNumber(item.commission_amount_kobo),
                sourceAmountKobo: toNumber(item.source_amount_kobo),
                sourceKind: String(item.source_kind ?? "payout"),
                createdAt: String(item.created_at ?? ""),
                referredUserId: String(item.referred_user_id ?? ""),
                referredUserName: String(item.referred_user_name ?? "RSS User"),
            }))
            : [],
    }
}
