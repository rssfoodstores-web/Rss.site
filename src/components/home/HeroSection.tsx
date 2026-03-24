import { createClient } from "@/lib/supabase/server"
import { HeroSectionClient, type HeroSlide } from "./HeroSectionClient"

const fallbackSlides: HeroSlide[] = [
    {
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
    },
]

export async function HeroSection() {
    const supabase = await createClient()
    const { data } = await supabase
        .from("hero_carousel_slides")
        .select("id, marketing_mode, eyebrow_text, title, highlight_text, body_text, button_text, button_url, media_type, media_url")
        .eq("placement", "storefront")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true })

    const slides: HeroSlide[] = Array.isArray(data) && data.length > 0
        ? data.map((slide) => ({
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
        : fallbackSlides

    return <HeroSectionClient slides={slides} />
}
