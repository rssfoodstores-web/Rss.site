import type { Coordinates } from "@/lib/directions"
import { getNigerianStateFilterCandidates, NIGERIAN_STATES } from "@/lib/constants/nigerianStates"

export interface DeliveryAddress extends Coordinates {
    id: string
    label: string
    address: string
}

export interface DeliveryLocationDetails {
    address: string
    area: string
    state: string
}

export type ShoppingDestination =
    | { kind: "address"; id: string }
    | { kind: "gps"; location: Coordinates; state?: string; details?: DeliveryLocationDetails }

export function deliveryState(address: string) {
    const parts = address.toLowerCase().split(",").map((part) => part.trim().replace(/\s+\d{6}$/, ""))
    return NIGERIAN_STATES.find((state) => getNigerianStateFilterCandidates(state).some((candidate) =>
        parts.includes(candidate.toLowerCase()),
    ))
}

export function getCurrentDeliveryCoordinates(): Promise<Coordinates> {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error("Location access is unavailable. Choose a saved delivery address or browse first."))
            return
        }
        navigator.geolocation.getCurrentPosition(
            ({ coords }) => {
                if (!Number.isFinite(coords.accuracy) || coords.accuracy > 500) {
                    reject(new Error("The location is too broad. Try again with precise location enabled."))
                    return
                }
                resolve({ lat: coords.latitude, lng: coords.longitude })
            },
            () => reject(new Error("We couldn't get your location. Allow location access and try again, or browse first.")),
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
        )
    })
}

export async function findDeliveryLocation(location: Coordinates): Promise<DeliveryLocationDetails | undefined> {
    try {
        const response = await fetch("/api/delivery-location", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(location),
            signal: AbortSignal.timeout(6500),
        })
        if (response.ok) {
            const data: unknown = await response.json()
            if (data && typeof data === "object" && "address" in data && "area" in data && "state" in data &&
                typeof data.address === "string" && typeof data.area === "string" && typeof data.state === "string") {
                return { address: data.address, area: data.area, state: data.state }
            }
        }
    } catch {
        // A failed address lookup does not invalidate the GPS point.
    }
}

export function isDeliveryPoint(value: unknown): value is Coordinates {
    if (!value || typeof value !== "object" || !("lat" in value) || !("lng" in value)) return false
    const { lat, lng } = value
    return typeof lat === "number" && Math.abs(lat) <= 90 &&
        typeof lng === "number" && Math.abs(lng) <= 180
}
