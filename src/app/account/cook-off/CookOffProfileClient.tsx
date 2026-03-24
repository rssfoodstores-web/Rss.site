"use client"

import { useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
    AlertCircle,
    ChevronRight,
    Loader2,
    ShieldCheck,
    Trash2,
    Trophy,
    Upload,
    Video,
} from "lucide-react"
import { toast } from "sonner"
import { cleanupCookOffUploadedAsset, createCookOffEntryUploadSignature } from "@/app/actions/cookOffMediaActions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { uploadSignedCloudinaryAsset } from "@/lib/cloudinaryMediaUpload"
import { cn } from "@/lib/utils"
import { formatCookOffEntryStatus } from "@/lib/cookOff"
import type { getCookOffProfileData } from "./actions"
import { deleteCookOffEntry, submitCookOffEntry, updateCookOffEntry } from "./actions"

type CookOffProfileData = Awaited<ReturnType<typeof getCookOffProfileData>>
type EntryViewModel = CookOffProfileData["history"][number]

interface UploadedAsset {
    publicId: string
    url: string
}

function buildFormState(entry: EntryViewModel | null, phone: string | null) {
    return {
        cookingProcessVideoPublicId: entry?.cookingProcessVideoPublicId ?? "",
        cookingProcessVideoUrl: entry?.cookingProcessVideoUrl ?? "",
        ingredients: entry?.ingredients ?? "",
        presentationVideoPublicId: entry?.presentationVideoPublicId ?? "",
        presentationVideoUrl: entry?.presentationVideoUrl ?? "",
        recipeName: entry?.recipeName ?? "",
        submitterPhone: entry?.submitterPhone ?? phone ?? "",
    }
}

function getStatusTone(status: string) {
    if (status === "approved") {
        return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300"
    }

    if (status === "rejected") {
        return "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300"
    }

    return "border-orange-200 bg-orange-50 text-[#F58220] dark:border-orange-900/40 dark:bg-orange-950/20 dark:text-orange-300"
}

function formatDate(value: string | null) {
    if (!value) {
        return "Not yet"
    }

    return new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(value))
}

function HistoryCard({ entry }: { entry: EntryViewModel }) {
    return (
        <article className="rounded-[2rem] border border-gray-100 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{entry.recipeName}</h3>
                        <Badge className={getStatusTone(entry.status)}>{formatCookOffEntryStatus(entry.status)}</Badge>
                        {entry.isFeatured ? (
                            <Badge className="border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/40 dark:bg-violet-950/20 dark:text-violet-300">
                                Featured
                            </Badge>
                        ) : null}
                        {entry.winnerPosition ? (
                            <Badge className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                                Winner #{entry.winnerPosition}
                            </Badge>
                        ) : null}
                    </div>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        {entry.sessionMonthLabel} - {entry.sessionTitle} - Entry {entry.entryCode}
                    </p>
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">{formatDate(entry.createdAt)}</div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-4">
                {[
                    { label: "Votes", value: entry.voteCount },
                    { label: "Rank", value: entry.rank ?? "-" },
                    { label: "Admin score", value: entry.adminScore?.toFixed(2) ?? "Pending" },
                    { label: "Final score", value: entry.finalScore?.toFixed(2) ?? "Pending" },
                ].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-gray-100 bg-gray-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-400">{item.label}</p>
                        <p className="mt-2 text-lg font-extrabold text-gray-900 dark:text-white">{item.value}</p>
                    </div>
                ))}
            </div>

            {entry.adminFeedback ? (
                <div className="mt-5 rounded-[1.5rem] border border-gray-100 bg-gray-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-400">Admin feedback</p>
                    <p className="mt-2 text-sm leading-7 text-gray-600 dark:text-gray-300">{entry.adminFeedback}</p>
                </div>
            ) : null}
        </article>
    )
}

export function CookOffProfileClient({ initialData }: { initialData: CookOffProfileData }) {
    const router = useRouter()
    const activeEditableEntry = initialData.activeEntry?.isEditable ? initialData.activeEntry : null
    const cookingProcessInputRef = useRef<HTMLInputElement | null>(null)
    const presentationInputRef = useRef<HTMLInputElement | null>(null)
    const [formState, setFormState] = useState(() => buildFormState(activeEditableEntry, initialData.profile.phone))
    const [cookingProcessFile, setCookingProcessFile] = useState<File | null>(null)
    const [presentationFile, setPresentationFile] = useState<File | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [deleting, setDeleting] = useState(false)

    const totalWinsLabel = useMemo(() => (
        initialData.stats.wins === 1 ? "1 winning finish" : `${initialData.stats.wins} winning finishes`
    ), [initialData.stats.wins])
    const topLeaderboard = initialData.leaderboard.slice(0, 8)
    const activeEntryCode = initialData.activeEntry?.entryCode ?? null

    async function uploadEntryAsset(file: File, target: "cooking-process" | "presentation") {
        const result = await uploadSignedCloudinaryAsset(
            file,
            (fileName, resourceType) => createCookOffEntryUploadSignature(fileName, resourceType, target),
            "video"
        )

        return {
            publicId: result.publicId,
            url: result.secureUrl,
        } satisfies UploadedAsset
    }

    async function cleanupAssets(assets: UploadedAsset[]) {
        await Promise.all(assets.map((asset) => cleanupCookOffUploadedAsset(asset.publicId, "video").catch(() => undefined)))
    }

    async function handleSubmit() {
        if (!initialData.activeSession) {
            toast.error("There is no active Cook-Off session right now.")
            return
        }

        setSubmitting(true)
        const cleanupQueue: UploadedAsset[] = []

        try {
            let cookingProcessVideoUrl = formState.cookingProcessVideoUrl
            let cookingProcessVideoPublicId = formState.cookingProcessVideoPublicId
            let presentationVideoUrl = formState.presentationVideoUrl
            let presentationVideoPublicId = formState.presentationVideoPublicId

            if (cookingProcessFile) {
                const asset = await uploadEntryAsset(cookingProcessFile, "cooking-process")
                cleanupQueue.push(asset)
                cookingProcessVideoUrl = asset.url
                cookingProcessVideoPublicId = asset.publicId
            }

            if (presentationFile) {
                const asset = await uploadEntryAsset(presentationFile, "presentation")
                cleanupQueue.push(asset)
                presentationVideoUrl = asset.url
                presentationVideoPublicId = asset.publicId
            }

            const payload = {
                cookingProcessVideoPublicId,
                cookingProcessVideoUrl,
                ingredients: formState.ingredients,
                presentationVideoPublicId,
                presentationVideoUrl,
                recipeName: formState.recipeName,
                submitterPhone: formState.submitterPhone,
            }

            if (activeEditableEntry) {
                await updateCookOffEntry(activeEditableEntry.id, payload)
                toast.success("Cook-Off entry updated.")
            } else {
                await submitCookOffEntry(payload)
                toast.success("Cook-Off entry submitted for review.")
            }

            router.refresh()
        } catch (error) {
            await cleanupAssets(cleanupQueue)
            toast.error(error instanceof Error ? error.message : "Unable to save your Cook-Off entry.")
        } finally {
            setSubmitting(false)
        }
    }

    async function handleDelete() {
        if (!activeEditableEntry) {
            return
        }

        const confirmed = window.confirm("Delete this pending Cook-Off entry?")
        if (!confirmed) {
            return
        }

        setDeleting(true)

        try {
            await deleteCookOffEntry(activeEditableEntry.id)
            toast.success("Cook-Off entry deleted.")
            router.refresh()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Unable to delete entry.")
        } finally {
            setDeleting(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-3xl border border-orange-200 bg-gradient-to-br from-[#F58220] to-[#d86a12] p-6 text-white shadow-lg shadow-orange-500/20">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-white/80">Entries submitted</span>
                        <Video className="h-5 w-5 text-white/75" />
                    </div>
                    <p className="mt-4 text-3xl font-bold">{initialData.stats.totalEntries}</p>
                    <p className="mt-2 text-sm text-white/80">All your Cook-Off submissions across monthly sessions.</p>
                </div>

                <div className="rounded-3xl border border-gray-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500 dark:text-zinc-400">Approved entries</span>
                        <ShieldCheck className="h-5 w-5 text-emerald-600" />
                    </div>
                    <p className="mt-4 text-3xl font-bold text-gray-900 dark:text-white">{initialData.stats.approvedEntries}</p>
                    <p className="mt-2 text-sm text-gray-500 dark:text-zinc-400">Entries that passed admin review and appeared in the challenge.</p>
                </div>

                <div className="rounded-3xl border border-gray-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500 dark:text-zinc-400">Wins</span>
                        <Trophy className="h-5 w-5 text-amber-500" />
                    </div>
                    <p className="mt-4 text-3xl font-bold text-gray-900 dark:text-white">{initialData.stats.wins}</p>
                    <p className="mt-2 text-sm text-gray-500 dark:text-zinc-400">{totalWinsLabel}</p>
                </div>
            </div>

            {!initialData.activeSession ? (
                <section className="rounded-[2rem] border border-dashed border-gray-200 bg-white p-10 text-center dark:border-zinc-800 dark:bg-zinc-900">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">No active Cook-Off session</h2>
                    <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                        Your entry history stays here, and the next live session will appear automatically once the admin publishes it.
                    </p>
                    <Button asChild className="mt-6 rounded-full bg-[#F58220] hover:bg-[#d86a12]">
                        <Link href="/cook-off">
                            View public Cook-Off page
                            <ChevronRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                </section>
            ) : (
                <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
                    <div className="space-y-6 rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                        <div>
                            <div className="flex flex-wrap items-center gap-3">
                                <Badge className="border-orange-200 bg-orange-50 text-[#F58220] dark:border-orange-900/40 dark:bg-orange-950/20 dark:text-orange-300">
                                    {initialData.activeSession.monthLabel}
                                </Badge>
                                <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
                                    Active session
                                </Badge>
                            </div>
                            <h2 className="mt-4 text-2xl font-bold text-gray-900 dark:text-white">{initialData.activeSession.title}</h2>
                            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                                Theme: <span className="font-semibold text-gray-700 dark:text-gray-200">{initialData.activeSession.theme}</span>
                            </p>
                            {initialData.activeSession.summary ? (
                                <p className="mt-3 text-sm leading-7 text-gray-500 dark:text-gray-400">{initialData.activeSession.summary}</p>
                            ) : null}
                        </div>

                        <div className="rounded-[1.75rem] border border-gray-100 bg-gray-50/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/40">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="mt-0.5 h-5 w-5 text-[#F58220]" />
                                <div className="text-sm text-gray-600 dark:text-gray-300">
                                    Submit one entry per monthly session. Pending entries can be edited until admin review. Approved or rejected entries become locked for that session.
                                </div>
                            </div>
                        </div>

                        <div className="space-y-5">
                            {initialData.activeEntry && !initialData.activeEntry.isEditable ? (
                                <div className="rounded-[1.75rem] border border-gray-100 bg-gray-50/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/40">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{initialData.activeEntry.recipeName}</h3>
                                        <Badge className={getStatusTone(initialData.activeEntry.status)}>
                                            {formatCookOffEntryStatus(initialData.activeEntry.status)}
                                        </Badge>
                                    </div>
                                    <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                                        You already have an entry in the current session. It is now locked because admin review has started.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-gray-700 dark:text-zinc-200">Recipe name</label>
                                        <Input
                                            value={formState.recipeName}
                                            onChange={(event) => setFormState((current) => ({ ...current, recipeName: event.target.value }))}
                                            placeholder="Enter your recipe title"
                                            className="h-12 rounded-2xl bg-white dark:bg-zinc-900"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-gray-700 dark:text-zinc-200">Ingredients</label>
                                        <Textarea
                                            value={formState.ingredients}
                                            onChange={(event) => setFormState((current) => ({ ...current, ingredients: event.target.value }))}
                                            placeholder="List the ingredients used in your entry"
                                            className="min-h-28 rounded-2xl bg-white dark:bg-zinc-900"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-gray-700 dark:text-zinc-200">Contact phone</label>
                                        <Input
                                            value={formState.submitterPhone}
                                            onChange={(event) => setFormState((current) => ({ ...current, submitterPhone: event.target.value }))}
                                            placeholder="Phone number admin can copy for manual contact"
                                            className="h-12 rounded-2xl bg-white dark:bg-zinc-900"
                                        />
                                    </div>

                                    <div className="grid gap-4 md:grid-cols-2">
                                        {[
                                            {
                                                file: cookingProcessFile,
                                                hint: formState.cookingProcessVideoUrl ? "Current cooking process video saved." : "No cooking process video uploaded yet.",
                                                inputRef: cookingProcessInputRef,
                                                label: "Cooking process video",
                                                onChange: (file: File | null) => setCookingProcessFile(file),
                                            },
                                            {
                                                file: presentationFile,
                                                hint: formState.presentationVideoUrl ? "Current presentation video saved." : "No presentation video uploaded yet.",
                                                inputRef: presentationInputRef,
                                                label: "Presentation video",
                                                onChange: (file: File | null) => setPresentationFile(file),
                                            },
                                        ].map((item) => (
                                            <div key={item.label} className="rounded-[1.75rem] border border-gray-100 bg-gray-50/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/40">
                                                <p className="font-semibold text-gray-900 dark:text-white">{item.label}</p>
                                                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{item.file ? item.file.name : item.hint}</p>
                                                <input
                                                    ref={item.inputRef}
                                                    type="file"
                                                    accept="video/*"
                                                    className="hidden"
                                                    onChange={(event) => item.onChange(event.target.files?.[0] ?? null)}
                                                />
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() => item.inputRef.current?.click()}
                                                    className="mt-4 rounded-full"
                                                >
                                                    <Upload className="mr-2 h-4 w-4" />
                                                    Choose video
                                                </Button>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex flex-wrap gap-3">
                                        <Button type="button" onClick={() => void handleSubmit()} disabled={submitting} className="rounded-full bg-[#F58220] px-7 hover:bg-[#d86a12]">
                                            {submitting ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Saving entry
                                                </>
                                            ) : (
                                                <>
                                                    <Upload className="mr-2 h-4 w-4" />
                                                    {activeEditableEntry ? "Update entry" : "Submit entry"}
                                                </>
                                            )}
                                        </Button>

                                        {activeEditableEntry ? (
                                            <Button type="button" variant="outline" onClick={() => void handleDelete()} disabled={deleting || submitting} className="rounded-full border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:text-red-300">
                                                {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                                Delete pending entry
                                            </Button>
                                        ) : null}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Current session status</h2>
                            {initialData.activeEntry ? (
                                <div className="mt-5 space-y-4">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{initialData.activeEntry.recipeName}</h3>
                                        <Badge className={getStatusTone(initialData.activeEntry.status)}>
                                            {formatCookOffEntryStatus(initialData.activeEntry.status)}
                                        </Badge>
                                        {initialData.activeEntry.winnerPosition ? (
                                            <Badge className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                                                Winner #{initialData.activeEntry.winnerPosition}
                                            </Badge>
                                        ) : null}
                                    </div>

                                    <div className="grid gap-3 sm:grid-cols-2">
                                        {[
                                            { label: "Votes", value: initialData.activeEntry.voteCount },
                                            { label: "Rank", value: initialData.activeEntry.rank ?? "-" },
                                            { label: "Admin score", value: initialData.activeEntry.adminScore?.toFixed(2) ?? "Pending" },
                                            { label: "Final score", value: initialData.activeEntry.finalScore?.toFixed(2) ?? "Pending" },
                                        ].map((item) => (
                                            <div key={item.label} className="rounded-2xl border border-gray-100 bg-gray-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
                                                <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-400">{item.label}</p>
                                                <p className="mt-2 text-xl font-extrabold text-gray-900 dark:text-white">{item.value}</p>
                                            </div>
                                        ))}
                                    </div>

                                    {initialData.activeEntry.adminFeedback ? (
                                        <div className="rounded-[1.75rem] border border-gray-100 bg-gray-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
                                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-400">Admin feedback</p>
                                            <p className="mt-2 text-sm leading-7 text-gray-600 dark:text-gray-300">{initialData.activeEntry.adminFeedback}</p>
                                        </div>
                                    ) : null}
                                </div>
                            ) : (
                                <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                                    Once you submit an entry for the active session, your review status will appear here.
                                </p>
                            )}
                        </div>

                        <div className="overflow-hidden rounded-[2rem] border border-gray-100 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                            <div className="border-b border-gray-100 px-6 py-5 dark:border-zinc-800">
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Leaderboard snapshot</h2>
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                    Live top entries for the active session.
                                </p>
                            </div>

                            {topLeaderboard.length === 0 ? (
                                <div className="p-10 text-center text-sm text-gray-500 dark:text-gray-400">
                                    Approved entries will appear here after admin review.
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-100 dark:divide-zinc-800">
                                    {topLeaderboard.map((entry) => (
                                        <div key={entry.entryId} className="flex items-center justify-between gap-4 px-6 py-4">
                                            <div className="flex items-center gap-4">
                                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-100 text-sm font-extrabold text-gray-700 dark:bg-zinc-800 dark:text-white">
                                                    #{entry.rank}
                                                </div>
                                                <div>
                                                    <p className={cn(
                                                        "font-semibold",
                                                        entry.entryCode === activeEntryCode ? "text-[#F58220]" : "text-gray-900 dark:text-white"
                                                    )}>
                                                        {entry.recipeName}
                                                    </p>
                                                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{entry.submitterName}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-base font-extrabold text-[#F58220]">{entry.finalScore.toFixed(2)}</p>
                                                <p className="text-xs uppercase tracking-[0.16em] text-gray-400">{entry.voteCount} votes</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <Button asChild className="w-full rounded-full bg-[#F58220] hover:bg-[#d86a12]">
                            <Link href="/cook-off">
                                View public Cook-Off portal
                                <ChevronRight className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                    </div>
                </section>
            )}

            <section className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">My Cook-Off history</h2>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Every session you entered, including admin remarks and final results.
                        </p>
                    </div>
                    <div className="rounded-full border border-gray-200 px-4 py-2 text-sm text-gray-500 dark:border-zinc-800 dark:text-gray-400">
                        {initialData.history.length} total
                    </div>
                </div>

                {initialData.history.length === 0 ? (
                    <div className="rounded-[2rem] border border-dashed border-gray-200 bg-white p-10 text-center text-sm text-gray-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-gray-400">
                        No Cook-Off entries yet. Use the active session form above to submit your first challenge entry.
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {initialData.history.map((entry) => (
                            <HistoryCard key={entry.id} entry={entry} />
                        ))}
                    </div>
                )}
            </section>
        </div>
    )
}
