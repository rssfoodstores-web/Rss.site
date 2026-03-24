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
import { koboToNaira } from "@/lib/money"
import type { Json, Tables } from "@/types/database.types"

type GiftCardRow = Tables<"gift_cards">
type GiftCardTransactionRow = Tables<"gift_card_transactions">

type RpcPayload = {
    success?: boolean
    error?: string
    [key: string]: Json | undefined
}

interface GiftCardViewModel {
    id: string
    code: string
    amountKobo: number
    remainingAmountKobo: number
    status: string
    paymentMethod: string
    paymentReference: string
    recipientEmail: string
    message: string | null
    createdAt: string
    deliveredAt: string | null
    lastUsedAt: string | null
    direction: "sent" | "received"
    counterpartyName: string | null
    counterpartyId: string
    isSpendable: boolean
}

interface GiftCardActivityViewModel {
    id: string
    giftCardId: string
    code: string | null
    transactionType: string
    amountKobo: number
    description: string
    reference: string | null
    createdAt: string
}

function normalizeEmail(value: string) {
    return value.trim().toLowerCase()
}

function getRpcPayload(data: unknown): RpcPayload {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        return {}
    }

    return data as RpcPayload
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

async function invokeMonnifyInit(
    supabase: Awaited<ReturnType<typeof getSupabase>>,
    body: Record<string, unknown>
) {
    const primaryResult = await supabase.functions.invoke("monnify-init", { body })

    if (!primaryResult.error) {
        return primaryResult
    }

    const message = await getEdgeFunctionErrorMessage(primaryResult.error)

    if (shouldRetryWithAnon(primaryResult.error, message)) {
        const fallbackResult = await getEdgeFunctionClient().functions.invoke("monnify-init", { body })

        if (fallbackResult.error) {
            throw new Error(await getEdgeFunctionErrorMessage(fallbackResult.error))
        }

        return fallbackResult
    }

    throw new Error(message)
}

export async function verifyGiftCardRecipient(email: string) {
    const normalizedEmail = normalizeEmail(email)

    if (!normalizedEmail) {
        return { success: false, error: "Recipient email is required." }
    }

    const supabase = await getSupabase()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return { success: false, error: "Authentication required." }
    }

    const { data, error } = await supabase.rpc("lookup_gift_card_recipient", {
        p_email: normalizedEmail,
    })

    if (error) {
        return { success: false, error: error.message }
    }

    const payload = getRpcPayload(data)

    if (!payload.success) {
        return {
            success: false,
            error: typeof payload.error === "string" ? payload.error : "No account was found for that email.",
        }
    }

    return {
        success: true,
        recipient: {
            id: String(payload.user_id ?? ""),
            email: String(payload.email ?? normalizedEmail),
            fullName: typeof payload.full_name === "string" ? payload.full_name : "RSS Foods User",
            isSelf: normalizeEmail(user.email ?? "") === normalizedEmail,
        },
    }
}

export async function getGiftCardData() {
    const supabase = await getSupabase()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return {
            success: false,
            error: "Authentication required.",
            cards: [] as GiftCardViewModel[],
            activity: [] as GiftCardActivityViewModel[],
            summary: {
                availableBalanceKobo: 0,
                activeCount: 0,
                sentCount: 0,
                receivedCount: 0,
            },
        }
    }

    const { data: cardsData, error: cardsError } = await supabase
        .from("gift_cards")
        .select("*")
        .or(`purchaser_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order("created_at", { ascending: false })

    if (cardsError) {
        return {
            success: false,
            error: cardsError.message,
            cards: [] as GiftCardViewModel[],
            activity: [] as GiftCardActivityViewModel[],
            summary: {
                availableBalanceKobo: 0,
                activeCount: 0,
                sentCount: 0,
                receivedCount: 0,
            },
        }
    }

    const cards = (cardsData ?? []) as GiftCardRow[]
    const cardIds = cards.map((card) => card.id)
    const profileIds = Array.from(new Set(cards.flatMap((card) => [card.purchaser_id, card.recipient_id])))

    const [{ data: profilesData }, transactionsResult] = await Promise.all([
        profileIds.length
            ? supabase
                .from("profiles")
                .select("id, full_name")
                .in("id", profileIds)
            : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null }> }),
        cardIds.length
            ? supabase
                .from("gift_card_transactions")
                .select("*")
                .in("gift_card_id", cardIds)
                .order("created_at", { ascending: false })
                .limit(40)
            : Promise.resolve({ data: [] as GiftCardTransactionRow[] }),
    ])

    const profilesById = new Map(
        ((profilesData ?? []) as Array<{ id: string; full_name: string | null }>).map((profile) => [
            profile.id,
            profile.full_name,
        ])
    )
    const cardsById = new Map(cards.map((card) => [card.id, card]))

    const cardViewModels: GiftCardViewModel[] = cards.map((card) => {
        const direction = card.recipient_id === user.id ? "received" : "sent"
        const counterpartyId = direction === "received" ? card.purchaser_id : card.recipient_id
        const counterpartyName = profilesById.get(counterpartyId) ?? null
        const isSpendable =
            direction === "received" &&
            card.status === "active" &&
            (card.remaining_amount_kobo ?? 0) > 0 &&
            (!card.expires_at || new Date(card.expires_at).getTime() > Date.now())

        return {
            id: card.id,
            code: card.code,
            amountKobo: card.amount_kobo,
            remainingAmountKobo: card.remaining_amount_kobo,
            status: card.status,
            paymentMethod: card.payment_method,
            paymentReference: card.payment_reference,
            recipientEmail: card.recipient_email,
            message: card.message,
            createdAt: card.created_at,
            deliveredAt: card.delivered_at,
            lastUsedAt: card.last_used_at,
            direction,
            counterpartyName,
            counterpartyId,
            isSpendable,
        }
    })

    const activity: GiftCardActivityViewModel[] = ((transactionsResult.data ?? []) as GiftCardTransactionRow[]).map((transaction) => {
        const giftCard = cardsById.get(transaction.gift_card_id)

        return {
            id: transaction.id,
            giftCardId: transaction.gift_card_id,
            code: giftCard?.code ?? null,
            transactionType: transaction.transaction_type,
            amountKobo: transaction.amount_kobo,
            description: transaction.description,
            reference: transaction.reference,
            createdAt: transaction.created_at,
        }
    })

    const receivedCards = cardViewModels.filter((card) => card.direction === "received")
    const sentCards = cardViewModels.filter((card) => card.direction === "sent")

    return {
        success: true,
        cards: cardViewModels,
        activity,
        summary: {
            availableBalanceKobo: receivedCards.reduce(
                (total, card) => total + (card.isSpendable ? card.remainingAmountKobo : 0),
                0
            ),
            activeCount: receivedCards.filter((card) => card.isSpendable).length,
            sentCount: sentCards.length,
            receivedCount: receivedCards.length,
        },
    }
}

export async function getGiftCardCheckoutSummary() {
    const supabase = await getSupabase()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return {
            success: false,
            availableBalanceKobo: 0,
            activeCount: 0,
            error: "Authentication required.",
        }
    }

    const { data, error } = await supabase
        .from("gift_cards")
        .select("remaining_amount_kobo, status, expires_at")
        .eq("recipient_id", user.id)

    if (error) {
        return {
            success: false,
            availableBalanceKobo: 0,
            activeCount: 0,
            error: error.message,
        }
    }

    const activeCards = ((data ?? []) as Array<Pick<GiftCardRow, "remaining_amount_kobo" | "status" | "expires_at">>).filter((card) =>
        card.status === "active" &&
        (card.remaining_amount_kobo ?? 0) > 0 &&
        (!card.expires_at || new Date(card.expires_at).getTime() > Date.now())
    )

    return {
        success: true,
        availableBalanceKobo: activeCards.reduce((total, card) => total + (card.remaining_amount_kobo ?? 0), 0),
        activeCount: activeCards.length,
    }
}

export async function buyGiftCardWithWallet(input: {
    recipientEmail: string
    amountKobo: number
    message?: string
}) {
    const recipientEmail = normalizeEmail(input.recipientEmail)
    const amountKobo = Math.max(0, Math.floor(input.amountKobo))

    if (!recipientEmail) {
        return { success: false, error: "Recipient email is required." }
    }

    if (!amountKobo) {
        return { success: false, error: "Please enter a valid gift card amount." }
    }

    const supabase = await getSupabase()
    const { data, error } = await supabase.rpc("purchase_gift_card_with_wallet", {
        p_recipient_email: recipientEmail,
        p_amount_kobo: amountKobo,
        p_message: input.message?.trim() || null,
    })

    if (error) {
        return { success: false, error: error.message }
    }

    const payload = getRpcPayload(data)

    if (!payload.success) {
        return {
            success: false,
            error: typeof payload.error === "string" ? payload.error : "Unable to purchase gift card.",
        }
    }

    revalidatePath("/account/gift-card")
    revalidatePath("/account/wallet")
    revalidatePath("/account/notifications")

    return {
        success: true,
        giftCardId: String(payload.gift_card_id ?? ""),
        code: typeof payload.code === "string" ? payload.code : null,
    }
}

export async function buyGiftCardWithDirectPayment(input: {
    recipientEmail: string
    amountKobo: number
    message?: string
}) {
    const recipientEmail = normalizeEmail(input.recipientEmail)
    const amountKobo = Math.max(0, Math.floor(input.amountKobo))

    if (!recipientEmail) {
        return { success: false, error: "Recipient email is required." }
    }

    if (!amountKobo) {
        return { success: false, error: "Please enter a valid gift card amount." }
    }

    const supabase = await getSupabase()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return { success: false, error: "Authentication required." }
    }

    const { data, error } = await supabase.rpc("create_pending_gift_card_purchase", {
        p_recipient_email: recipientEmail,
        p_amount_kobo: amountKobo,
        p_message: input.message?.trim() || null,
    })

    if (error) {
        return { success: false, error: error.message }
    }

    const payload = getRpcPayload(data)

    if (!payload.success) {
        return {
            success: false,
            error: typeof payload.error === "string" ? payload.error : "Unable to initialize gift card payment.",
        }
    }

    const giftCardId = String(payload.gift_card_id ?? "")
    const paymentReference = String(payload.payment_reference ?? "")
    const recipientName = typeof payload.recipient_name === "string" ? payload.recipient_name : recipientEmail

    if (!giftCardId || !paymentReference) {
        return { success: false, error: "Gift card payment setup did not return a reference." }
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single()

    let functionResult: {
        checkoutUrl?: string
        checkout_url?: string
    }

    try {
        const response = await invokeMonnifyInit(supabase, {
            amount: koboToNaira(amountKobo),
            customerName: profile?.full_name ?? "RSS Foods Customer",
            customerEmail: user.email,
            paymentReference,
            paymentDescription: `Gift card for ${recipientName}`,
            redirectPath: `/account/gift-card?ref=${paymentReference}`,
            metadata: {
                type: "gift_card_purchase",
                gift_card_id: giftCardId,
                recipient_email: recipientEmail,
                amount_kobo: amountKobo,
            },
        })

        functionResult = response.data ?? {}
    } catch (invokeError) {
        return {
            success: false,
            error: invokeError instanceof Error ? invokeError.message : "Unable to initialize direct payment.",
        }
    }

    revalidatePath("/account/gift-card")

    return {
        success: true,
        checkoutUrl: functionResult.checkoutUrl ?? functionResult.checkout_url,
        reference: paymentReference,
    }
}
