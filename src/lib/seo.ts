import type { Metadata } from "next"
import { koboToNaira } from "@/lib/money"
import {
    buildAbsoluteUrl,
    getConfiguredSiteUrl,
} from "@/lib/site-url"
import {
    getStorefrontCategoryDescription,
    getStorefrontCategoryLabel,
    type StorefrontCategorySlug,
} from "@/lib/categories"

export const SITE_NAME = "RSS Foods"
export const SITE_ORIGIN = getConfiguredSiteUrl()
export const DEFAULT_OG_IMAGE_PATH = "/assets/hero-banner.png"
export const DEFAULT_SITE_DESCRIPTION = "Shop premium groceries, fresh produce, and household essentials online. Fast delivery across Nigeria."

const TITLE_LIMIT = 60
const DESCRIPTION_LIMIT = 160
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const UUID_SUFFIX_PATTERN = /([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i

interface SeoMetadataInput {
    canonicalPath?: string
    description: string
    images?: Array<string | null | undefined>
    index?: boolean
    keywords?: string[]
    path: string
    title: string
    type?: "article" | "website"
}

export interface ProductSeoSource {
    category: string
    description: string | null
    id: string
    imageUrl?: string | null
    name: string
    price: number
    salesType?: string | null
    seoDescription?: string | null
    seoTitle?: string | null
    state?: string | null
    tags?: string[] | null
    weight?: string | null
}

export interface ProductJsonLdInput {
    availability: "https://schema.org/InStock" | "https://schema.org/OutOfStock"
    breadcrumbItems: Array<{ name: string; path: string }>
    canonicalPath: string
    categoryLabel: string
    description: string
    imageUrls: string[]
    name: string
    priceKobo: number
    reviewCount: number
    sellerName: string
    sku: string
    averageRating?: number | null
}

export interface CollectionJsonLdInput {
    breadcrumbItems: Array<{ name: string; path: string }>
    canonicalPath: string
    description: string
    name: string
}

function trimWhitespace(value: string | null | undefined) {
    return value?.replace(/\s+/g, " ").trim() ?? ""
}

function clampText(value: string, limit: number) {
    const normalized = trimWhitespace(value)

    if (normalized.length <= limit) {
        return normalized
    }

    if (limit <= 3) {
        return normalized.slice(0, limit)
    }

    return `${normalized.slice(0, limit - 3).trimEnd()}...`
}

function toKeywordList(values: Array<string | null | undefined>) {
    return Array.from(
        new Set(
            values
                .map((value) => trimWhitespace(value))
                .filter(Boolean)
        )
    )
}

export function resolveSeoImageUrl(value?: string | null) {
    const normalized = trimWhitespace(value)

    if (!normalized) {
        return buildAbsoluteUrl(SITE_ORIGIN, DEFAULT_OG_IMAGE_PATH)
    }

    if (/^https?:\/\//i.test(normalized)) {
        return normalized
    }

    return buildAbsoluteUrl(SITE_ORIGIN, normalized.startsWith("/") ? normalized : `/${normalized}`)
}

export function buildSeoMetadata({
    canonicalPath,
    description,
    images,
    index = true,
    keywords,
    path,
    title,
    type = "website",
}: SeoMetadataInput): Metadata {
    const normalizedTitle = clampText(title, TITLE_LIMIT)
    const normalizedDescription = clampText(description, DESCRIPTION_LIMIT)
    const canonical = canonicalPath ?? path
    const openGraphImages = (images?.length ? images : [DEFAULT_OG_IMAGE_PATH]).map((image) => ({
        alt: normalizedTitle,
        url: resolveSeoImageUrl(image),
    }))

    return {
        alternates: {
            canonical,
        },
        description: normalizedDescription,
        keywords: keywords && keywords.length > 0 ? keywords : undefined,
        openGraph: {
            description: normalizedDescription,
            images: openGraphImages,
            locale: "en_NG",
            siteName: SITE_NAME,
            title: normalizedTitle,
            type,
            url: canonical,
        },
        robots: {
            follow: true,
            index,
        },
        title: normalizedTitle,
        twitter: {
            card: "summary_large_image",
            description: normalizedDescription,
            images: openGraphImages.map((image) => image.url),
            title: normalizedTitle,
        },
    }
}

export function slugifySegment(value: string) {
    const normalized = value
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")

    return normalized || "product"
}

export function isUuid(value: string | null | undefined): value is string {
    return UUID_PATTERN.test(trimWhitespace(value))
}

export function extractUuidFromSlugParam(value: string | null | undefined) {
    const normalized = trimWhitespace(value)

    if (!normalized) {
        return null
    }

    if (isUuid(normalized)) {
        return normalized
    }

    const suffixMatch = String(normalized).match(UUID_SUFFIX_PATTERN)

    return suffixMatch?.[1] ?? null
}

export function buildCanonicalProductPath(name: string, id: string) {
    return `/products/${slugifySegment(name)}-${id}`
}

export function buildStorefrontCategoryPath(salesType: "retail" | "wholesale", category: StorefrontCategorySlug) {
    return `/${salesType}/category/${category}`
}

export function buildCategoryMetadataCopy(salesType: "retail" | "wholesale", category: StorefrontCategorySlug) {
    const categoryLabel = getStorefrontCategoryLabel(category)
    const description = getStorefrontCategoryDescription(category)
    const audienceLabel = salesType === "wholesale" ? "wholesale" : "retail"

    return {
        description: clampText(
            `${description} Browse ${categoryLabel.toLowerCase()} listings on RSS Foods for ${audienceLabel} buyers across Nigeria.`,
            DESCRIPTION_LIMIT
        ),
        title: clampText(`${categoryLabel} ${salesType === "wholesale" ? "Wholesale" : "Retail"} | RSS Foods`, TITLE_LIMIT),
    }
}

export function buildProductSeoCopy(product: ProductSeoSource) {
    const categoryLabel = getStorefrontCategoryLabel(product.category)
    const salesLabel = product.salesType === "wholesale" ? "wholesale" : "retail"
    const stateLabel = trimWhitespace(product.state)
    const weightLabel = trimWhitespace(product.weight)
    const fallbackTitle = [
        product.name,
        weightLabel || null,
        stateLabel ? `in ${stateLabel}` : null,
        "RSS Foods",
    ].filter(Boolean).join(" | ")

    const descriptionParts = [
        trimWhitespace(product.description),
        categoryLabel ? `${categoryLabel} ${salesLabel} listing` : null,
        stateLabel ? `Available from ${stateLabel}` : null,
        weightLabel ? `Size: ${weightLabel}` : null,
        product.tags?.length ? `Tags: ${product.tags.slice(0, 3).join(", ")}` : null,
    ].filter(Boolean)

    const fallbackDescription = descriptionParts.join(". ")

    return {
        description: clampText(product.seoDescription || fallbackDescription || DEFAULT_SITE_DESCRIPTION, DESCRIPTION_LIMIT),
        keywords: toKeywordList([
            product.name,
            categoryLabel,
            product.salesType,
            product.state,
            ...(product.tags ?? []),
        ]),
        title: clampText(product.seoTitle || fallbackTitle, TITLE_LIMIT),
    }
}

export function createBreadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, index) => ({
            "@type": "ListItem",
            item: buildAbsoluteUrl(SITE_ORIGIN, item.path),
            name: item.name,
            position: index + 1,
        })),
    }
}

export function createOrganizationJsonLd() {
    return {
        "@context": "https://schema.org",
        "@type": "Organization",
        logo: resolveSeoImageUrl("/logo.png"),
        name: SITE_NAME,
        url: SITE_ORIGIN,
    }
}

export function createWebSiteJsonLd() {
    return {
        "@context": "https://schema.org",
        "@type": "WebSite",
        description: DEFAULT_SITE_DESCRIPTION,
        name: SITE_NAME,
        url: SITE_ORIGIN,
    }
}

export function createCollectionPageJsonLd({
    breadcrumbItems,
    canonicalPath,
    description,
    name,
}: CollectionJsonLdInput) {
    return [
        {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            description,
            name,
            url: buildAbsoluteUrl(SITE_ORIGIN, canonicalPath),
        },
        createBreadcrumbJsonLd(breadcrumbItems),
    ]
}

export function createProductJsonLd({
    availability,
    averageRating,
    breadcrumbItems,
    canonicalPath,
    categoryLabel,
    description,
    imageUrls,
    name,
    priceKobo,
    reviewCount,
    sellerName,
    sku,
}: ProductJsonLdInput) {
    const productJsonLd: Record<string, unknown> = {
        "@context": "https://schema.org",
        "@type": "Product",
        brand: {
            "@type": "Brand",
            name: SITE_NAME,
        },
        category: categoryLabel,
        description,
        image: imageUrls.map((image) => resolveSeoImageUrl(image)),
        name,
        offers: {
            "@type": "Offer",
            availability,
            itemCondition: "https://schema.org/NewCondition",
            price: koboToNaira(priceKobo).toFixed(2),
            priceCurrency: "NGN",
            seller: {
                "@type": "Organization",
                name: sellerName,
            },
            url: buildAbsoluteUrl(SITE_ORIGIN, canonicalPath),
        },
        sku,
        url: buildAbsoluteUrl(SITE_ORIGIN, canonicalPath),
    }

    if (reviewCount > 0 && averageRating && Number.isFinite(averageRating)) {
        productJsonLd.aggregateRating = {
            "@type": "AggregateRating",
            bestRating: 5,
            ratingCount: reviewCount,
            ratingValue: averageRating.toFixed(1),
            worstRating: 1,
        }
    }

    return [
        productJsonLd,
        createBreadcrumbJsonLd(breadcrumbItems),
    ]
}
