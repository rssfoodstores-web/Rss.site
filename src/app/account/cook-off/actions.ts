"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { deleteCookOffCloudinaryAsset } from "@/app/actions/cookOffMediaActions"
import {
    groupCookOffRankingsBySession,
    type CookOffEntryRow,
    type CookOffRankedEntry,
    type CookOffScoreboardRow,
    type CookOffSessionRow,
} from "@/lib/cookOff"
import { createClient } from "@/lib/supabase/server"

interface SaveCookOffEntryInput {
    cookingProcessVideoPublicId: string
    cookingProcessVideoUrl: string
    ingredients: string
    presentationVideoPublicId: string
    presentationVideoUrl: string
    recipeName: string
    submitterPhone: string
}

export interface CookOffProfileEntryViewModel {
    adminCreativityScore: number | null
    adminFeedback: string | null
    adminPresentationScore: number | null
    adminScore: number | null
    cookingProcessVideoPublicId: string
    cookingProcessVideoUrl: string
    createdAt: string
    entryCode: string
    finalScore: number | null
    id: string
    ingredients: string
    isEditable: boolean
    isFeatured: boolean
    presentationVideoPublicId: string
    presentationVideoUrl: string
    publicVoteScore: number | null
    rank: number | null
    recipeName: string
    reviewedAt: string | null
    sessionId: string
    sessionMonthLabel: string
    sessionSlug: string
    sessionStatus: string
    sessionTheme: string
    sessionTitle: string
    status: string
    submitterPhone: string | null
    voteCount: number
    winnerPosition: number | null
}

interface CookOffProfileData {
    activeEntry: CookOffProfileEntryViewModel | null
    activeSession: {
        ctaText: string
        id: string
        monthLabel: string
        slug: string
        summary: string | null
        theme: string
        title: string
    } | null
    history: CookOffProfileEntryViewModel[]
    leaderboard: CookOffRankedEntry[]
    profile: {
        email: string
        fullName: string
        phone: string | null
    }
    stats: {
        approvedEntries: number
        totalEntries: number
        wins: number
    }
}

function normalizeText(value: string) {
    return value.trim()
}

function validateCookOffEntryInput(input: SaveCookOffEntryInput) {
    const recipeName = normalizeText(input.recipeName)
    const ingredients = normalizeText(input.ingredients)
    const submitterPhone = normalizeText(input.submitterPhone)
    const cookingProcessVideoUrl = normalizeText(input.cookingProcessVideoUrl)
    const cookingProcessVideoPublicId = normalizeText(input.cookingProcessVideoPublicId)
    const presentationVideoUrl = normalizeText(input.presentationVideoUrl)
    const presentationVideoPublicId = normalizeText(input.presentationVideoPublicId)

    if (!recipeName) {
        throw new Error("Recipe name is required.")
    }

    if (!ingredients) {
        throw new Error("Ingredients are required.")
    }

    if (!submitterPhone) {
        throw new Error("A contact phone number is required.")
    }

    if (!cookingProcessVideoUrl || !cookingProcessVideoPublicId) {
        throw new Error("Upload the cooking process video before submitting.")
    }

    if (!presentationVideoUrl || !presentationVideoPublicId) {
        throw new Error("Upload the presentation video before submitting.")
    }

    return {
        cookingProcessVideoPublicId,
        cookingProcessVideoUrl,
        ingredients,
        presentationVideoPublicId,
        presentationVideoUrl,
        recipeName,
        submitterPhone,
    }
}

async function requireUser() {
    const supabase = await createClient()
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

function buildEntryViewModel(
    entry: CookOffEntryRow,
    session: CookOffSessionRow | undefined,
    ranking: CookOffRankedEntry | undefined
): CookOffProfileEntryViewModel {
    return {
        adminCreativityScore: ranking?.adminCreativityScore ?? entry.admin_creativity_score ?? null,
        adminFeedback: entry.admin_feedback ?? null,
        adminPresentationScore: ranking?.adminPresentationScore ?? entry.admin_presentation_score ?? null,
        adminScore: ranking?.adminScore ?? null,
        cookingProcessVideoPublicId: entry.cooking_process_video_public_id,
        cookingProcessVideoUrl: entry.cooking_process_video_url,
        createdAt: entry.created_at,
        entryCode: entry.entry_code,
        finalScore: ranking?.finalScore ?? null,
        id: entry.id,
        ingredients: entry.ingredients,
        isEditable: entry.status === "pending",
        isFeatured: ranking?.isFeatured ?? entry.is_featured,
        presentationVideoPublicId: entry.presentation_video_public_id,
        presentationVideoUrl: entry.presentation_video_url,
        publicVoteScore: ranking?.publicVoteScore ?? null,
        rank: ranking?.rank ?? null,
        recipeName: entry.recipe_name,
        reviewedAt: entry.reviewed_at,
        sessionId: entry.session_id,
        sessionMonthLabel: session?.month_label ?? "Cook-Off Session",
        sessionSlug: session?.slug ?? "",
        sessionStatus: session?.status ?? "archived",
        sessionTheme: session?.theme ?? "Monthly challenge",
        sessionTitle: session?.title ?? "Cook-Off",
        status: entry.status,
        submitterPhone: entry.submitter_phone,
        voteCount: ranking?.voteCount ?? 0,
        winnerPosition: ranking?.winnerPosition ?? entry.winner_position ?? null,
    }
}

async function getCookOffSessionsAndEntries(userId: string) {
    const supabase = await createClient()
    const [{ data: sessionsData, error: sessionsError }, { data: entriesData, error: entriesError }] = await Promise.all([
        supabase
            .from("cook_off_sessions")
            .select("*")
            .neq("status", "draft")
            .order("created_at", { ascending: false }),
        supabase
            .from("cook_off_entries")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false }),
    ])

    if (sessionsError) {
        throw new Error(sessionsError.message)
    }

    if (entriesError) {
        throw new Error(entriesError.message)
    }

    return {
        entries: (entriesData ?? []) as CookOffEntryRow[],
        sessions: (sessionsData ?? []) as CookOffSessionRow[],
    }
}

export async function getCookOffProfileData(): Promise<CookOffProfileData> {
    const { supabase, user } = await requireUser()
    const [{ data: profileData, error: profileError }, sessionAndEntryData] = await Promise.all([
        supabase
            .from("profiles")
            .select("full_name, phone")
            .eq("id", user.id)
            .single(),
        getCookOffSessionsAndEntries(user.id),
    ])

    if (profileError) {
        throw new Error(profileError.message)
    }

    const { entries, sessions } = sessionAndEntryData
    const activeSession = sessions.find((session) => session.status === "active") ?? null
    const sessionIds = Array.from(new Set(entries.map((entry) => entry.session_id).filter(Boolean)))
    const idsToRank = activeSession ? Array.from(new Set([...sessionIds, activeSession.id])) : sessionIds

    const { data: scoreboardData, error: scoreboardError } = idsToRank.length
        ? await supabase
            .from("cook_off_entry_scoreboard")
            .select("*")
            .in("session_id", idsToRank)
        : { data: [] as CookOffScoreboardRow[], error: null }

    if (scoreboardError) {
        throw new Error(scoreboardError.message)
    }

    const rankingBySession = groupCookOffRankingsBySession((scoreboardData ?? []) as CookOffScoreboardRow[])
    const sessionsById = new Map(sessions.map((session) => [session.id, session]))
    const rankingByEntryId = new Map(
        Array.from(rankingBySession.values()).flatMap((items) => items.map((entry) => [entry.entryId, entry]))
    )

    const history = entries.map((entry) =>
        buildEntryViewModel(entry, sessionsById.get(entry.session_id), rankingByEntryId.get(entry.id))
    )

    return {
        activeEntry: activeSession ? history.find((entry) => entry.sessionId === activeSession.id) ?? null : null,
        activeSession: activeSession
            ? {
                ctaText: activeSession.cta_text,
                id: activeSession.id,
                monthLabel: activeSession.month_label,
                slug: activeSession.slug,
                summary: activeSession.summary,
                theme: activeSession.theme,
                title: activeSession.title,
            }
            : null,
        history,
        leaderboard: activeSession ? (rankingBySession.get(activeSession.id) ?? []) : [],
        profile: {
            email: user.email ?? "",
            fullName: profileData.full_name,
            phone: profileData.phone,
        },
        stats: {
            approvedEntries: history.filter((entry) => entry.status === "approved").length,
            totalEntries: history.length,
            wins: history.filter((entry) => entry.winnerPosition !== null).length,
        },
    }
}

export async function submitCookOffEntry(input: SaveCookOffEntryInput) {
    const { supabase, user } = await requireUser()
    const normalizedInput = validateCookOffEntryInput(input)
    const [{ data: activeSession, error: sessionError }, { data: profileData, error: profileError }] = await Promise.all([
        supabase
            .from("cook_off_sessions")
            .select("*")
            .eq("status", "active")
            .maybeSingle(),
        supabase
            .from("profiles")
            .select("full_name")
            .eq("id", user.id)
            .single(),
    ])

    if (sessionError) {
        throw new Error(sessionError.message)
    }

    if (!activeSession) {
        throw new Error("There is no active Cook-Off session right now.")
    }

    if (profileError) {
        throw new Error(profileError.message)
    }

    if (!user.email) {
        throw new Error("Your account needs an email address before you can submit.")
    }

    const { data: existingEntry, error: existingEntryError } = await supabase
        .from("cook_off_entries")
        .select("id")
        .eq("session_id", activeSession.id)
        .eq("user_id", user.id)
        .maybeSingle()

    if (existingEntryError) {
        throw new Error(existingEntryError.message)
    }

    if (existingEntry) {
        throw new Error("You already have an entry in the active Cook-Off session.")
    }

    const { error: insertError } = await supabase.from("cook_off_entries").insert({
        cooking_process_video_public_id: normalizedInput.cookingProcessVideoPublicId,
        cooking_process_video_url: normalizedInput.cookingProcessVideoUrl,
        ingredients: normalizedInput.ingredients,
        presentation_video_public_id: normalizedInput.presentationVideoPublicId,
        presentation_video_url: normalizedInput.presentationVideoUrl,
        recipe_name: normalizedInput.recipeName,
        session_id: activeSession.id,
        submitter_email: user.email,
        submitter_name: profileData.full_name,
        submitter_phone: normalizedInput.submitterPhone,
        user_id: user.id,
    })

    if (insertError) {
        if (insertError.code === "23505") {
            throw new Error("You already have an entry in the active Cook-Off session.")
        }

        throw new Error(insertError.message)
    }

    revalidatePath("/account/cook-off")
    revalidatePath("/cook-off")
    revalidatePath("/admin/cook-off")

    return { success: true }
}

export async function updateCookOffEntry(entryId: string, input: SaveCookOffEntryInput) {
    const { supabase, user } = await requireUser()
    const normalizedInput = validateCookOffEntryInput(input)
    const { data: existingEntry, error: existingEntryError } = await supabase
        .from("cook_off_entries")
        .select("*")
        .eq("id", entryId)
        .eq("user_id", user.id)
        .maybeSingle()

    if (existingEntryError) {
        throw new Error(existingEntryError.message)
    }

    if (!existingEntry || existingEntry.status !== "pending") {
        throw new Error("Only pending Cook-Off entries can be edited.")
    }

    const { error: updateError } = await supabase
        .from("cook_off_entries")
        .update({
            cooking_process_video_public_id: normalizedInput.cookingProcessVideoPublicId,
            cooking_process_video_url: normalizedInput.cookingProcessVideoUrl,
            ingredients: normalizedInput.ingredients,
            presentation_video_public_id: normalizedInput.presentationVideoPublicId,
            presentation_video_url: normalizedInput.presentationVideoUrl,
            recipe_name: normalizedInput.recipeName,
            submitter_phone: normalizedInput.submitterPhone,
        })
        .eq("id", entryId)
        .eq("user_id", user.id)

    if (updateError) {
        throw new Error(updateError.message)
    }

    try {
        if (existingEntry.cooking_process_video_public_id !== normalizedInput.cookingProcessVideoPublicId) {
            await deleteCookOffCloudinaryAsset(existingEntry.cooking_process_video_public_id, "video")
        }

        if (existingEntry.presentation_video_public_id !== normalizedInput.presentationVideoPublicId) {
            await deleteCookOffCloudinaryAsset(existingEntry.presentation_video_public_id, "video")
        }
    } catch {
    }

    revalidatePath("/account/cook-off")
    revalidatePath("/cook-off")
    revalidatePath("/admin/cook-off")

    return { success: true }
}

export async function deleteCookOffEntry(entryId: string) {
    const { supabase, user } = await requireUser()
    const { data: existingEntry, error: existingEntryError } = await supabase
        .from("cook_off_entries")
        .select("*")
        .eq("id", entryId)
        .eq("user_id", user.id)
        .maybeSingle()

    if (existingEntryError) {
        throw new Error(existingEntryError.message)
    }

    if (!existingEntry || existingEntry.status !== "pending") {
        throw new Error("Only pending Cook-Off entries can be deleted.")
    }

    const { error: deleteError } = await supabase
        .from("cook_off_entries")
        .delete()
        .eq("id", entryId)
        .eq("user_id", user.id)

    if (deleteError) {
        throw new Error(deleteError.message)
    }

    try {
        await deleteCookOffCloudinaryAsset(existingEntry.cooking_process_video_public_id, "video")
        await deleteCookOffCloudinaryAsset(existingEntry.presentation_video_public_id, "video")
    } catch {
    }

    revalidatePath("/account/cook-off")
    revalidatePath("/cook-off")
    revalidatePath("/admin/cook-off")

    return { success: true }
}
