"use client"

import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import { AlertTriangle, ArrowLeft, Loader2, Lock, MapPin, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { requestLocationUpdate, verifyMerchantLocation } from "@/app/merchant/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface VerifyLocationInitialState {
    isLocked: boolean
    updateRequested: boolean
    hasExistingLocation: boolean
    state: string
    city: string
    street: string
    houseNumber: string
    zipCode: string
    currentAddressLabel: string | null
}

function formatAddressLabel({
    houseNumber,
    street,
    city,
    state,
    zipCode,
}: {
    houseNumber: string
    street: string
    city: string
    state: string
    zipCode: string
}) {
    return [houseNumber, street, city, state, zipCode].filter(Boolean).join(", ")
}

export function VerifyLocationClient({ initialState }: { initialState: VerifyLocationInitialState }) {
    const [loading, setLoading] = useState(false)
    const [locating, setLocating] = useState(false)
    const [permissionDenied, setPermissionDenied] = useState(false)
    const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)

    const [isLocked, setIsLocked] = useState(initialState.isLocked)
    const [updateRequested, setUpdateRequested] = useState(initialState.updateRequested)
    const [hasExistingLocation, setHasExistingLocation] = useState(initialState.hasExistingLocation)
    const [currentAddressLabel, setCurrentAddressLabel] = useState(initialState.currentAddressLabel)

    const [state, setState] = useState(initialState.state)
    const [city, setCity] = useState(initialState.city)
    const [street, setStreet] = useState(initialState.street)
    const [houseNumber, setHouseNumber] = useState(initialState.houseNumber)
    const [zipCode, setZipCode] = useState(initialState.zipCode)
    const [manualEntry, setManualEntry] = useState(false)
    const [manualLat, setManualLat] = useState("")
    const [manualLng, setManualLng] = useState("")

    const secureContext = typeof window === "undefined" ? true : window.isSecureContext

    const handleGeolocation = () => {
        setLocating(true)
        setPermissionDenied(false)

        if (!secureContext) {
            toast.error("Geolocation requires a secure connection.")
            setPermissionDenied(true)
            setLocating(false)
            return
        }

        if (!navigator.geolocation) {
            toast.error("Geolocation is not supported by your browser.")
            setLocating(false)
            return
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setCoords({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                })
                setLocating(false)
                toast.success("Coordinates captured successfully.")
            },
            (error) => {
                console.error("Geolocation error:", error)
                toast.error(`Error: ${error.message} (Code: ${error.code})`)
                if (error.code === 1) {
                    setPermissionDenied(true)
                }
                setLocating(false)
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 0,
            }
        )
    }

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault()

        let nextCoords = coords

        if (!nextCoords && manualEntry) {
            const lat = Number(manualLat)
            const lng = Number(manualLng)

            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                toast.error("Enter valid latitude and longitude values.")
                return
            }

            nextCoords = { lat, lng }
            setCoords(nextCoords)
        }

        if (!nextCoords) {
            toast.error("Please capture your store GPS location first.")
            return
        }

        setLoading(true)

        const formData = new FormData()
        formData.append("state", state)
        formData.append("city", city)
        formData.append("street_address", street)
        formData.append("house_number", houseNumber)
        formData.append("zip_code", zipCode)
        formData.append("latitude", nextCoords.lat.toString())
        formData.append("longitude", nextCoords.lng.toString())

        const result = await verifyMerchantLocation(formData)

        setLoading(false)

        if (result.error) {
            toast.error(result.error)
            return
        }

        toast.success("Store location verified.")
        setIsLocked(true)
        setUpdateRequested(false)
        setHasExistingLocation(true)
        setCurrentAddressLabel(formatAddressLabel({ houseNumber, street, city, state, zipCode }))
    }

    const handleRequestUpdate = async () => {
        setLoading(true)
        const result = await requestLocationUpdate()
        setLoading(false)

        if (result.error) {
            toast.error(result.error)
            return
        }

        toast.success("Update request sent successfully.")
        setUpdateRequested(true)
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6 dark:bg-zinc-950 md:p-12">
            <div className="mx-auto grid max-w-5xl gap-12 rounded-[2.5rem] border border-gray-100 bg-white p-8 shadow-xl dark:border-zinc-800 dark:bg-zinc-900 md:p-12 lg:grid-cols-2">
                <div className="flex flex-col justify-center space-y-6 lg:order-2">
                    <div className="overflow-hidden rounded-3xl border-4 border-white bg-sky-100 shadow-lg dark:border-zinc-800">
                        <Image
                            src="/store_location_verification_guide.png"
                            alt="Store verification guide"
                            width={1200}
                            height={900}
                            className="h-auto w-full object-cover"
                            priority
                        />
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-2xl font-black text-[#1E1E66] dark:text-white">Why verify?</h2>
                        <p className="text-gray-500 dark:text-gray-400">
                            Accurate store GPS data helps riders reach the right pickup point and is now required before product posting is enabled.
                        </p>
                    </div>

                    {!isLocked ? (
                        <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
                            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                            <p className="text-sm font-medium">
                                Stand at the real store entrance before using <span className="font-semibold">Get Current Location</span>. The captured pin is what riders will use.
                            </p>
                        </div>
                    ) : null}
                </div>

                <div className="flex flex-col justify-center space-y-8 lg:order-1">
                    <div>
                        <Link href="/merchant/products" className="mb-6 inline-flex items-center text-sm font-medium text-gray-400 transition hover:text-gray-600">
                            <ArrowLeft className="mr-1 h-4 w-4" />
                            Back to products
                        </Link>

                        <div className="mb-3 flex items-center gap-3">
                            <h1 className="text-3xl font-black text-[#1A1A1A] dark:text-white md:text-4xl">
                                {isLocked ? "Location Verified" : hasExistingLocation ? "Update Store Location" : "Verify Store Location"}
                            </h1>
                            {isLocked ? <Lock className="h-6 w-6 text-green-600" /> : null}
                        </div>

                        <p className="text-gray-500 dark:text-gray-400">
                            {isLocked
                                ? "Your store location is verified and locked. Request update access if you need to move or correct it."
                                : hasExistingLocation
                                    ? "Admin has approved location editing. Save your new store location and the page will lock again."
                                    : "Complete the form below to unlock product posting."}
                        </p>
                    </div>

                    {isLocked ? (
                        <div className="space-y-6 rounded-xl border border-gray-100 bg-gray-50 p-6 dark:border-zinc-800 dark:bg-zinc-950">
                            <div className="space-y-2">
                                <Label>Current address</Label>
                                <div className="text-lg font-medium text-gray-800 dark:text-white">
                                    {currentAddressLabel ?? "No saved address"}
                                </div>
                            </div>

                            {!updateRequested ? (
                                <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
                                    Admin approval is required before an existing store location can be changed.
                                </div>
                            ) : null}

                            <div className="border-t border-gray-200 pt-4 dark:border-zinc-800">
                                {updateRequested ? (
                                    <div className="flex items-center gap-3 rounded-xl border border-yellow-100 bg-yellow-50 p-4 text-yellow-800">
                                        <RefreshCw className="h-5 w-5 animate-spin" />
                                        <div>
                                            <p className="font-bold">Update request pending</p>
                                            <p className="mt-1 text-xs">An admin will review your request shortly.</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <p className="text-sm text-gray-500">Need to move your shop or correct an error?</p>
                                        <Button
                                            onClick={handleRequestUpdate}
                                            disabled={loading}
                                            variant="outline"
                                            className="h-12 w-full border-gray-300 font-semibold text-gray-700 hover:bg-white"
                                        >
                                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                                            Request Edit Access
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid gap-5 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="house_number" className="font-semibold text-gray-700">House or Shop No.</Label>
                                    <Input id="house_number" required value={houseNumber} onChange={(event) => setHouseNumber(event.target.value)} placeholder="e.g. 12B" className="h-12 rounded-xl bg-gray-50" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="street" className="font-semibold text-gray-700">Street Address</Label>
                                    <Input id="street" required value={street} onChange={(event) => setStreet(event.target.value)} placeholder="Main Street" className="h-12 rounded-xl bg-gray-50" />
                                </div>
                            </div>

                            <div className="grid gap-5 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="city" className="font-semibold text-gray-700">City</Label>
                                    <Input id="city" required value={city} onChange={(event) => setCity(event.target.value)} placeholder="e.g. Ibadan" className="h-12 rounded-xl bg-gray-50" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="zip" className="font-semibold text-gray-700">Zip Code</Label>
                                    <Input id="zip" required value={zipCode} onChange={(event) => setZipCode(event.target.value)} placeholder="100001" className="h-12 rounded-xl bg-gray-50" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="state" className="font-semibold text-gray-700">State</Label>
                                <Input id="state" required value={state} onChange={(event) => setState(event.target.value)} placeholder="e.g. Oyo State" className="h-12 rounded-xl bg-gray-50" />
                            </div>

                            <div className="space-y-4 pt-4">
                                <Label className="block font-semibold text-gray-700">GPS Coordinates</Label>

                                {permissionDenied && !manualEntry ? (
                                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                                        <p className="mb-2 flex items-center gap-2 font-bold">
                                            <AlertTriangle className="h-4 w-4" />
                                            Permission denied
                                        </p>
                                        <ol className="list-decimal space-y-2 rounded-lg bg-white/60 p-3 pl-5 text-xs font-medium">
                                            <li>Click the browser lock icon in the address bar and allow location access.</li>
                                            <li>Turn on Windows location services if your browser still cannot read the device location.</li>
                                            {!secureContext ? (
                                                <li>Use HTTPS or localhost. Geolocation will not work on an insecure origin.</li>
                                            ) : null}
                                            <li>Reload the page, or switch to manual coordinates below.</li>
                                        </ol>
                                        <div className="mt-3 flex gap-2">
                                            <Button type="button" variant="outline" size="sm" className="flex-1 border-red-200 text-red-700 hover:bg-red-100" onClick={() => window.location.reload()}>
                                                Reload Page
                                            </Button>
                                            <Button type="button" variant="ghost" size="sm" className="flex-1 text-red-700 hover:bg-red-100" onClick={() => setManualEntry(true)}>
                                                Enter Manually
                                            </Button>
                                        </div>
                                    </div>
                                ) : null}

                                {!manualEntry ? (
                                    <Button
                                        type="button"
                                        variant={coords ? "outline" : "default"}
                                        onClick={handleGeolocation}
                                        disabled={locating}
                                        className={coords ? "h-12 w-full border-green-200 bg-green-50 text-green-700 hover:bg-green-100" : "h-12 w-full bg-[#F58220] text-white hover:bg-[#E57210]"}
                                    >
                                        {locating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MapPin className="mr-2 h-4 w-4" />}
                                        {coords ? "Location captured" : "Get Current Location"}
                                    </Button>
                                ) : (
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="manual_lat">Latitude</Label>
                                            <Input id="manual_lat" value={manualLat} onChange={(event) => setManualLat(event.target.value)} placeholder="7.3870" className="h-12 rounded-xl bg-gray-50" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="manual_lng">Longitude</Label>
                                            <Input id="manual_lng" value={manualLng} onChange={(event) => setManualLng(event.target.value)} placeholder="3.8228" className="h-12 rounded-xl bg-gray-50" />
                                        </div>
                                    </div>
                                )}

                                {coords ? (
                                    <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
                                        Coordinates ready: {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
                                    </div>
                                ) : null}
                            </div>

                            <Button type="submit" disabled={loading} className="h-12 w-full rounded-xl bg-[#1E1E66] font-bold text-white hover:bg-[#1E1E66]/90">
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : hasExistingLocation ? "Save Updated Store Location" : "Save Store Location"}
                            </Button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    )
}
