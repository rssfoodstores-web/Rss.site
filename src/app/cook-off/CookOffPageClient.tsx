"use client"

import { useMemo, useState, useTransition } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
    ChevronRight,
    Flame,
    Loader2,
    PlayCircle,
    Sparkles,
    Trophy,
    Users,
    Vote,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { CookOffRankedEntry } from "@/lib/cookOff"
import { castCookOffVoteAction } from "./actions"

interface SessionOption {
    id: string
    monthLabel: string
    slug: string
    status: string
    title: string
}

interface SelectedSessionViewModel {
    ctaText: string
    description: string | null
    heroMediaType: string | null
    heroMediaUrl: string | null
    id: string
    monthLabel: string
    prizes: string | null
    rules: string | null
    slug: string
    status: string
    summary: string | null
    theme: string
    title: string
}

interface CookOffPageClientProps {
    currentUserId: string | null
    entries: CookOffRankedEntry[]
    featuredCount: number
    selectedSession: SelectedSessionViewModel
    sessionOptions: SessionOption[]
    totalVotes: number
    votedEntryId: string | null
}

const entriesPerPage = 6

function splitParagraphs(text: string | null) {
    return (text ?? "")
        .split(/\n{2,}/)
        .map((chunk) => chunk.trim())
        .filter(Boolean)
}

function formatDate(value: string | null) {
    if (!value) {
        return "Recently submitted"
    }

    return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value))
}

function getWinnerTone(position: number | null) {
    if (position === 1) {
        return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300"
    }

    if (position === 2) {
        return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-300"
    }

    if (position === 3) {
        return "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/40 dark:bg-orange-950/20 dark:text-orange-300"
    }

    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300"
}

function EntryCard({
    currentUserId,
    entry,
    isVotingDisabled,
    onVote,
    selectedSessionSlug,
    votedEntryId,
    voting,
}: {
    currentUserId: string | null
    entry: CookOffRankedEntry
    isVotingDisabled: boolean
    onVote: (entryId: string) => void
    selectedSessionSlug: string
    votedEntryId: string | null
    voting: boolean
}) {
    const isOwner = currentUserId === entry.userId
    const alreadyVotedForThisEntry = votedEntryId === entry.entryId
    const loginPath = `/login?next=${encodeURIComponent(`/cook-off?session=${selectedSessionSlug}`)}`

    return (
        <article className="overflow-hidden rounded-[2rem] border border-gray-100 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="grid gap-4 border-b border-gray-100 p-4 dark:border-zinc-800 md:grid-cols-2">
                <div className="relative overflow-hidden rounded-[1.5rem] bg-black/90">
                    <video controls className="aspect-video h-full w-full object-cover" src={entry.presentationVideoUrl ?? undefined} />
                    <div className="pointer-events-none absolute left-3 top-3">
                        <Badge className="border-transparent bg-black/65 text-white hover:bg-black/65">Presentation</Badge>
                    </div>
                </div>
                <div className="relative overflow-hidden rounded-[1.5rem] bg-black/90">
                    <video controls className="aspect-video h-full w-full object-cover" src={entry.cookingProcessVideoUrl ?? undefined} />
                    <div className="pointer-events-none absolute left-3 top-3">
                        <Badge className="border-transparent bg-black/65 text-white hover:bg-black/65">Cooking process</Badge>
                    </div>
                </div>
            </div>

            <div className="space-y-4 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">{entry.recipeName}</h3>
                            {entry.isFeatured ? (
                                <Badge className="border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/40 dark:bg-violet-950/20 dark:text-violet-300">
                                    Featured
                                </Badge>
                            ) : null}
                            {entry.winnerPosition ? (
                                <Badge className={getWinnerTone(entry.winnerPosition)}>Winner #{entry.winnerPosition}</Badge>
                            ) : null}
                            {isOwner ? (
                                <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
                                    Your entry
                                </Badge>
                            ) : null}
                        </div>
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                            {entry.submitterName} - Entry {entry.entryCode} - {formatDate(entry.createdAt)}
                        </p>
                    </div>
                    <div className="rounded-2xl bg-orange-50 px-4 py-3 text-center text-[#F58220] dark:bg-orange-950/20 dark:text-orange-300">
                        <p className="text-xs font-bold uppercase tracking-[0.18em]">Rank</p>
                        <p className="mt-1 text-2xl font-extrabold">#{entry.rank}</p>
                    </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                    {[
                        { label: "Votes", value: String(entry.voteCount) },
                        { label: "Admin score", value: entry.adminScore?.toFixed(2) ?? "Pending" },
                        { label: "Final score", value: entry.finalScore.toFixed(2) },
                    ].map((metric) => (
                        <div key={metric.label} className="rounded-2xl border border-gray-100 bg-gray-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-400">{metric.label}</p>
                            <p className="mt-2 text-xl font-extrabold text-gray-900 dark:text-white">{metric.value}</p>
                        </div>
                    ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                        Final score uses 60% admin score and 40% public vote score.
                    </div>

                    {currentUserId ? (
                        <Button
                            type="button"
                            onClick={() => onVote(entry.entryId)}
                            disabled={voting || isVotingDisabled || isOwner}
                            className={cn(
                                "rounded-full px-6",
                                alreadyVotedForThisEntry ? "bg-emerald-600 hover:bg-emerald-600" : "bg-[#F58220] hover:bg-[#d86a12]"
                            )}
                        >
                            {voting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Voting
                                </>
                            ) : alreadyVotedForThisEntry ? (
                                <>
                                    <Vote className="mr-2 h-4 w-4" />
                                    Vote recorded
                                </>
                            ) : isOwner ? (
                                "You cannot vote for yourself"
                            ) : isVotingDisabled ? (
                                "Vote used this session"
                            ) : (
                                <>
                                    <Vote className="mr-2 h-4 w-4" />
                                    Vote for this entry
                                </>
                            )}
                        </Button>
                    ) : (
                        <Button asChild className="rounded-full bg-[#F58220] hover:bg-[#d86a12]">
                            <Link href={loginPath}>Log in to vote</Link>
                        </Button>
                    )}
                </div>
            </div>
        </article>
    )
}

export function CookOffPageClient({
    currentUserId,
    entries,
    featuredCount,
    selectedSession,
    sessionOptions,
    totalVotes,
    votedEntryId,
}: CookOffPageClientProps) {
    const router = useRouter()
    const [currentPage, setCurrentPage] = useState(1)
    const [pendingVoteEntryId, setPendingVoteEntryId] = useState<string | null>(null)
    const [isVotingPending, startVotingTransition] = useTransition()

    const topEntries = entries.slice(0, 5)
    const totalPages = Math.max(1, Math.ceil(entries.length / entriesPerPage))
    const paginatedEntries = useMemo(() => {
        const start = (currentPage - 1) * entriesPerPage
        return entries.slice(start, start + entriesPerPage)
    }, [currentPage, entries])

    const handleVote = (entryId: string) => {
        if (votedEntryId) {
            toast.error("You have already used your vote for this Cook-Off session.")
            return
        }

        setPendingVoteEntryId(entryId)
        startVotingTransition(() => {
            void (async () => {
                const result = await castCookOffVoteAction(entryId)
                if (!result.success) {
                    toast.error(result.error ?? "Unable to submit your vote.")
                    setPendingVoteEntryId(null)
                    return
                }

                toast.success("Your vote has been recorded.")
                router.refresh()
            })()
        })
    }

    return (
        <div className="min-h-screen bg-gray-50/50 py-8 dark:bg-black lg:py-12">
            <div className="container mx-auto space-y-8 px-4 lg:px-6">
                <section className="overflow-hidden rounded-[2.5rem] border border-gray-100 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="grid gap-8 p-6 lg:grid-cols-[1.05fr_0.95fr] lg:p-8">
                        <div className="space-y-6">
                            <Badge className="border-orange-200 bg-orange-50 text-[#F58220] dark:border-orange-900/40 dark:bg-orange-950/20 dark:text-orange-300">
                                {selectedSession.monthLabel}
                            </Badge>

                            <div>
                                <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white md:text-5xl">
                                    {selectedSession.title}
                                </h1>
                                <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
                                    Theme: <span className="font-semibold text-gray-900 dark:text-white">{selectedSession.theme}</span>
                                </p>
                                {selectedSession.summary ? (
                                    <p className="mt-4 max-w-2xl text-base leading-7 text-gray-500 dark:text-gray-400">
                                        {selectedSession.summary}
                                    </p>
                                ) : null}
                            </div>

                            <div className="grid gap-4 sm:grid-cols-3">
                                {[
                                    { icon: Users, label: "Approved entries", value: entries.length, tone: "text-[#F58220]" },
                                    { icon: Vote, label: "Votes cast", value: totalVotes, tone: "text-violet-700 dark:text-violet-300" },
                                    { icon: Sparkles, label: "Featured entries", value: featuredCount, tone: "text-emerald-600" },
                                ].map((item) => (
                                    <div key={item.label} className="rounded-[1.75rem] border border-gray-100 bg-gray-50/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/40">
                                        <item.icon className={cn("h-5 w-5", item.tone)} />
                                        <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-gray-400">{item.label}</p>
                                        <p className="mt-2 text-3xl font-extrabold text-gray-900 dark:text-white">{item.value}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                <Button asChild className="rounded-full bg-[#F58220] px-7 hover:bg-[#d86a12]">
                                    <Link href="/account/cook-off">
                                        {selectedSession.ctaText || "Submit your entry"}
                                        <ChevronRight className="ml-2 h-4 w-4" />
                                    </Link>
                                </Button>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    One public vote is allowed per user for each Cook-Off session.
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-3">
                                {sessionOptions.map((session) => (
                                    <Link
                                        key={session.id}
                                        href={`/cook-off?session=${session.slug}`}
                                        className={cn(
                                            "rounded-full border px-4 py-2 text-sm font-semibold transition",
                                            session.slug === selectedSession.slug
                                                ? "border-[#F58220] bg-[#F58220] text-white"
                                                : "border-gray-200 bg-white text-gray-600 hover:border-[#F58220]/40 hover:text-[#F58220] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                                        )}
                                    >
                                        {session.monthLabel}
                                    </Link>
                                ))}
                            </div>
                        </div>

                        <div className="relative overflow-hidden rounded-[2rem] bg-[#0F392B]">
                            {selectedSession.heroMediaUrl ? (
                                selectedSession.heroMediaType === "video" ? (
                                    <video autoPlay loop muted playsInline className="absolute inset-0 h-full w-full object-cover" src={selectedSession.heroMediaUrl} />
                                ) : (
                                    <Image
                                        src={selectedSession.heroMediaUrl}
                                        alt={selectedSession.title}
                                        fill
                                        sizes="(max-width: 1024px) 100vw, 45vw"
                                        className="object-cover"
                                    />
                                )
                            ) : (
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(245,130,32,0.55),_transparent_38%),linear-gradient(135deg,_#0F392B,_#1F6A4B)]" />
                            )}

                            <div className="relative z-10 flex min-h-[420px] flex-col justify-end bg-gradient-to-t from-[#071B14] via-[#071B14]/55 to-transparent p-8">
                                <div className="max-w-lg rounded-[1.75rem] border border-white/10 bg-black/25 p-6 text-white backdrop-blur-sm">
                                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-orange-200">Monthly challenge</p>
                                    <p className="mt-3 text-3xl font-extrabold">{selectedSession.theme}</p>
                                    <p className="mt-3 text-sm leading-6 text-white/80">
                                        Vote for standout entries, follow the leaderboard, and keep the monthly challenge moving.
                                    </p>
                                    <div className="mt-5 flex items-center gap-2 text-sm text-white/85">
                                        <PlayCircle className="h-4 w-4" />
                                        Video submissions only
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                    <div className="overflow-hidden rounded-[2rem] border border-gray-100 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                        <div className="border-b border-gray-100 px-6 py-5 dark:border-zinc-800">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Challenge details</h2>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                Rules, theme notes, and session information published by the admin.
                            </p>
                        </div>

                        <div className="space-y-6 p-6">
                            {[
                                { label: "Description", value: selectedSession.description, tone: "" },
                                { label: "Rules", value: selectedSession.rules, tone: "" },
                                {
                                    label: "Rewards",
                                    value: selectedSession.prizes,
                                    tone: "rounded-[1.75rem] border border-orange-100 bg-orange-50/70 p-5 dark:border-orange-900/40 dark:bg-orange-950/10",
                                },
                            ].map((section) =>
                                splitParagraphs(section.value).length > 0 ? (
                                    <div key={section.label} className={cn("space-y-3", section.tone)}>
                                        <p className={cn("text-xs font-bold uppercase tracking-[0.18em]", section.label === "Rewards" ? "text-orange-500 dark:text-orange-300" : "text-gray-400")}>
                                            {section.label}
                                        </p>
                                        {splitParagraphs(section.value).map((paragraph) => (
                                            <p key={paragraph} className="text-sm leading-7 text-gray-600 dark:text-gray-300">
                                                {paragraph}
                                            </p>
                                        ))}
                                    </div>
                                ) : null
                            )}
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-[2rem] border border-gray-100 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                        <div className="border-b border-gray-100 px-6 py-5 dark:border-zinc-800">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Leaderboard</h2>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                Ranking combines admin judging and public votes for this session.
                            </p>
                        </div>

                        {topEntries.length === 0 ? (
                            <div className="p-10 text-center text-sm text-gray-500 dark:text-gray-400">
                                Approved entries will appear here after admin review.
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100 dark:divide-zinc-800">
                                {topEntries.map((entry) => (
                                    <div key={entry.entryId} className="flex items-center justify-between gap-4 px-6 py-4">
                                        <div className="flex items-center gap-4">
                                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-sm font-extrabold text-gray-700 dark:bg-zinc-800 dark:text-white">
                                                #{entry.rank}
                                            </div>
                                            <div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="font-semibold text-gray-900 dark:text-white">{entry.recipeName}</p>
                                                    {entry.winnerPosition ? (
                                                        <Badge className={getWinnerTone(entry.winnerPosition)}>Winner #{entry.winnerPosition}</Badge>
                                                    ) : null}
                                                </div>
                                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{entry.submitterName}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-lg font-extrabold text-[#F58220]">{entry.finalScore.toFixed(2)}</p>
                                            <p className="text-xs uppercase tracking-[0.16em] text-gray-400">{entry.voteCount} votes</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>

                <section className="space-y-6">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Approved entries</h2>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                Browse every approved Cook-Off submission for this session.
                            </p>
                        </div>
                        {entries.length > entriesPerPage ? (
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                Page {currentPage} of {Math.max(1, Math.ceil(entries.length / entriesPerPage))}
                            </div>
                        ) : null}
                    </div>

                    {paginatedEntries.length === 0 ? (
                        <div className="rounded-[2rem] border border-dashed border-gray-200 bg-white p-10 text-center text-sm text-gray-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-gray-400">
                            No approved entries have been published yet for this session.
                        </div>
                    ) : (
                        <div className="grid gap-6">
                            {paginatedEntries.map((entry) => (
                                <EntryCard
                                    key={entry.entryId}
                                    currentUserId={currentUserId}
                                    entry={entry}
                                    isVotingDisabled={Boolean(votedEntryId)}
                                    onVote={handleVote}
                                    selectedSessionSlug={selectedSession.slug}
                                    votedEntryId={votedEntryId}
                                    voting={isVotingPending && pendingVoteEntryId === entry.entryId}
                                />
                            ))}
                        </div>
                    )}

                    {entries.length > entriesPerPage ? (
                        <div className="flex items-center justify-center gap-3">
                            <Button type="button" variant="outline" disabled={currentPage === 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} className="rounded-full">
                                Previous
                            </Button>
                            <Button type="button" variant="outline" disabled={currentPage === totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} className="rounded-full">
                                Next
                            </Button>
                        </div>
                    ) : null}
                </section>

                <section className="rounded-[2.5rem] border border-gray-100 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <div className="flex items-center gap-2 text-sm font-semibold text-[#F58220]">
                                <Flame className="h-4 w-4" />
                                Join the next submission round
                            </div>
                            <h2 className="mt-3 text-3xl font-extrabold text-gray-900 dark:text-white">Ready to enter the Cook-Off?</h2>
                            <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-500 dark:text-gray-400">
                                Submit your recipe, cooking process video, and presentation video from your profile dashboard. Admin feedback, scores, and ranking will appear there after review.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <Button asChild className="rounded-full bg-[#F58220] px-7 hover:bg-[#d86a12]">
                                <Link href="/account/cook-off">
                                    Go to my Cook-Off page
                                    <ChevronRight className="ml-2 h-4 w-4" />
                                </Link>
                            </Button>
                            <Button asChild variant="outline" className="rounded-full">
                                <Link href="/account/notifications">
                                    View challenge notifications
                                    <Trophy className="ml-2 h-4 w-4" />
                                </Link>
                            </Button>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    )
}
