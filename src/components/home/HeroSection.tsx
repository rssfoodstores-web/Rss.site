import { createClient } from "@/lib/supabase/server"
import {
    DEFAULT_STOREFRONT_HERO_SLIDE,
    resolveStorefrontHeroDefaultSlide,
    STOREFRONT_HERO_DEFAULT_SETTING_KEY,
} from "@/lib/storefront-hero"
import { HeroSectionClient, type HeroSlide } from "./HeroSectionClient"

export async function HeroSection() {
    const supabase = await createClient()
    const [{ data: slidesData }, { data: defaultSlideSetting }] = await Promise.all([
        supabase
            .from("hero_carousel_slides")
            .select("id, marketing_mode, eyebrow_text, title, highlight_text, body_text, button_text, button_url, media_type, media_url")
            .eq("placement", "storefront")
            .eq("is_active", true)
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: true }),
        supabase
            .from("app_settings")
            .select("value")
            .eq("key", STOREFRONT_HERO_DEFAULT_SETTING_KEY)
            .maybeSingle(),
    ])

    const slides: HeroSlide[] = Array.isArray(slidesData) && slidesData.length > 0
        ? slidesData.map((slide) => ({
            bodyText: slide.body_text ?? null,
            buttonText: slide.button_text ?? null,
            buttonUrl: slide.button_url ?? null,
            eyebrowText: slide.eyebrow_text ?? null,
            highlightText: slide.highlight_text ?? null,
            id: slide.id,
            marketingMode: slide.marketing_mode ?? "standard",
            mediaType: slide.media_type === "video" ? "video" : "image",
            mediaUrl: slide.media_url,
            title: slide.title,
        }))
        : [defaultSlideSetting?.value ? resolveStorefrontHeroDefaultSlide(defaultSlideSetting.value) : DEFAULT_STOREFRONT_HERO_SLIDE]

    return <HeroSectionClient slides={slides} />
}
