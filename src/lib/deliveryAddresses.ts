import type { Coordinates } from "@/lib/directions"

export interface DeliveryAddress extends Coordinates {
    id: string
    label: string
    address: string
}

export type ShoppingDestination =
    | { kind: "address"; id: string }
    | { kind: "gps"; location: Coordinates }

export function getCurrentDeliveryCoordinates(): Promise<Coordinates> {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error("Location access is unavailable. Choose a delivery address instead."))
            return
        }
        navigator.geolocation.getCurrentPosition(
            ({ coords }) => resolve({ lat: coords.latitude, lng: coords.longitude }),
            () => reject(new Error("We couldn't get your current location. Allow location access or choose a delivery address.")),
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
        )
    })
}

export function isDeliveryPoint(value: unknown): value is Coordinates {
    if (!value || typeof value !== "object" || !("lat" in value) || !("lng" in value)) return false
    const { lat, lng } = value
    return typeof lat === "number" && Math.abs(lat) <= 90 &&
        typeof lng === "number" && Math.abs(lng) <= 180
}
