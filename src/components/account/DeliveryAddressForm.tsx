"use client"

import { useState, type FormEvent } from "react"
import { Check, LocateFixed } from "lucide-react"
import { saveDeliveryAddress } from "@/app/actions/deliveryAddresses"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useDeliveryDestination } from "@/context/DeliveryDestinationContext"
import { NIGERIAN_STATES } from "@/lib/constants/nigerianStates"
import { deliveryState, findDeliveryLocation, getCurrentDeliveryCoordinates, isDeliveryPoint, type DeliveryAddress } from "@/lib/deliveryAddresses"
import type { Coordinates } from "@/lib/directions"

export function DeliveryAddressForm({
    initial,
    initialState,
    onSaved,
}: {
    initial?: Partial<DeliveryAddress>
    initialState?: string
    onSaved: (address: DeliveryAddress) => void
}) {
    const { updateAddresses } = useDeliveryDestination()
    const [label, setLabel] = useState(initial?.label ?? "")
    const [address, setAddress] = useState(initial?.address ?? "")
    const [landmark, setLandmark] = useState("")
    const [state, setState] = useState(initialState || deliveryState(initial?.address ?? "") || "")
    const [point, setPoint] = useState<Coordinates | null>(isDeliveryPoint(initial) ? { lat: initial.lat, lng: initial.lng } : null)
    const [lookupAttribution, setLookupAttribution] = useState(Boolean(initial?.address && !initial.id))
    const [locating, setLocating] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState("")

    async function locate() {
        setError("")
        setLocating(true)
        try {
            const location = await getCurrentDeliveryCoordinates()
            const details = await findDeliveryLocation(location)
            setPoint(location)
            setAddress(details?.address ?? "")
            setState(details?.state ?? "")
            setLookupAttribution(Boolean(details?.address))
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : "Location unavailable.")
        } finally {
            setLocating(false)
        }
    }

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (!point || saving || locating) return
        const street = address.trim()
        const confirmedState = deliveryState(street) ?? state
        if (!street || !confirmedState) {
            setError("Enter the street or building and choose the delivery state.")
            return
        }
        const addressText = [street, deliveryState(street) ? "" : confirmedState, landmark.trim()].filter(Boolean).join(", ")
        setSaving(true)
        setError("")
        try {
            const result = await saveDeliveryAddress({ id: initial?.id, label: label.trim() || "Delivery address", address: addressText, ...point })
            if (!result.address) {
                setError(result.error)
                return
            }
            const saved = result.address
            updateAddresses((current) => current.some(({ id }) => id === saved.id)
                ? current.map((entry) => entry.id === saved.id ? saved : entry)
                : [...current, saved])
            onSaved(saved)
        } catch {
            setError("Could not save this delivery address. Try again.")
        } finally {
            setSaving(false)
        }
    }

    return (
        <form className="space-y-5" onSubmit={submit}>
            <div className="rounded-xl bg-muted/50 p-4">
                {point ? (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-sm font-semibold"><Check className="size-4 text-green-700 dark:text-green-400" aria-hidden="true" /> Delivery location captured</span>
                        <Button type="button" variant="ghost" onClick={() => void locate()} disabled={locating || saving}>{locating ? "Finding location…" : "Update GPS location"}</Button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <p className="text-sm">When you’re at the place you want us to deliver to, capture its location.</p>
                        <Button type="button" onClick={() => void locate()} disabled={locating} className="motion-safe:transition-transform motion-safe:active:scale-[0.98]">
                            <LocateFixed className="mr-1 size-4" aria-hidden="true" />
                            {locating ? "Finding your location…" : "Use my current location"}
                        </Button>
                    </div>
                )}
            </div>
            {point && (
                <>
                    <label className="block space-y-1 text-sm font-medium">
                        Street or building
                        <Input required maxLength={350} placeholder="Street name, building or estate" value={address} onChange={(event) => setAddress(event.target.value)} />
                    </label>
                    {lookupAttribution && <p className="text-xs font-medium text-muted-foreground" translate="no">Google Maps</p>}
                    {!deliveryState(address) && (
                        <label className="grid gap-1 text-sm font-medium">
                            Delivery state
                            <select required className="min-h-11 rounded-lg border bg-background px-3" value={state} onChange={(event) => setState(event.target.value)}>
                                <option value="">Choose your state</option>
                                {NIGERIAN_STATES.map((option) => <option key={option}>{option}</option>)}
                            </select>
                        </label>
                    )}
                    <label className="block space-y-1 text-sm font-medium">
                        Flat, gate or landmark <span className="font-normal text-muted-foreground">(optional)</span>
                        <Input maxLength={100} placeholder="e.g. Flat 4, gate beside the pharmacy" value={landmark} onChange={(event) => setLandmark(event.target.value)} />
                    </label>
                    <label className="block space-y-1 text-sm font-medium">
                        Address name <span className="font-normal text-muted-foreground">(optional)</span>
                        <Input maxLength={60} placeholder="Home or Work" value={label} onChange={(event) => setLabel(event.target.value)} />
                    </label>
                    <Button type="submit" disabled={saving || locating}>{saving ? "Saving…" : "Save delivery address"}</Button>
                </>
            )}
            {error && <p role="alert" className="text-sm text-red-600 dark:text-red-300">{error}</p>}
        </form>
    )
}
