"use server"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

export interface RewardCheckoutSummary {
    availablePoints: number
    debtPoints: number
    enabled: boolean
    error?: string
    maxDiscountKobo: number
    maxRedeemablePoints: number
    pendingPoints: number
    pointValueKobo: number
    pointValueNaira: number
    success: boolean
}

export interface RewardActivityItem {
    availableBalanceAfter: number
    createdAt: string
    debtBalanceAfter: number
    description: string
    eventType: string
    id: string
    pendingBalanceAfter: number
    pointsDelta: number
    sourceId: string | null
    sourceKind: string | null
}

export interface RewardPointLotItem {
    availableAt: string | null
    createdAt: string
    description: string | null
    expiresAt: string | null
    id: string
    originalPoints: number
    remainingPoints: number
    sourceId: string | null
    sourceKind: string
    status: string
}

export interface RewardReservedOrder {
    createdAt: string
    discountKobo: number
    orderCreatedAt: string | null
    orderId: string
    orderPaymentStatus: string | null
    orderStatus: string | null
    pointsUsed: number
}

export interface RewardWalletSnapshot extends RewardCheckoutSummary {
    reservedOrder: RewardReservedOrder | null
}

export interface RewardDashboardData {
    activity: RewardActivityItem[]
    expiringLots: RewardPointLotItem[]
    pendingLots: RewardPointLotItem[]
    reservedOrder: RewardReservedOrder | null
    summary: RewardCheckoutSummary
}

interface RewardSummaryRpc {
    available_points?: number
    debt_points?: number
    enabled?: boolean
    error?: string
    max_discount_kobo?: number
    max_redeemable_points?: number
    pending_points?: number
    point_value_kobo?: number
    point_value_naira?: number
    success?: boolean
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

function toStringOrNull(value: unknown) {
    return typeof value === "string" && value ? value : null
}

function mapRewardSummary(data: RewardSummaryRpc | null | undefined): RewardCheckoutSummary {
    return {
        availablePoints: toNumber(data?.available_points),
        debtPoints: toNumber(data?.debt_points),
        enabled: data?.enabled !== false,
        error: typeof data?.error === "string" ? data.error : undefined,
        maxDiscountKobo: toNumber(data?.max_discount_kobo),
        maxRedeemablePoints: toNumber(data?.max_redeemable_points),
        pendingPoints: toNumber(data?.pending_points),
        pointValueKobo: Math.max(1, toNumber(data?.point_value_kobo)),
        pointValueNaira: Math.max(1, toNumber(data?.point_value_naira)),
        success: data?.success !== false,
    }
}

async function requireUser() {
    const supabase = await getSupabase()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect("/login")
    }

    return {
        supabase,
        user,
    }
}

async function fetchRewardSummary(
    supabase: Awaited<ReturnType<typeof getSupabase>>,
    subtotalKobo: number
) {
    const { data, error } = await supabase.rpc("get_reward_checkout_summary", {
        p_subtotal_kobo: Math.max(0, Math.floor(subtotalKobo)),
    })

    if (error) {
        throw new Error(error.message)
    }

    return mapRewardSummary((data ?? null) as RewardSummaryRpc | null)
}

async function getReservedRewardOrder(
    supabase: Awaited<ReturnType<typeof getSupabase>>,
    userId: string
): Promise<RewardReservedOrder | null> {
    const { data, error } = await supabase
        .from("reward_point_redemptions")
        .select("order_id, points_used, discount_kobo, created_at")
        .eq("user_id", userId)
        .eq("status", "reserved")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

    if (error) {
        throw new Error(error.message)
    }

    if (!data?.order_id) {
        return null
    }

    const { data: orderRow, error: orderError } = await supabase
        .from("orders")
        .select("id, status, payment_status, created_at")
        .eq("id", data.order_id)
        .maybeSingle()

    if (orderError) {
        throw new Error(orderError.message)
    }

    return {
        createdAt: String(data.created_at ?? ""),
        discountKobo: toNumber(data.discount_kobo),
        orderCreatedAt: typeof orderRow?.created_at === "string" ? orderRow.created_at : null,
        orderId: String(data.order_id),
        orderPaymentStatus: toStringOrNull(orderRow?.payment_status),
        orderStatus: toStringOrNull(orderRow?.status),
        pointsUsed: toNumber(data.points_used),
    }
}

export async function getRewardCheckoutSummary(subtotalKobo: number): Promise<RewardCheckoutSummary> {
    const { supabase } = await requireUser()
    return fetchRewardSummary(supabase, subtotalKobo)
}

export async function getRewardWalletSnapshot(): Promise<RewardWalletSnapshot> {
    const { supabase, user } = await requireUser()
    const [summary, reservedOrder] = await Promise.all([
        fetchRewardSummary(supabase, 0),
        getReservedRewardOrder(supabase, user.id),
    ])

    return {
        ...summary,
        reservedOrder,
    }
}

export async function getRewardDashboardData(): Promise<RewardDashboardData> {
    const { supabase, user } = await requireUser()
    const summary = await fetchRewardSummary(supabase, 0)

    const [
        { data: activityRows, error: activityError },
        { data: pendingRows, error: pendingError },
        { data: expiringRows, error: expiringError },
        reservedOrder,
    ] = await Promise.all([
        supabase
            .from("reward_point_events")
            .select("id, event_type, points_delta, description, source_kind, source_id, available_balance_after, pending_balance_after, debt_balance_after, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(40),
        supabase
            .from("reward_point_lots")
            .select("id, source_kind, source_id, original_points, remaining_points, status, description, expires_at, available_at, created_at")
            .eq("user_id", user.id)
            .eq("status", "pending")
            .order("created_at", { ascending: false }),
        supabase
            .from("reward_point_lots")
            .select("id, source_kind, source_id, original_points, remaining_points, status, description, expires_at, available_at, created_at")
            .eq("user_id", user.id)
            .eq("status", "available")
            .gt("remaining_points", 0)
            .not("expires_at", "is", null)
            .order("expires_at", { ascending: true })
            .limit(8),
        getReservedRewardOrder(supabase, user.id),
    ])

    if (activityError) {
        throw new Error(activityError.message)
    }

    if (pendingError) {
        throw new Error(pendingError.message)
    }

    if (expiringError) {
        throw new Error(expiringError.message)
    }

    return {
        activity: (activityRows ?? []).map((row) => ({
            availableBalanceAfter: toNumber(row.available_balance_after),
            createdAt: String(row.created_at ?? ""),
            debtBalanceAfter: toNumber(row.debt_balance_after),
            description: String(row.description ?? "Reward activity"),
            eventType: String(row.event_type ?? "activity"),
            id: String(row.id),
            pendingBalanceAfter: toNumber(row.pending_balance_after),
            pointsDelta: toNumber(row.points_delta),
            sourceId: toStringOrNull(row.source_id),
            sourceKind: toStringOrNull(row.source_kind),
        })),
        expiringLots: (expiringRows ?? []).map((row) => ({
            availableAt: toStringOrNull(row.available_at),
            createdAt: String(row.created_at ?? ""),
            description: toStringOrNull(row.description),
            expiresAt: toStringOrNull(row.expires_at),
            id: String(row.id),
            originalPoints: toNumber(row.original_points),
            remainingPoints: toNumber(row.remaining_points),
            sourceId: toStringOrNull(row.source_id),
            sourceKind: String(row.source_kind ?? "reward"),
            status: String(row.status ?? "available"),
        })),
        pendingLots: (pendingRows ?? []).map((row) => ({
            availableAt: toStringOrNull(row.available_at),
            createdAt: String(row.created_at ?? ""),
            description: toStringOrNull(row.description),
            expiresAt: toStringOrNull(row.expires_at),
            id: String(row.id),
            originalPoints: toNumber(row.original_points),
            remainingPoints: toNumber(row.remaining_points),
            sourceId: toStringOrNull(row.source_id),
            sourceKind: String(row.source_kind ?? "reward"),
            status: String(row.status ?? "pending"),
        })),
        reservedOrder,
        summary,
    }
}
