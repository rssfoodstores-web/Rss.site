"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import Script from "next/script"
import { saveDeliveryAddress } from "@/app/actions/deliveryAddresses"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useDeliveryDestination } from "@/context/DeliveryDestinationContext"
import { getCurrentDeliveryCoordinates, type DeliveryAddress } from "@/lib/deliveryAddresses"
import type { Coordinates } from "@/lib/directions"

const DEFAULT_MAP_CENTER: [number, number] = [9.082, 8.6753]

export function DeliveryAddressForm({
    initial,
    onSaved,
}: {
    initial?: Partial<DeliveryAddress>
    onSaved: (address: DeliveryAddress) => void
}) {
    const { updateAddresses } = useDeliveryDestination()
    const [label, setLabel] = useState(initial?.label ?? "")
    const [address, setAddress] = useState(initial?.address ?? "")
    const [point, setPoint] = useState<Coordinates | null>(
        initial?.lat !== undefined && initial.lng !== undefined ? { lat: initial.lat, lng: initial.lng } : null,
    )
    const [mapLoaded, setMapLoaded] = useState(false)
    const [locating, setLocating] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState("")
    const container = useRef<HTMLDivElement>(null)
    const map = useRef<LeafletMapInstance | null>(null)
    const marker = useRef<LeafletMarkerInstance | null>(null)

    useEffect(() => {
        if (!mapLoaded || !container.current || !window.L) return
        const instance = window.L.map(container.current) as LeafletMapInstance & {
            on: (name: string, listener: (event: { latlng: Coordinates }) => void) => void
        }
        instance.setView(DEFAULT_MAP_CENTER, 6)
        window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(instance)
        instance.on("click", ({ latlng }) => setPoint({ lat: latlng.lat, lng: latlng.lng }))
        map.current = instance
        return () => {
            instance.remove()
            map.current = null
            marker.current = null
        }
    }, [mapLoaded])

    useEffect(() => {
        if (!mapLoaded || !point || !map.current) return
        const position: [number, number] = [point.lat, point.lng]
        if (!marker.current) {
            const icon = window.L.icon({
                iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
                iconSize: [25, 41],
                iconAnchor: [12, 41],
            })
            marker.current = window.L.marker(position, { icon }).addTo(map.current)
        }
        marker.current.setLatLng(position)
        map.current.setView(position, 16)
    }, [mapLoaded, point])

    async function locate() {
        setError("")
        setLocating(true)
        try { setPoint(await getCurrentDeliveryCoordinates()) }
        catch (failure) { setError(failure instanceof Error ? failure.message : "Location unavailable.") }
        finally { setLocating(false) }
    }

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (!point || saving) return
        setSaving(true)
        setError("")
        try {
            const result = await saveDeliveryAddress({ id: initial?.id, label, address, ...point })
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
        <form className="space-y-4" onSubmit={submit}>
            <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
            <Script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" onReady={() => setMapLoaded(true)} />
            <label className="block space-y-1 text-sm font-medium">
                Address name
                <Input required maxLength={60} placeholder="Home or Work" value={label} onChange={(event) => setLabel(event.target.value)} />
            </label>
            <label className="block space-y-1 text-sm font-medium">
                Delivery address
                <Input required maxLength={500} placeholder="Street, building, area and landmark" value={address} onChange={(event) => setAddress(event.target.value)} />
            </label>
            <div>
                <p className="mb-2 text-sm">Tap the map to place or adjust your delivery pin.</p>
                <div ref={container} className="relative z-0 h-52 rounded-md bg-gray-100 dark:bg-zinc-800" aria-label="Delivery pin map" />
                <Button className="mt-2" variant="outline" type="button" onClick={locate} disabled={locating || saving}>
                    {locating ? "Finding your location…" : "Use my current location"}
                </Button>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{point ? "Delivery pin set" : "Choose a delivery pin to continue"}</p>
            </div>
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={!point || saving || locating}>{saving ? "Saving…" : "Save delivery address"}</Button>
        </form>
    )
}
