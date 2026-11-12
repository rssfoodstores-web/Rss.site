import type { Coordinates } from "@/lib/directions"

export interface DeliveryContact {
    name: string
    phone: string | null
}

export interface RiderDelivery {
    id: string
    status: string | null
    pickupCode: string | null
    pickup: DeliveryContact & { address: string | null; coordinates: Coordinates | null }
    dropoff: DeliveryContact & { address: string | null; coordinates: Coordinates | null }
    backupPhones: string[]
    agent: DeliveryContact | null
    payout: number | null
    items: { id: string; name: string; quantity: number }[]
}

export interface RiderDeliveryOffer {
    id: string
    merchant_name: string | null
    merchant_address: string | null
    rider_payout_kobo: number | null
}

export interface RiderDeliveryHistory {
    id: string
    merchantName: string
    payout: number | null
    date: string | null
}

export function deliveryNumber(id: string) {
    return id.slice(0, 8).toUpperCase()
}

export function needsHandoff(status: string | null) {
    return status === "ready_for_pickup" || status === "out_for_delivery" || status === "return_in_transit"
}
