"use client"

interface CloudinaryImageOptions {
    fit?: "limit" | "fill" | "pad"
    format?: "auto" | "avif" | "jpg" | "png" | "webp"
    height?: number
    quality?: "auto" | number
    width?: number
}

const CLOUDINARY_UPLOAD_SEGMENT = "/image/upload/"
const CLOUDINARY_HOST_PATTERN = /(^|\.)res\.cloudinary\.com$/i

function isPositiveNumber(value: number | undefined): value is number {
    return typeof value === "number" && Number.isFinite(value) && value > 0
}

function isCloudinaryDeliveryUrl(value: string) {
    try {
        const url = new URL(value)
        return CLOUDINARY_HOST_PATTERN.test(url.hostname) && url.pathname.includes(CLOUDINARY_UPLOAD_SEGMENT)
    } catch {
        return false
    }
}

export function buildOptimizedImageUrl(src: string | null | undefined, options: CloudinaryImageOptions = {}) {
    if (!src) {
        return ""
    }

    const trimmedSrc = src.trim()
    if (!trimmedSrc || !isCloudinaryDeliveryUrl(trimmedSrc)) {
        return trimmedSrc
    }

    const transformations = [
        `f_${options.format ?? "auto"}`,
        `q_${options.quality ?? "auto"}`,
        `c_${options.fit ?? "limit"}`,
        isPositiveNumber(options.width) ? `w_${Math.round(options.width)}` : null,
        isPositiveNumber(options.height) ? `h_${Math.round(options.height)}` : null,
    ].filter(Boolean)

    return trimmedSrc.replace(
        CLOUDINARY_UPLOAD_SEGMENT,
        `${CLOUDINARY_UPLOAD_SEGMENT}${transformations.join(",")}/`
    )
}

export function shouldBypassNextImageOptimizer(src: string | null | undefined) {
    if (!src) {
        return false
    }

    return isCloudinaryDeliveryUrl(src.trim())
}
