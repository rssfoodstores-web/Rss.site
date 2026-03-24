'use server'

import { createClient } from "@/lib/supabase/server"

export interface DeliverySettings {
    baseFareKobo: number
    distanceRateKoboPerKm: number
    originState: string
    originLat: number
    originLng: number
    riderShareBps: number
    corporateDeliveryShareBps: number
}

const DEFAULT_DELIVERY_SETTINGS: DeliverySettings = {
    baseFareKobo: 100_000,
    distanceRateKoboPerKm: 10_000,
    originState: "Lagos",
    originLat: 6.5244,
    originLng: 3.3792,
    riderShareBps: 8_000,
    corporateDeliveryShareBps: 2_000,
}

export async function getDeliverySettings(): Promise<DeliverySettings> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "delivery_settings")
        .single()

    if (error || !data?.value || typeof data.value !== "object") {
        if (error) {
            console.error("Error fetching delivery settings:", error)
        }

        return DEFAULT_DELIVERY_SETTINGS
    }

    const rawSettings = data.value as Record<string, unknown>

    return {
        baseFareKobo: Number(rawSettings.base_fare_kobo ?? DEFAULT_DELIVERY_SETTINGS.baseFareKobo),
        distanceRateKoboPerKm: Number(
            rawSettings.distance_rate_kobo_per_km ?? DEFAULT_DELIVERY_SETTINGS.distanceRateKoboPerKm
        ),
        originState: String(rawSettings.origin_state ?? DEFAULT_DELIVERY_SETTINGS.originState),
        originLat: Number(rawSettings.origin_lat ?? DEFAULT_DELIVERY_SETTINGS.originLat),
        originLng: Number(rawSettings.origin_lng ?? DEFAULT_DELIVERY_SETTINGS.originLng),
        riderShareBps: Number(rawSettings.rider_share_bps ?? DEFAULT_DELIVERY_SETTINGS.riderShareBps),
        corporateDeliveryShareBps: Number(
            rawSettings.corporate_delivery_share_bps ?? DEFAULT_DELIVERY_SETTINGS.corporateDeliveryShareBps
        ),
    }
}
