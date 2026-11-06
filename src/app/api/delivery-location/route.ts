import { NextResponse } from "next/server"
import { deliveryState, isDeliveryPoint } from "@/lib/deliveryAddresses"

interface AddressComponent {
    long_name: string
    types: string[]
}

interface GeocodingResult {
    formatted_address: string
    address_components: AddressComponent[]
}

export async function POST(request: Request) {
    const origin = request.headers.get("origin")
    const expectedOrigin = new URL(request.url).origin
    if (origin && origin !== expectedOrigin) return new Response(null, { status: 403 })

    const point: unknown = await request.json().catch(() => null)
    if (!isDeliveryPoint(point)) return new Response(null, { status: 400 })

    const key = process.env.GOOGLE_GEOCODING_API_KEY?.trim()
    if (!key) return new Response(null, { status: 204 })

    try {
        const url = new URL("https://maps.googleapis.com/maps/api/geocode/json")
        url.searchParams.set("latlng", `${point.lat},${point.lng}`)
        url.searchParams.set("key", key)
        const response = await fetch(url, { signal: AbortSignal.timeout(4800), cache: "no-store" })
        if (!response.ok) return new Response(null, { status: 502 })

        const { results } = await response.json() as { results?: GeocodingResult[] }
        const result = results?.find((entry) => entry.formatted_address && Array.isArray(entry.address_components))
        if (!result) return new Response(null, { status: 404 })

        const component = (...types: string[]) => types.map((type) =>
            result.address_components.find((item) => item.types.includes(type))?.long_name,
        ).find(Boolean) ?? ""
        return NextResponse.json({
            address: result.formatted_address.slice(0, 500),
            area: component("sublocality_level_1", "neighborhood", "locality"),
            state: deliveryState(component("administrative_area_level_1")) ?? "",
        }, { headers: { "Cache-Control": "no-store" } })
    } catch {
        return new Response(null, { status: 502 })
    }
}
