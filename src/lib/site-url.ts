const DEFAULT_SITE_URL = "https://www.myrss.com.ng"

function normalizeSiteUrl(value: string | null | undefined) {
    if (!value) {
        return null
    }

    const normalized = value.trim().replace(/\/+$/, "")
    return normalized.length > 0 ? normalized : null
}

function isLocalHostName(hostname: string | null | undefined) {
    if (!hostname) {
        return false
    }

    if (hostname === "::1") {
        return true
    }

    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) {
        const [firstOctet, secondOctet] = hostname.split(".").map((segment) => Number(segment))

        return firstOctet === 127
            || firstOctet === 10
            || (firstOctet === 192 && secondOctet === 168)
            || (firstOctet === 172 && secondOctet >= 16 && secondOctet <= 31)
    }

    return hostname === "localhost"
        || hostname === "127.0.0.1"
        || hostname === "0.0.0.0"
        || hostname.endsWith(".local")
}

export function getConfiguredSiteUrl() {
    return normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL)
        ?? normalizeSiteUrl(process.env.SITE_URL)
        ?? DEFAULT_SITE_URL
}

export function getClientSiteUrl() {
    if (typeof window === "undefined") {
        return getConfiguredSiteUrl()
    }

    return isLocalHostName(window.location.hostname)
        ? window.location.origin
        : getConfiguredSiteUrl()
}

export function getServerSiteUrl(request?: Request) {
    const configuredSiteUrl = getConfiguredSiteUrl()

    if (!request) {
        return configuredSiteUrl
    }

    const url = new URL(request.url)
    const forwardedHost = request.headers.get("x-forwarded-host")
    const forwardedProto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "")
    const host = forwardedHost ?? url.host
    const hostname = (forwardedHost ?? url.hostname).split(":")[0]

    if (isLocalHostName(hostname)) {
        return `${url.protocol}//${url.host}`
    }

    return configuredSiteUrl || `${forwardedProto}://${host}`
}

export function buildAbsoluteUrl(baseUrl: string, pathname: string, params?: Record<string, string | null | undefined>) {
    const url = new URL(pathname, `${baseUrl}/`)

    for (const [key, value] of Object.entries(params ?? {})) {
        const normalized = value?.trim()

        if (!normalized) {
            continue
        }

        url.searchParams.set(key, normalized)
    }

    return url.toString()
}
