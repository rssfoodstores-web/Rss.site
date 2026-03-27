"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"
import { Database } from "@/types/database.types"
import { updateProfileDetailed } from "@/app/account/actions"
import { Loader2, MapPin } from "lucide-react"
import { useRouter } from "next/navigation"
import { ProfileSidebar } from "@/components/account/ProfileSidebar"
import { createEmptyProfileRow } from "@/lib/profile"
import { useUser } from "@/context/UserContext"

export default function EditProfilePage() {
    const [loading, setLoading] = useState(false)
    const [locating, setLocating] = useState(false)
    const [initializing, setInitializing] = useState(true)
    const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
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

    const getGPSPosition = (): Promise<GeolocationPosition> => {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                alert("Geolocation is not supported by your browser")
                reject("Not supported")
            }
            navigator.geolocation.getCurrentPosition(resolve, reject)
        })
    }

    const handleGetGeolocation = async () => {
        setLocating(true)
        try {
            const position = await getGPSPosition()
            const { latitude, longitude } = position.coords
            setCoords({ lat: latitude, lng: longitude })

            // Set hidden inputs
            const latInput = document.getElementById("lat") as HTMLInputElement
            const lngInput = document.getElementById("lng") as HTMLInputElement
            if (latInput) latInput.value = latitude.toString()
            if (lngInput) lngInput.value = longitude.toString()
        } catch (err) {
            console.error(err)
            alert("Unable to retrieve location.")
        }
        setLocating(false)
    }

    const handleUseAddress = async () => {
        setLocating(true)
        try {
            let lat = coords?.lat
            let lng = coords?.lng

            if (!lat || !lng) {
                const position = await getGPSPosition()
                lat = position.coords.latitude
                lng = position.coords.longitude
                setCoords({ lat, lng })

                const latInput = document.getElementById("lat") as HTMLInputElement
                const lngInput = document.getElementById("lng") as HTMLInputElement
                if (latInput) latInput.value = lat.toString()
                if (lngInput) lngInput.value = lng.toString()
            }

            // Reverse Geocoding
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
            const data = await res.json()

            if (data && data.address) {
                const addr = data.address

                const inputs = {
                    zip_code: addr.postcode,
                    state: addr.state || addr.region || addr.county,
                    street_address: addr.road || addr.suburb || addr.neighbourhood,
                    house_number: addr.house_number || ""
                }

                Object.entries(inputs).forEach(([id, value]) => {
                    const el = document.getElementById(id) as HTMLInputElement
                    if (el) el.value = value || ""
                })
            }
        } catch (e) {
            console.error("Geocoding error:", e)
            alert("Could not fetch address details automatically.")
        }
        setLocating(false)
    }

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
                    <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">Edit Profile</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 sm:text-base">Update your personal information.</p>
                </div>

                <div className="flex flex-col gap-5 sm:gap-6 lg:flex-row lg:gap-8">
                    <aside className="w-full lg:w-80 flex-shrink-0">
                        <ProfileSidebar />
                    </aside>

                    <main className="min-w-0 flex-1 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
                        <form action={handleSubmit} className="space-y-6">
                            <input type="hidden" name="latitude" id="lat" />
                            <input type="hidden" name="longitude" id="lng" />

                            {/* Geolocation Section */}
                            <div className="p-4 bg-[#F58220]/5 rounded-xl border border-[#F58220]/10 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                                <div>
                                    <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                        <MapPin className="h-4 w-4 text-[#F58220]" />
                                        Smart Location
                                    </h3>
                                    <p className="text-xs text-gray-500">
                                        {coords
                                            ? `Captured: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`
                                            : "Link your precise GPS coordinates for better delivery."
                                        }
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    onClick={handleGetGeolocation}
                                    className="bg-[#F58220] hover:bg-[#F58220]/90 text-white text-xs h-9"
                                    disabled={locating}
                                >
                                    {locating ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <MapPin className="h-3 w-3 mr-2" />}
                                    Get Geolocation
                                </Button>
                            </div>

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

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">State</label>
                                    <Input id="state" name="state" defaultValue={profile.state || ""} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Zip Code</label>
                                    <Input id="zip_code" name="zip_code" defaultValue={profile.zip_code || ""} />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-sm font-medium">Street Address</label>
                                    <button
                                        type="button"
                                        onClick={handleUseAddress}
                                        className="text-[#F58220] text-xs font-bold uppercase flex items-center gap-1 hover:underline"
                                        disabled={locating}
                                    >
                                        {locating ? <Loader2 className="h-3 w-3 animate-spin" /> : <MapPin className="h-3 w-3" />}
                                        Use Current Address
                                    </button>
                                </div>
                                <Input id="street_address" name="street_address" defaultValue={profile.street_address || ""} />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">House Number</label>
                                <Input id="house_number" name="house_number" defaultValue={profile.house_number || ""} />
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
                    </main>
                </div>
            </div>
        </div>
    )
}
