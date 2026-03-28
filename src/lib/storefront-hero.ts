import type { HeroSlide } from "@/components/home/HeroSectionClient"

export const STOREFRONT_HERO_DEFAULT_SETTING_KEY = "storefront_hero_default_slide" as const

const MARKETING_MODES = new Set(["standard", "cook_off", "discount_bundles"])

export const DEFAULT_STOREFRONT_HERO_SLIDE: HeroSlide = {
    bodyText: "Premium groceries, fresh produce, and household staples delivered with speed across Nigeria.",
    buttonText: "Shop now",
    buttonUrl: "/retail",
    eyebrowText: "Sale up to 48% off",
    highlightText: "Organic Food",
    id: "fallback-hero-slide",
    marketingMode: "standard",
    mediaType: "image",
    mediaUrl: "/assets/hero-banner.png",
    title: "Fresh & Healthy",
}

function readString(record: Record<string, unknown>, key: string, fallback: string | null) {
    const value = record[key]
    return typeof value === "string" ? value : fallback
}

export function resolveStorefrontHeroDefaultSlide(value: unknown): HeroSlide {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return DEFAULT_STOREFRONT_HERO_SLIDE
    }

    const record = value as Record<string, unknown>
    const marketingMode = readString(record, "marketing_mode", DEFAULT_STOREFRONT_HERO_SLIDE.marketingMode) ?? DEFAULT_STOREFRONT_HERO_SLIDE.marketingMode

    return {
        bodyText: readString(record, "body_text", DEFAULT_STOREFRONT_HERO_SLIDE.bodyText),
        buttonText: readString(record, "button_text", DEFAULT_STOREFRONT_HERO_SLIDE.buttonText),
        buttonUrl: readString(record, "button_url", DEFAULT_STOREFRONT_HERO_SLIDE.buttonUrl),
        eyebrowText: readString(record, "eyebrow_text", DEFAULT_STOREFRONT_HERO_SLIDE.eyebrowText),
        highlightText: readString(record, "highlight_text", DEFAULT_STOREFRONT_HERO_SLIDE.highlightText),
        id: "fallback-hero-slide",
        marketingMode: MARKETING_MODES.has(marketingMode) ? marketingMode : DEFAULT_STOREFRONT_HERO_SLIDE.marketingMode,
        mediaType: record.media_type === "video" ? "video" : "image",
        mediaUrl: readString(record, "media_url", DEFAULT_STOREFRONT_HERO_SLIDE.mediaUrl) ?? DEFAULT_STOREFRONT_HERO_SLIDE.mediaUrl,
        title: readString(record, "title", DEFAULT_STOREFRONT_HERO_SLIDE.title) ?? DEFAULT_STOREFRONT_HERO_SLIDE.title,
    }
}
