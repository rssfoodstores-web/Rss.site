export interface Coordinates {
    lat: number
    lng: number
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value)
}

function parseEwkbPointHex(value: string): Coordinates | null {
    const trimmed = value.trim()

    if (!/^[0-9a-fA-F]+$/.test(trimmed) || trimmed.length < 42) {
        return null
    }

    try {
        const hexPairs = trimmed.match(/.{1,2}/g)
        if (!hexPairs) {
            return null
        }

        const bytes = Uint8Array.from(hexPairs.map((pair) => Number.parseInt(pair, 16)))
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
        const byteOrder = view.getUint8(0)
        const littleEndian = byteOrder === 1

        if (!littleEndian && byteOrder !== 0) {
            return null
        }

        const type = view.getUint32(1, littleEndian)
        const hasSrid = (type & 0x20000000) !== 0
        const baseType = type & 0x0fffffff

        if (baseType !== 1) {
            return null
        }

        let offset = 5
        if (hasSrid) {
            view.getUint32(offset, littleEndian)
            offset += 4
        }

        if (bytes.length < offset + 16) {
            return null
        }

        const lng = view.getFloat64(offset, littleEndian)
        const lat = view.getFloat64(offset + 8, littleEndian)

        if (
            Number.isFinite(lat)
            && Number.isFinite(lng)
            && lat >= -90
            && lat <= 90
            && lng >= -180
            && lng <= 180
        ) {
            return { lat, lng }
        }
    } catch {
        return null
    }

    return null
}

export function parseCoordinates(value: unknown): Coordinates | null {
    if (typeof value === "string") {
        const trimmed = value.trim()

        if (trimmed.startsWith("{")) {
            try {
                return parseCoordinates(JSON.parse(trimmed))
            } catch {
                return null
            }
        }

        const pointMatch = trimmed.match(/^POINT\(([-\d.]+)\s+([-\d.]+)\)$/i)
        if (pointMatch) {
            const lng = Number(pointMatch[1])
            const lat = Number(pointMatch[2])

            if (Number.isFinite(lat) && Number.isFinite(lng)) {
                return { lat, lng }
            }
        }

        const ewkbCoordinates = parseEwkbPointHex(trimmed)
        if (ewkbCoordinates) {
            return ewkbCoordinates
        }
    }

    if (!value || typeof value !== "object") {
        return null
    }

    const location = value as {
        coordinates?: unknown
        lat?: unknown
        lng?: unknown
        latitude?: unknown
        longitude?: unknown
    }

    if (Array.isArray(location.coordinates) && location.coordinates.length >= 2) {
        const [lng, lat] = location.coordinates

        if (isFiniteNumber(lat) && isFiniteNumber(lng)) {
            return { lat, lng }
        }
    }

    if (isFiniteNumber(location.lat) && isFiniteNumber(location.lng)) {
        return { lat: location.lat, lng: location.lng }
    }

    if (isFiniteNumber(location.latitude) && isFiniteNumber(location.longitude)) {
        return { lat: location.latitude, lng: location.longitude }
    }

    return null
}

interface BuildNavigationUrlArgs {
    destination: {
        coordinates?: Coordinates | null
        address?: string | null
    }
    origin?: Coordinates | null
}

function isAppleMapsPreferred() {
    if (typeof navigator === "undefined") {
        return false
    }

    return /iPhone|iPad|iPod/i.test(navigator.userAgent)
}

function buildGoogleMapsUrl({
    destinationCoordinates,
    destinationAddress,
    origin,
}: {
    destinationCoordinates: Coordinates | null
    destinationAddress: string | null
    origin: Coordinates | null
}) {
    const url = new URL("https://www.google.com/maps/dir/")
    url.searchParams.set("api", "1")
    url.searchParams.set("travelmode", "driving")

    if (origin) {
        url.searchParams.set("origin", `${origin.lat},${origin.lng}`)
    }

    if (destinationCoordinates) {
        url.searchParams.set("destination", `${destinationCoordinates.lat},${destinationCoordinates.lng}`)
        return url.toString()
    }

    if (destinationAddress) {
        url.searchParams.set("destination", destinationAddress)
        return url.toString()
    }

    return null
}

function buildAppleMapsUrl({
    destinationCoordinates,
    destinationAddress,
    origin,
}: {
    destinationCoordinates: Coordinates | null
    destinationAddress: string | null
    origin: Coordinates | null
}) {
    const url = new URL("https://maps.apple.com/")
    url.searchParams.set("dirflg", "d")

    if (origin) {
        url.searchParams.set("saddr", `${origin.lat},${origin.lng}`)
    }

    if (destinationCoordinates) {
        url.searchParams.set("daddr", `${destinationCoordinates.lat},${destinationCoordinates.lng}`)
        return url.toString()
    }

    if (destinationAddress) {
        url.searchParams.set("daddr", destinationAddress)
        return url.toString()
    }

    return null
}

export function buildNavigationUrl({ destination, origin }: BuildNavigationUrlArgs): string | null {
    const destinationCoordinates = destination.coordinates ?? null
    const destinationAddress = destination.address?.trim() || null

    if (!destinationCoordinates && !destinationAddress) {
        return null
    }

    if (isAppleMapsPreferred()) {
        return buildAppleMapsUrl({
            destinationCoordinates,
            destinationAddress,
            origin: origin ?? null,
        })
    }

    return buildGoogleMapsUrl({
        destinationCoordinates,
        destinationAddress,
        origin: origin ?? null,
    })
}
