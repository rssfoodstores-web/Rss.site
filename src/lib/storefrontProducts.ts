import { cache } from "react"
import type { ProductReview } from "@/lib/productReviews"
import { summarizeProductReviews } from "@/lib/productReviews"
import {
    buildCanonicalProductPath,
    extractUuidFromSlugParam,
} from "@/lib/seo"
import { createPublicServerClient } from "@/lib/supabase/public-server"

export interface StorefrontProductDetails {
    category: string
    cooked_images?: string[] | null
    description: string
    discount_price?: string | number | null
    expiry_date?: string | null
    has_options?: boolean | null
    health_benefits?: string[] | null
    id: string
    image_url: string | null
    images?: string[] | null
    manufacture_date?: string | null
    merchant_id: string
    name: string
    nutrition_content?: string[] | null
    options?: { type: string; values: string[] }[] | null
    price: number
    return_refund_policy?: string | null
    sales_type?: string | null
    seo_description?: string | null
    seo_title?: string | null
    state?: string | null
    stock_level: number
    suggested_combos?: string[] | null
    tags?: string[] | null
    weight?: string | null
}

export interface RelatedProductRow {
    category: string
    discount_price?: number | null
    id: string
    image_url: string | null
    merchant_id: string
    name: string
    price: number
    stock_level: number | null
}

interface ProductReviewQueryRow {
    comment: string | null
    created_at: string | null
    customer?:
        | {
            full_name: string | null
        }
        | Array<{
            full_name: string | null
        }>
        | null
    product_id: string
    rating: number
}

function buildUniqueImageList(images: Array<string | null | undefined>) {
    return Array.from(new Set(images.filter((image): image is string => Boolean(image?.trim()))))
}

function normalizeStringArray(value: unknown) {
    if (!Array.isArray(value)) {
        return null
    }

    const items = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    return items.length > 0 ? items : null
}

function normalizeProductDetails(value: unknown): StorefrontProductDetails {
    const product = value as Record<string, unknown>

    return {
        category: String(product.category ?? ""),
        cooked_images: normalizeStringArray(product.cooked_images),
        description: typeof product.description === "string" ? product.description : "",
        discount_price: typeof product.discount_price === "string" || typeof product.discount_price === "number"
            ? product.discount_price
            : null,
        expiry_date: typeof product.expiry_date === "string" ? product.expiry_date : null,
        has_options: typeof product.has_options === "boolean" ? product.has_options : null,
        health_benefits: normalizeStringArray(product.health_benefits),
        id: String(product.id ?? ""),
        image_url: typeof product.image_url === "string" ? product.image_url : null,
        images: normalizeStringArray(product.images),
        manufacture_date: typeof product.manufacture_date === "string" ? product.manufacture_date : null,
        merchant_id: String(product.merchant_id ?? ""),
        name: String(product.name ?? "Untitled product"),
        nutrition_content: normalizeStringArray(product.nutrition_content),
        options: Array.isArray(product.options)
            ? product.options as StorefrontProductDetails["options"]
            : null,
        price: typeof product.price === "number" ? product.price : Number(product.price ?? 0),
        return_refund_policy: typeof product.return_refund_policy === "string" ? product.return_refund_policy : null,
        sales_type: typeof product.sales_type === "string" ? product.sales_type : null,
        seo_description: typeof product.seo_description === "string" ? product.seo_description : null,
        seo_title: typeof product.seo_title === "string" ? product.seo_title : null,
        state: typeof product.state === "string" ? product.state : null,
        stock_level: typeof product.stock_level === "number" ? product.stock_level : Number(product.stock_level ?? 0),
        suggested_combos: normalizeStringArray(product.suggested_combos),
        tags: normalizeStringArray(product.tags),
        weight: typeof product.weight === "string" ? product.weight : null,
    }
}

function normalizeReviews(rows: ProductReviewQueryRow[]) {
    return rows.map((review) => ({
        comment: review.comment?.trim() ?? "",
        createdAt: review.created_at,
        customerName: (
            Array.isArray(review.customer)
                ? review.customer[0]?.full_name
                : review.customer?.full_name
        )?.trim() || "Verified buyer",
        productId: review.product_id,
        rating: review.rating,
    })) satisfies ProductReview[]
}

function mapRelatedProducts(rows: RelatedProductRow[]) {
    return rows.map((relatedProduct) => ({
        category: relatedProduct.category,
        id: relatedProduct.id,
        imageUrl: relatedProduct.image_url ?? "",
        isSale:
            Number(relatedProduct.discount_price ?? 0) > 0
            && Number(relatedProduct.discount_price ?? 0) < Number(relatedProduct.price ?? 0),
        merchantId: relatedProduct.merchant_id,
        name: relatedProduct.name,
        price:
            Number(relatedProduct.discount_price ?? 0) > 0
            && Number(relatedProduct.discount_price ?? 0) < Number(relatedProduct.price ?? 0)
                ? Number(relatedProduct.discount_price ?? 0)
                : Number(relatedProduct.price ?? 0),
        stock: relatedProduct.stock_level ?? 0,
    }))
}

export const getStorefrontProductPageData = cache(async (productParam: string) => {
    const productId = extractUuidFromSlugParam(productParam)

    if (!productId) {
        return null
    }

    const supabase = createPublicServerClient()
    const [{ data: productData, error: productError }, { data: reviewData, error: reviewError }] = await Promise.all([
        supabase
            .from("products")
            .select("*")
            .eq("id", productId)
            .eq("status", "approved")
            .not("active_pricing_id", "is", null)
            .maybeSingle(),
        supabase
            .from("product_reviews")
            .select("product_id, rating, comment, created_at, customer:customer_id(full_name)")
            .eq("product_id", productId)
            .order("created_at", { ascending: false }),
    ])

    if (productError || !productData) {
        return null
    }

    if (reviewError) {
        console.error("Error fetching product reviews for SEO page:", reviewError)
    }

    const product = normalizeProductDetails(productData)
    const reviews = normalizeReviews((reviewData ?? []) as unknown as ProductReviewQueryRow[])
    const reviewSummary = summarizeProductReviews(reviews)
    const galleryImages = buildUniqueImageList([product.image_url, ...(product.images ?? [])])
    const cookedImages = buildUniqueImageList(product.cooked_images ?? [])
    const relatedSelect = "id, name, price, discount_price, category, image_url, stock_level, merchant_id"

    const [{ data: sameCategoryProducts, error: sameCategoryError }, { data: fallbackProducts, error: fallbackError }, { data: merchantData, error: merchantError }] = await Promise.all([
        supabase
            .from("products")
            .select(relatedSelect)
            .eq("status", "approved")
            .not("active_pricing_id", "is", null)
            .filter("category", "eq", product.category)
            .neq("id", product.id)
            .limit(4),
        supabase
            .from("products")
            .select(relatedSelect)
            .eq("status", "approved")
            .not("active_pricing_id", "is", null)
            .neq("id", product.id)
            .limit(8),
        supabase
            .from("merchants")
            .select("store_name")
            .eq("id", product.merchant_id)
            .maybeSingle(),
    ])

    if (sameCategoryError) {
        console.error("Error fetching related category products:", sameCategoryError)
    }

    if (fallbackError) {
        console.error("Error fetching related fallback products:", fallbackError)
    }

    if (merchantError) {
        console.error("Error fetching merchant store name:", merchantError)
    }

    const relatedProductMap = new Map<string, RelatedProductRow>()

    ;([...(sameCategoryProducts ?? []), ...(fallbackProducts ?? [])] as unknown as RelatedProductRow[]).forEach((relatedProduct) => {
        if (!relatedProductMap.has(relatedProduct.id)) {
            relatedProductMap.set(relatedProduct.id, relatedProduct)
        }
    })

    return {
        canonicalPath: buildCanonicalProductPath(product.name, product.id),
        cookedImages,
        galleryImages,
        product,
        relatedProducts: mapRelatedProducts(Array.from(relatedProductMap.values()).slice(0, 4)),
        reviewSummary,
        reviews,
        sellerName: merchantData?.store_name?.trim() || "RSS Foods",
    }
})

export async function listApprovedProductsForSitemap() {
    const supabase = createPublicServerClient()
    const { data, error } = await supabase
        .from("products")
        .select("id, name, created_at, submitted_for_review_at")
        .eq("status", "approved")
        .not("active_pricing_id", "is", null)
        .order("created_at", { ascending: false })

    if (error) {
        console.error("Error loading products for sitemap:", error)
        return []
    }

    return (data ?? []).map((product) => ({
        canonicalPath: buildCanonicalProductPath(product.name, product.id),
        lastModified: product.submitted_for_review_at ?? product.created_at ?? new Date().toISOString(),
    }))
}
