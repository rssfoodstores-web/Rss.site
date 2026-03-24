import { createClient } from "@/lib/supabase/server"
import type { CookOffSessionRow, CookOffScoreboardRow } from "@/lib/cookOff"
import { toCookOffRankedEntries } from "@/lib/cookOff"
import { CookOffPageClient } from "./CookOffPageClient"

export const dynamic = "force-dynamic"

interface CookOffPageProps {
    searchParams: Promise<{ session?: string }>
}

function normalizeSessionParam(value: string | undefined) {
    return value?.trim().toLowerCase() ?? ""
}

export default async function CookOffPage({ searchParams }: CookOffPageProps) {
    const { session: sessionParam } = await searchParams
    const requestedSlug = normalizeSessionParam(sessionParam)
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    const { data: sessionsData, error: sessionsError } = await supabase
        .from("cook_off_sessions")
        .select("*")
        .neq("status", "draft")
        .order("created_at", { ascending: false })

    if (sessionsError) {
        throw new Error(sessionsError.message)
    }

    const sessions = (sessionsData ?? []) as CookOffSessionRow[]
    const selectedSession =
        sessions.find((session) => session.slug === requestedSlug) ??
        sessions.find((session) => session.status === "active") ??
        sessions[0] ??
        null

    if (!selectedSession) {
        return (
            <div className="min-h-screen bg-gray-50/50 py-10 dark:bg-black">
                <div className="container mx-auto px-4 lg:px-6">
                    <div className="rounded-[2rem] border border-dashed border-gray-200 bg-white p-10 text-center dark:border-zinc-800 dark:bg-zinc-900">
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Cook-Off Challenge</h1>
                        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                            No Cook-Off session has been published yet. Once an admin activates a monthly challenge, it will appear here.
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    const [{ data: scoreboardData, error: scoreboardError }, voteResult] = await Promise.all([
        supabase
            .from("cook_off_entry_scoreboard")
            .select("*")
            .eq("session_id", selectedSession.id),
        user
            ? supabase
                .from("cook_off_votes")
                .select("entry_id")
                .eq("session_id", selectedSession.id)
                .eq("voter_id", user.id)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
    ])

    if (scoreboardError) {
        throw new Error(scoreboardError.message)
    }

    const entries = toCookOffRankedEntries((scoreboardData ?? []) as CookOffScoreboardRow[])
    const totalVotes = entries.reduce((sum, entry) => sum + entry.voteCount, 0)
    const featuredCount = entries.filter((entry) => entry.isFeatured).length

    return (
        <CookOffPageClient
            currentUserId={user?.id ?? null}
            entries={entries}
            featuredCount={featuredCount}
            selectedSession={{
                ctaText: selectedSession.cta_text,
                description: selectedSession.description,
                heroMediaType: selectedSession.hero_media_type,
                heroMediaUrl: selectedSession.hero_media_url,
                id: selectedSession.id,
                monthLabel: selectedSession.month_label,
                prizes: selectedSession.prizes,
                rules: selectedSession.rules,
                slug: selectedSession.slug,
                status: selectedSession.status,
                summary: selectedSession.summary,
                theme: selectedSession.theme,
                title: selectedSession.title,
            }}
            sessionOptions={sessions.map((session) => ({
                id: session.id,
                monthLabel: session.month_label,
                slug: session.slug,
                status: session.status,
                title: session.title,
            }))}
            totalVotes={totalVotes}
            votedEntryId={voteResult.data?.entry_id ?? null}
        />
    )
}
