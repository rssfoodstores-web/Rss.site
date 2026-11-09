"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"
import { Database } from "@/types/database.types"
import { updateProfileDetailed } from "@/app/account/actions"
import { Loader2 } from "lucide-react"
import Link from "next/link"
import { ChangePasswordForm } from "../password/PasswordSettingsClient"
import { canUpdateAccountPassword } from "@/lib/authProviders"
import { useRouter } from "next/navigation"
import { createEmptyProfileRow } from "@/lib/profile"
import { useUser } from "@/context/UserContext"

export default function EditProfilePage() {
    const [loading, setLoading] = useState(false)
    const [initializing, setInitializing] = useState(true)
    const router = useRouter()
    const { profile: cachedProfile, user: currentUser } = useUser()
    const currentUserDisplayName =
        typeof currentUser?.user_metadata?.full_name === "string"
            ? currentUser.user_metadata.full_name
            : ""

    // Helper to get initial data
    const [profile, setProfile] = useState<Database["public"]["Tables"]["profiles"]["Row"] | null>(null)
    const [email, setEmail] = useState("")

    useEffect(() => {
        if (cachedProfile && !profile) {
            const fallbackName = cachedProfile.full_name?.trim()
                || currentUserDisplayName
                || currentUser?.email?.split("@")[0]
                || "Customer"

            setProfile((current) => current ?? {
                ...createEmptyProfileRow(cachedProfile.id, fallbackName),
                address: cachedProfile.address ?? null,
                avatar_url: cachedProfile.avatar_url ?? null,
                full_name: fallbackName,
                id: cachedProfile.id,
                location: cachedProfile.location ?? null,
                phone: cachedProfile.phone ?? null,
                state: cachedProfile.state ?? null,
            })
        }

        if (currentUser?.email) {
            setEmail(currentUser.email)
        }
    }, [cachedProfile, currentUser?.email, currentUserDisplayName, profile])

    // Fetch data on mount
    useEffect(() => {
        let mounted = true
        const supabase = createClient()

        async function loadData() {
            try {
                const { data: { user }, error } = await supabase.auth.getUser()
                if (error) throw error

                if (!user) {
                    router.replace("/login")
                    return
                }

                if (mounted) {
                    setEmail(user.email || "")
                }

                const { data, error: profileError } = await supabase
                    .from("profiles")
                    .select("*")
                    .eq("id", user.id)
                    .maybeSingle()

                if (profileError) {
                    throw profileError
                }

                if (mounted) {
                    setProfile(data ?? createEmptyProfileRow(
                        user.id,
                        user.user_metadata?.full_name || user.email?.split("@")[0] || "Customer"
                    ))
                }
            } catch (error: unknown) {
                const errorName = error instanceof Error ? error.name : ""
                const errorMessage = error instanceof Error ? error.message : ""

                if (errorName !== "AbortError" && errorMessage !== "Fetch is aborted") {
                    console.error("Error loading profile:", error)
                    if (mounted && currentUser) {
                        setProfile(createEmptyProfileRow(
                            currentUser.id,
                            currentUserDisplayName || currentUser.email?.split("@")[0] || "Customer"
                        ))
                    }
                }
            } finally {
                if (mounted) {
                    setInitializing(false)
                }
            }
        }

        loadData()

        return () => { mounted = false }
    }, [currentUser, currentUserDisplayName, router])

    async function handleSubmit(formData: FormData) {
        setLoading(true)
        try {
            const result = await updateProfileDetailed(formData)
            if (result.success) {
                router.push("/account")
            } else {
                alert("Failed to update: " + result.error)
            }
        } catch (error) {
            alert("An unexpected error occurred.")
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    if (initializing || !profile) {
        return (
            <div className="min-h-screen bg-gray-50/50 py-6 dark:bg-black sm:py-8 lg:py-12">
                <div className="container mx-auto px-4 sm:px-6">
                    <div className="flex justify-center p-12">
                        <Loader2 className="animate-spin" />
                    </div>
                </div>
            </div>
        )
    }

    const names = profile.full_name?.split(" ") || ["", ""]
    const defaultFirstName = names[0]
    const defaultLastName = names.slice(1).join(" ")

    return (
        <div className="min-h-screen bg-gray-50/50 py-6 dark:bg-black sm:py-8 lg:py-12">
            <div className="container mx-auto px-4 sm:px-6">
                <div className="mb-6 sm:mb-8">
                    <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">Personal details</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 sm:text-base">Update your personal information.</p>
                </div>

                <div className="min-w-0">


                    <main className="max-w-2xl min-w-0 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
                        <form action={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">First name</label>
                                    <Input name="first_name" defaultValue={defaultFirstName} required />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Last name</label>
                                    <Input name="last_name" defaultValue={defaultLastName} required />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Company Name (optional)</label>
                                <Input name="company_name" defaultValue={profile.company_name || ""} />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Email</label>
                                    <Input value={email} disabled className="bg-gray-100 dark:bg-zinc-800" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Phone</label>
                                    <Input name="phone" defaultValue={profile.phone || ""} placeholder="(+234) ..." />
                                </div>
                            </div>

                            <div className="pt-4 flex gap-4">
                                <Button type="submit" className="bg-[#F58220] hover:bg-[#F58220]/90 text-white flex-1" disabled={loading}>
                                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save Changes
                                </Button>
                                <Button
                                    type="button"
                                    onClick={() => router.back()}
                                    variant="outline"
                                    className="flex-1"
                                >
                                    Cancel
                                </Button>
                            </div>
                        </form>
                        <div className="mt-5 border-t pt-4">
                            <Link href="/account/address" className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4">Manage delivery addresses</Link>
                        </div>
                        {currentUser && canUpdateAccountPassword(currentUser) && (
                            <details className="mt-4 rounded-xl border px-4 py-2">
                                <summary className="flex min-h-11 cursor-pointer items-center font-semibold">Change password</summary>
                                <p className="mb-4 text-sm text-muted-foreground">Update the password you use to sign in to RSS Foods.</p>
                                <ChangePasswordForm />
                            </details>
                        )}
                    </main>
                </div>
            </div>
        </div>
    )
}
