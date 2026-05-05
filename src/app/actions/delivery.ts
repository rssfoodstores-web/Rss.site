"use server"

import { getDeliverySettings } from "@/app/actions/settingsActions"
import { parseCoordinates, type Coordinates } from "@/lib/directions"
import { createClient } from "@/lib/supabase/server"

interface DeliveryFeeResult {
    fee: number
    distance: number
    error?: string
}

interface MerchantLocationRow {
    location: unknown
}

interface OrderDeliveryLocation {
    coordinates: [number, number]
    type: "Point"
}

interface OrderItemInput {
    product_id: string
    quantity: number
}

async function getMerchantOrigin(merchantId: string): Promise<Coordinates | null> {
    const supabase = await createClient()

    const [merchantResult, profileResult] = await Promise.all([
        supabase
            .from("merchants")
            .select("location")
            .eq("id", merchantId)
            .maybeSingle(),
        supabase
            .from("profiles")
            .select("location")
            .eq("id", merchantId)
            .maybeSingle(),
    ])

    const merchantLocation = parseCoordinates((merchantResult.data as MerchantLocationRow | null)?.location ?? null)
    if (merchantLocation) {
        return merchantLocation
    }

    return parseCoordinates((profileResult.data as MerchantLocationRow | null)?.location ?? null)
}

async function getOrderMerchantId(items: OrderItemInput[]): Promise<string | null> {
    const productIds = [...new Set(items.map((item) => item.product_id).filter(Boolean))]

    if (productIds.length === 0) {
        return null
    }

    const supabase = await createClient()
    const { data, error } = await supabase
        .from("products")
        .select("merchant_id")
        .in("id", productIds)

    if (error || !data?.length) {
        return null
    }

    const merchantIds = [...new Set(data.map((product) => product.merchant_id).filter(Boolean))]

    return merchantIds.length === 1 ? merchantIds[0] : null
}

/**
 * Calculates delivery fee in kobo based on customer lat/lng
 * using the Haversine formula for distance from the merchant pickup location.
 */
export async function calculateDeliveryFee(
    lat: number,
    lng: number,
    merchantId: string
): Promise<DeliveryFeeResult> {
    const settings = await getDeliverySettings()
    const merchantOrigin = merchantId ? await getMerchantOrigin(merchantId) : null

    if (
        !Number.isFinite(lat)
        || !Number.isFinite(lng)
        || !merchantOrigin
        || !Number.isFinite(merchantOrigin.lat)
        || !Number.isFinite(merchantOrigin.lng)
    ) {
        return {
            fee: 0,
            distance: 0,
            error: "Merchant pickup location is not set, so delivery cannot be priced accurately.",
        }
    }

    const distanceKm = haversineDistance(
        merchantOrigin.lat,
        merchantOrigin.lng,
        lat,
        lng
    )

    const feeKobo = settings.baseFareKobo + Math.round(distanceKm * settings.distanceRateKoboPerKm)

    return {
        fee: Math.max(0, feeKobo),
        distance: distanceKm,
    }
}

export async function calculateOrderDeliveryFee(
    items: OrderItemInput[],
    deliveryLocation: OrderDeliveryLocation | null
): Promise<DeliveryFeeResult> {
    if (!deliveryLocation) {
        return {
            fee: 0,
            distance: 0,
            error: "Delivery location is required.",
        }
    }

    const [lng, lat] = deliveryLocation.coordinates
    const merchantId = await getOrderMerchantId(items)

    if (!merchantId) {
        return {
            fee: 0,
            distance: 0,
            error: "Cart must contain valid items from one merchant before delivery can be priced.",
        }
    }

    return calculateDeliveryFee(lat, lng, merchantId)
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
