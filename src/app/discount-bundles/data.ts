import { createClient } from "@/lib/supabase/server"
import {
    calculateBundleSavingsPercent,
    normalizeDiscountBundleFeaturePoints,
} from "@/lib/discountBundles"
import type { Tables } from "@/types/database.types"

type DiscountBundleRow = Tables<"discount_bundles">
type DiscountBundleItemRow = Tables<"discount_bundle_items">
type DiscountBundlePageRow = Tables<"discount_bundle_page_content">

interface BundleProductRow {
    id: string
    image_url: string | null
    merchant_id: string
    name: string
    price: number
    stock_level: number | null
}

interface DiscountBundleWithProductRow extends DiscountBundleRow {
    product?: BundleProductRow | null
}

interface DiscountBundleItemWithProductRow extends DiscountBundleItemRow {
    product?: BundleProductRow | null
}

const PAGE_SLUG = "home-essential-bundles"

export interface PublicDiscountBundleItem {
    productId: string
    productImageUrl: string | null
    productName: string
    productPriceKobo: number
    productStockLevel: number | null
    quantity: number
}

export interface PublicDiscountBundle {
    badgeText: string | null
    bundlePriceKobo: number
    buttonText: string
    cardMediaType: "image" | "video"
    cardMediaUrl: string
    compareAtPriceKobo: number
    currentStock: number
    description: string | null
    id: string
    items: PublicDiscountBundleItem[]
    merchantId: string
    productId: string
    savingsPercent: number
    slug: string
    summary: string | null
    title: string
}

export interface PublicDiscountBundlePageContent {
    closingBody: string | null
    closingCtaText: string
    closingCtaUrl: string
    closingTitle: string
    description: string | null
    eyebrowText: string
    featurePoints: Array<{ body: string; title: string }>
    heroMediaType: "image" | "video"
    heroMediaUrl: string | null
    highlightText: string | null
    primaryCtaText: string
    primaryCtaUrl: string
    secondaryDescription: string | null
    secondaryHeading: string
    title: string
}

function mapPageContent(row: DiscountBundlePageRow | null): PublicDiscountBundlePageContent {
    return {
        closingBody: row?.closing_body ?? null,
        closingCtaText: row?.closing_cta_text ?? "View all bundles",
        closingCtaUrl: row?.closing_cta_url ?? "/discount-bundles",
        closingTitle: row?.closing_title ?? "Ready to start saving?",
        description: row?.description ?? null,
        eyebrowText: row?.eyebrow_text ?? "Save more with our",
        featurePoints: normalizeDiscountBundleFeaturePoints(row?.feature_points),
        heroMediaType: row?.hero_media_type === "video" ? "video" : "image",
        heroMediaUrl: row?.hero_media_url ?? null,
        highlightText: row?.highlight_text ?? null,
        primaryCtaText: row?.primary_cta_text ?? "View all bundles",
        primaryCtaUrl: row?.primary_cta_url ?? "/discount-bundles",
        secondaryDescription: row?.secondary_description ?? null,
        secondaryHeading: row?.secondary_heading ?? "Most Popular Bundles",
        title: row?.title ?? "Home Essential Bundles",
    }
}

function mapBundleItems(rows: DiscountBundleItemWithProductRow[], bundleId: string): PublicDiscountBundleItem[] {
    return rows
        .filter((item) => item.bundle_id === bundleId && item.product)
        .sort((left, right) => left.sort_order - right.sort_order)
        .map((item) => ({
            productId: item.product_id,
            productImageUrl: item.product?.image_url ?? null,
            productName: item.product?.name ?? "Unknown product",
            productPriceKobo: item.product?.price ?? 0,
            productStockLevel: item.product?.stock_level ?? null,
            quantity: item.quantity,
        }))
}

function mapBundle(bundle: DiscountBundleWithProductRow, items: DiscountBundleItemWithProductRow[]): PublicDiscountBundle {
    return {
        badgeText: bundle.badge_text ?? null,
        bundlePriceKobo: bundle.bundle_price_kobo,
        buttonText: bundle.button_text,
        cardMediaType: bundle.card_media_type === "video" ? "video" : "image",
        cardMediaUrl: bundle.card_media_url,
        compareAtPriceKobo: bundle.compare_at_price_kobo,
        currentStock: bundle.product?.stock_level ?? 0,
        description: bundle.description ?? null,
        id: bundle.id,
        items: mapBundleItems(items, bundle.id),
        merchantId: bundle.product?.merchant_id ?? "",
        productId: bundle.product_id,
        savingsPercent: calculateBundleSavingsPercent(bundle.bundle_price_kobo, bundle.compare_at_price_kobo),
        slug: bundle.slug,
        summary: bundle.summary ?? null,
        title: bundle.title,
    }
}

async function loadBundleItems(bundleIds: string[]) {
    if (bundleIds.length === 0) {
        return []
    }

    const supabase = await createClient()
    const { data, error } = await supabase
        .from("discount_bundle_items")
        .select("*, product:product_id(id, merchant_id, name, price, stock_level, image_url)")
        .in("bundle_id", bundleIds)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true })

    if (error) {
        throw new Error(error.message)
    }

    return (data ?? []) as DiscountBundleItemWithProductRow[]
}

export async function getDiscountBundlesPageData() {
    const supabase = await createClient()
    const [{ data: pageContentData, error: pageContentError }, { data: bundlesData, error: bundlesError }] = await Promise.all([
        supabase
            .from("discount_bundle_page_content")
            .select("*")
            .eq("slug", PAGE_SLUG)
            .maybeSingle(),
        supabase
            .from("discount_bundles")
            .select("*, product:product_id(id, merchant_id, name, price, stock_level, image_url)")
            .eq("status", "active")
            .order("is_featured", { ascending: false })
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: false }),
    ])

    if (pageContentError) throw new Error(pageContentError.message)
    if (bundlesError) throw new Error(bundlesError.message)

    const bundles = (bundlesData ?? []) as DiscountBundleWithProductRow[]
    const bundleItems = await loadBundleItems(bundles.map((bundle) => bundle.id))

    return {
        bundles: bundles.map((bundle) => mapBundle(bundle, bundleItems)),
        pageContent: mapPageContent((pageContentData ?? null) as DiscountBundlePageRow | null),
    }
}

export async function getDiscountBundleDetail(slug: string) {
    const supabase = await createClient()
    const { data: bundleData, error: bundleError } = await supabase
        .from("discount_bundles")
        .select("*, product:product_id(id, merchant_id, name, price, stock_level, image_url)")
        .eq("slug", slug)
        .eq("status", "active")
        .maybeSingle()

    if (bundleError) {
        throw new Error(bundleError.message)
    }

    if (!bundleData) {
        return null
    }

    const bundle = bundleData as DiscountBundleWithProductRow
    const [bundleItems, relatedBundlesResponse] = await Promise.all([
        loadBundleItems([bundle.id]),
        supabase
            .from("discount_bundles")
            .select("*, product:product_id(id, merchant_id, name, price, stock_level, image_url)")
            .eq("status", "active")
            .neq("id", bundle.id)
            .order("is_featured", { ascending: false })
            .order("sort_order", { ascending: true })
            .limit(4),
    ])

    if (relatedBundlesResponse.error) {
        throw new Error(relatedBundlesResponse.error.message)
    }

    const relatedBundles = (relatedBundlesResponse.data ?? []) as DiscountBundleWithProductRow[]
    const relatedItems = await loadBundleItems(relatedBundles.map((item) => item.id))

    return {
        bundle: mapBundle(bundle, bundleItems),
        relatedBundles: relatedBundles.map((item) => mapBundle(item, relatedItems)),
    }
}
