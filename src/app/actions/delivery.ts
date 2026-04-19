"use server"

import { getDeliverySettings } from "@/app/actions/settingsActions"

/**
 * Calculates delivery fee in kobo based on customer lat/lng
 * using the Haversine formula for distance from the origin.
 */
export async function calculateDeliveryFee(
    lat: number,
    lng: number
): Promise<{ fee: number; distance: number }> {
    const settings = await getDeliverySettings()

    if (
        !Number.isFinite(lat)
        || !Number.isFinite(lng)
        || !Number.isFinite(settings.originLat)
        || !Number.isFinite(settings.originLng)
    ) {
        return {
            fee: Math.max(0, settings.baseFareKobo),
            distance: 0,
        }
    }

    const distanceKm = haversineDistance(
        settings.originLat,
        settings.originLng,
        lat,
        lng
    )

    const feeKobo = settings.baseFareKobo + Math.round(distanceKm * settings.distanceRateKoboPerKm)

    return {
        fee: Math.max(0, feeKobo),
        distance: distanceKm,
    }
}

function haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const R = 6371 // Earth radius in km
    const dLat = toRad(lat2 - lat1)
    const dLon = toRad(lon2 - lon1)

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
            Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2)

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
}

function toRad(deg: number): number {
    return deg * (Math.PI / 180)
}
