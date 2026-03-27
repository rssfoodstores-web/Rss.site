"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import {
    ArrowLeft,
    CalendarDays,
    Heart,
    Info,
    Leaf,
    MapPin,
    Minus,
    MessageSquareQuote,
    Package2,
    Plus,
    ShieldCheck,
    ShoppingCart,
    UtensilsCrossed,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ReviewStars } from "@/components/ui/ReviewStars"
import { ProductCard, type Product as ProductCardProduct } from "@/components/home/ProductCard"
import { useCart } from "@/context/CartContext"
import { useWishlist } from "@/context/WishlistContext"
import { createPublicStorefrontClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { formatKobo } from "@/lib/money"
import {
    formatProductReviewDate,
    summarizeProductReviews,
    type ProductReview,
    type ProductReviewRow,
} from "@/lib/productReviews"
import { LottieLoader } from "@/components/ui/lottie-loader"

interface ProductDetails {
    id: string
    name: string
    description: string
    price: number
    image_url: string | null
    images?: string[] | null
    cooked_images?: string[] | null
    category: string
    stock_level: number
    merchant_id: string
    weight?: string | null
    state?: string | null
    sales_type?: string | null
    tags?: string[] | null
    discount_price?: string | number | null
    has_options?: boolean | null
    options?: { type: string; values: string[] }[] | null
    nutrition_content?: string[] | null
    health_benefits?: string[] | null
    manufacture_date?: string | null
    expiry_date?: string | null
    suggested_combos?: string[] | null
    return_refund_policy?: string | null
}

interface ProductReviewQueryRow extends ProductReviewRow {
    customer?: {
        full_name: string | null
    } | null
}

interface RelatedProductRow {
    id: string
    name: string
    price: number
    discount_price?: number | null
    category: string
    image_url: string | null
    stock_level: number | null
    merchant_id: string
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

function normalizeProductDetails(value: unknown): ProductDetails {
    const product = value as Record<string, unknown>

    return {
        id: String(product.id ?? ""),
        name: String(product.name ?? "Untitled product"),
        description: typeof product.description === "string" ? product.description : "",
        price: typeof product.price === "number" ? product.price : Number(product.price ?? 0),
        image_url: typeof product.image_url === "string" ? product.image_url : null,
        images: normalizeStringArray(product.images),
        cooked_images: normalizeStringArray(product.cooked_images),
        category: String(product.category ?? ""),
        stock_level: typeof product.stock_level === "number" ? product.stock_level : Number(product.stock_level ?? 0),
        merchant_id: String(product.merchant_id ?? ""),
        weight: typeof product.weight === "string" ? product.weight : null,
        state: typeof product.state === "string" ? product.state : null,
        sales_type: typeof product.sales_type === "string" ? product.sales_type : null,
        tags: normalizeStringArray(product.tags),
        discount_price: typeof product.discount_price === "string" || typeof product.discount_price === "number"
            ? product.discount_price
            : null,
        has_options: typeof product.has_options === "boolean" ? product.has_options : null,
        options: Array.isArray(product.options)
            ? product.options as ProductDetails["options"]
            : null,
        nutrition_content: normalizeStringArray(product.nutrition_content),
        health_benefits: normalizeStringArray(product.health_benefits),
        manufacture_date: typeof product.manufacture_date === "string" ? product.manufacture_date : null,
        expiry_date: typeof product.expiry_date === "string" ? product.expiry_date : null,
        suggested_combos: normalizeStringArray(product.suggested_combos),
        return_refund_policy: typeof product.return_refund_policy === "string" ? product.return_refund_policy : null,
    }
}

function isAbortLikeError(error: unknown) {
    if (!error) return false

    if (error instanceof DOMException && error.name === "AbortError") {
        return true
    }

    if (error instanceof Error) {
        return error.name === "AbortError" || error.message.toLowerCase().includes("aborted")
    }

    if (typeof error === "object") {
        const maybeError = error as { name?: string; message?: string }
        return maybeError.name === "AbortError" || maybeError.message?.toLowerCase().includes("aborted") === true
    }

    return false
}

function getErrorMessage(error: unknown) {
    if (!error) return "Unknown product fetch error"
    if (typeof error === "string") return error
    if (error instanceof Error) return error.message
    if (typeof error === "object") {
        const maybeError = error as { message?: string; error_description?: string; details?: string; hint?: string }
        return maybeError.message ?? maybeError.error_description ?? maybeError.details ?? maybeError.hint ?? JSON.stringify(error)
    }

    return String(error)
}

function formatProductDate(value?: string | null) {
    if (!value) {
        return "Not provided"
    }

    const parsedDate = new Date(value)

    if (Number.isNaN(parsedDate.getTime())) {
        return "Not provided"
    }

    return new Intl.DateTimeFormat("en-NG", {
        day: "numeric",
        month: "long",
        year: "numeric",
    }).format(parsedDate)
}

function toEffectivePriceKobo(price: number, discountPrice?: number | string | null) {
    const basePriceKobo = Number(price ?? 0)
    const discountPriceKobo = Number(discountPrice ?? 0)

    if (Number.isFinite(discountPriceKobo) && discountPriceKobo > 0 && discountPriceKobo < basePriceKobo) {
        return discountPriceKobo
    }

    return basePriceKobo
}

function toProductCardProduct(product: RelatedProductRow): ProductCardProduct {
    const effectivePriceKobo = toEffectivePriceKobo(product.price, product.discount_price)

    return {
        id: product.id,
        name: product.name,
        price: effectivePriceKobo,
        category: product.category,
        imageUrl: product.image_url ?? "",
        stock: product.stock_level ?? 0,
        merchantId: product.merchant_id,
        isSale: effectivePriceKobo !== Number(product.price ?? 0),
    }
}

export default function ProductDetailsPage() {
    const params = useParams()
    const router = useRouter()
    const { id } = params as { id: string }

    const [product, setProduct] = useState<ProductDetails | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [selectedOption, setSelectedOption] = useState<string | null>(null)
    const [selectedImage, setSelectedImage] = useState<string | null>(null)
    const [reviews, setReviews] = useState<ProductReview[]>([])
    const [activeTab, setActiveTab] = useState<"description" | "reviews">("description")
    const [quantity, setQuantity] = useState(1)
    const [relatedProducts, setRelatedProducts] = useState<ProductCardProduct[]>([])

    const { addToCart } = useCart()
    const { toggleWishlist, isInWishlist } = useWishlist()

    useEffect(() => {
        let mounted = true
        const controller = new AbortController()
        const signal = controller.signal
        const supabase = createPublicStorefrontClient()

        const fetchProductData = async () => {
            if (!id) return

            setLoading(true)
            setError(null)
            setRelatedProducts([])

            try {
                const [{ data: productData, error: productError }, { data: reviewData, error: reviewError }] = await Promise.all([
                    supabase
                        .from("products")
                        .select("*")
                        .eq("id", id)
                        .eq("status", "approved")
                        .not("active_pricing_id", "is", null)
                        .abortSignal(signal)
                        .maybeSingle(),
                    supabase
                        .from("product_reviews")
                        .select("product_id, rating, comment, created_at, customer:customer_id(full_name)")
                        .eq("product_id", id)
                        .order("created_at", { ascending: false })
                        .abortSignal(signal),
                ])

                if (productError) throw productError
                if (!productData) {
                    if (mounted) setError("Product not found")
                    return
                }

                if (reviewError) {
                    console.error("Error fetching product reviews:", reviewError)
                }

                const normalizedProduct = normalizeProductDetails(productData)
                const gallery = buildUniqueImageList([normalizedProduct.image_url, ...(normalizedProduct.images ?? [])])
                const relatedSelect = "id, name, price, discount_price, category, image_url, stock_level, merchant_id"
                const [{ data: sameCategoryProducts, error: sameCategoryError }, { data: fallbackProducts, error: fallbackError }] = await Promise.all([
                    supabase
                        .from("products")
                        .select(relatedSelect)
                        .eq("status", "approved")
                        .not("active_pricing_id", "is", null)
                        .filter("category", "eq", normalizedProduct.category)
                        .neq("id", normalizedProduct.id)
                        .limit(4)
                        .abortSignal(signal),
                    supabase
                        .from("products")
                        .select(relatedSelect)
                        .eq("status", "approved")
                        .not("active_pricing_id", "is", null)
                        .neq("id", normalizedProduct.id)
                        .limit(8)
                        .abortSignal(signal),
                ])

                if (sameCategoryError) {
                    console.error("Error fetching similar products:", sameCategoryError)
                }

                if (fallbackError) {
                    console.error("Error fetching fallback products:", fallbackError)
                }

                if (!mounted) return

                const relatedProductMap = new Map<string, RelatedProductRow>()

                ;([...(sameCategoryProducts ?? []), ...(fallbackProducts ?? [])] as unknown as RelatedProductRow[]).forEach((relatedProduct) => {
                    if (!relatedProductMap.has(relatedProduct.id)) {
                        relatedProductMap.set(relatedProduct.id, relatedProduct)
                    }
                })

                setProduct(normalizedProduct)
                setSelectedImage(gallery[0] ?? null)
                setSelectedOption(
                    normalizedProduct.has_options && normalizedProduct.options && normalizedProduct.options[0]?.values?.length
                        ? normalizedProduct.options[0].values[0]
                        : null
                )
                setQuantity(1)
                setActiveTab("description")
                setRelatedProducts(Array.from(relatedProductMap.values()).slice(0, 4).map(toProductCardProduct))
                setReviews(
                    ((reviewData ?? []) as ProductReviewQueryRow[]).map((review) => ({
                        productId: review.product_id,
                        rating: review.rating,
                        comment: review.comment?.trim() ?? "",
                        createdAt: review.created_at,
                        customerName: review.customer?.full_name?.trim() || "Verified buyer",
                    }))
                )
            } catch (err: unknown) {
                if (isAbortLikeError(err)) {
                    return
                }

                console.error("Error fetching product:", {
                    message: getErrorMessage(err),
                    error: err,
                })
                if (mounted) setError("Failed to load product")
            } finally {
                if (mounted) setLoading(false)
            }
        }

        fetchProductData()

        return () => {
            mounted = false
            controller.abort()
        }
    }, [id])

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-white font-sans dark:bg-black">
                <LottieLoader text="Loading details..." className="scale-125" />
            </div>
        )
    }

    if (error || !product) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-white p-4 font-sans dark:bg-black">
                <div className="max-w-md rounded-3xl bg-red-50 p-6 text-center dark:bg-red-900/10">
                    <Info className="mx-auto mb-4 h-12 w-12 text-red-500" />
                    <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">Product Not Found</h1>
                    <p className="mb-6 text-gray-500">
                        We couldn&apos;t find the product you&apos;re looking for. It might have been removed or the link is invalid.
                    </p>
                    <Link href="/">
                        <Button className="rounded-full bg-[#F58220] px-8 font-bold text-white hover:bg-[#F58220]/90">
                            Back to Store
                        </Button>
                    </Link>
                </div>
            </div>
        )
    }

    const galleryImages = buildUniqueImageList([product.image_url, ...(product.images ?? [])])
    const cookedImages = buildUniqueImageList(product.cooked_images ?? [])
    const primaryImage = selectedImage ?? galleryImages[0] ?? null
    const nutritionItems = product.nutrition_content?.filter(Boolean) ?? []
    const healthBenefits = product.health_benefits?.filter(Boolean) ?? []
    const suggestedCombos = product.suggested_combos?.filter(Boolean) ?? []
    const originalPriceKobo = Number(product.price ?? 0)
    const effectivePriceKobo = toEffectivePriceKobo(product.price, product.discount_price)
    const hasDiscount = effectivePriceKobo !== originalPriceKobo
    const savingsKobo = hasDiscount ? originalPriceKobo - effectivePriceKobo : 0
    const discountPercent = hasDiscount ? Math.round(((originalPriceKobo - effectivePriceKobo) / originalPriceKobo) * 100) : 0
    const reviewSummary = summarizeProductReviews(reviews)
    const shortDescription = product.description.length > 220
        ? `${product.description.slice(0, 220).trimEnd()}...`
        : product.description
    const productSize = product.weight?.trim()
        || product.options?.map((option) => `${option.type}: ${option.values.join(", ")}`).join(" | ")
        || "Not provided"
    const productFacts = [
        { icon: MapPin, label: "Available From", value: product.state?.trim() || "Not provided" },
        { icon: Info, label: "Product Size", value: productSize },
        { icon: CalendarDays, label: "Manufacture Date", value: formatProductDate(product.manufacture_date) },
        { icon: CalendarDays, label: "Expiry Date", value: formatProductDate(product.expiry_date) },
    ]
    const compactProductFacts = productFacts.slice(0, 2)
    const preparedImage = cookedImages[0] ?? null
    const primaryCartImage = primaryImage ?? product.image_url ?? ""
    const isWishlisted = isInWishlist(product.id)
    const maxQuantity = Math.max(1, product.stock_level || 1)

    const handleAddToCart = () => {
        addToCart({
            id: product.id,
            name: product.name,
            price: effectivePriceKobo,
            image: primaryCartImage,
            category: product.category,
            stock_level: product.stock_level,
            merchantId: product.merchant_id,
            quantity,
        })
    }

    return (
        <div className="min-h-screen bg-[#FCFAF7] pb-32 font-sans text-[#1A1A1A] dark:bg-black dark:text-white">
            <div className="sticky top-0 z-40 border-b border-gray-100 bg-white/80 backdrop-blur-md dark:border-zinc-900 dark:bg-black/80">
                <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-4 px-4 sm:px-6 lg:px-8">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <span className="flex-1 truncate text-lg font-bold">{product.name}</span>
                    <Button variant="ghost" size="icon" onClick={() => router.push("/cart")} className="rounded-full">
                        <ShoppingCart className="h-5 w-5" />
                    </Button>
                </div>
            </div>

            <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8">
                <section className="rounded-[2rem] border border-gray-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/70 sm:p-6 lg:p-8">
                    <div className="grid gap-8 xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
                        <div
                            className={cn(
                                "grid gap-4",
                                galleryImages.length > 1
                                    ? "md:grid-cols-[84px_minmax(0,1fr)] md:items-start"
                                    : "md:grid-cols-1"
                            )}
                        >
                            {galleryImages.length > 1 ? (
                                <div className="order-2 flex gap-3 overflow-x-auto pb-1 md:order-1 md:flex-col md:overflow-visible">
                                    {galleryImages.map((image) => (
                                        <button
                                            key={image}
                                            type="button"
                                            onClick={() => setSelectedImage(image)}
                                            className={cn(
                                                "relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border bg-gray-50 transition-all",
                                                primaryImage === image ? "border-[#F58220] ring-2 ring-orange-100" : "border-gray-100 hover:border-orange-200"
                                            )}
                                        >
                                            <Image src={image} alt={product.name} fill sizes="80px" className="object-cover" />
                                        </button>
                                    ))}
                                </div>
                            ) : null}

                            <div
                                className={cn(
                                    "order-1 min-w-0",
                                    galleryImages.length > 1 ? "md:order-2" : "md:col-span-1"
                                )}
                            >
                                <div className="relative aspect-square overflow-hidden rounded-[2rem] border border-gray-100 bg-gray-50 shadow-lg shadow-gray-200/40 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/30">
                                    {primaryImage ? (
                                        <Image
                                            src={primaryImage}
                                            alt={product.name}
                                            fill
                                            className="object-cover transition-transform duration-500 hover:scale-105"
                                            priority
                                        />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center text-gray-300">
                                            <Info className="h-20 w-20" />
                                        </div>
                                    )}

                                    {hasDiscount ? (
                                        <div className="absolute left-4 top-4 z-10">
                                            <Badge className="border-0 bg-red-500 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-white hover:bg-red-600">
                                                -{discountPercent}% Off
                                            </Badge>
                                        </div>
                                    ) : null}

                                    <div className="absolute right-4 top-4 z-10">
                                        <Button
                                            size="icon"
                                            variant="secondary"
                                            className={cn(
                                                "h-11 w-11 rounded-full border border-white/30 bg-white/85 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-black/50",
                                                isWishlisted && "bg-red-50 text-red-500 dark:bg-red-950/40"
                                            )}
                                            onClick={() => toggleWishlist({
                                                id: product.id,
                                                name: product.name,
                                                price: effectivePriceKobo,
                                                image: primaryCartImage,
                                                category: product.category,
                                                stock_level: product.stock_level,
                                            })}
                                        >
                                            <Heart className={cn("h-5 w-5", isWishlisted && "fill-current")} />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6 rounded-[2rem] border border-gray-100 bg-[#FFFDFC] p-5 dark:border-zinc-800 dark:bg-zinc-950 sm:p-6">
                            <div className="flex flex-wrap items-center gap-3">
                                <Badge variant="outline" className="rounded-full border-orange-200 bg-orange-50 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-[#F58220] dark:border-orange-900/40 dark:bg-orange-950/30">
                                    {product.category}
                                </Badge>
                                {product.sales_type ? (
                                    <Badge variant="secondary" className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] dark:bg-zinc-800">
                                        {product.sales_type}
                                    </Badge>
                                ) : null}
                                {product.stock_level > 0 ? (
                                    <Badge className="rounded-full border-0 bg-green-100 px-3 py-1 text-xs font-semibold text-green-700 hover:bg-green-200">
                                        In Stock
                                    </Badge>
                                ) : (
                                    <Badge variant="destructive" className="rounded-full px-3 py-1 text-xs font-semibold">
                                        Out of Stock
                                    </Badge>
                                )}
                            </div>

                            <div className="space-y-4">
                                <div className="flex flex-wrap items-start justify-between gap-4">
                                    <div className="space-y-2">
                                        <h1 className="text-3xl font-black leading-tight text-gray-900 dark:text-white sm:text-4xl lg:text-[2.6rem]">
                                            {product.name}
                                        </h1>
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab("reviews")}
                                            className="flex items-center gap-2 text-left"
                                        >
                                            <ReviewStars rating={reviewSummary.averageRating} size="sm" />
                                            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                                                {reviewSummary.reviewCount > 0 ? `${reviewSummary.averageRating.toFixed(1)} rating` : "No ratings yet"}
                                            </span>
                                            <span className="text-sm text-gray-500 dark:text-gray-400">
                                                ({reviewSummary.reviewCount} review{reviewSummary.reviewCount === 1 ? "" : "s"})
                                            </span>
                                        </button>
                                    </div>
                                    {hasDiscount ? (
                                        <div className="rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3 text-right dark:border-orange-900/40 dark:bg-orange-950/20">
                                            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#B86112]">You Save</p>
                                            <p className="mt-1 text-lg font-black text-[#F58220]">{formatKobo(savingsKobo)}</p>
                                        </div>
                                    ) : null}
                                </div>

                                <div className="flex flex-wrap items-end gap-3">
                                    <span className="text-3xl font-black tracking-tight text-[#F58220] sm:text-4xl">
                                        {formatKobo(effectivePriceKobo)}
                                    </span>
                                    {hasDiscount ? (
                                        <span className="pb-1 text-lg font-medium text-gray-400 line-through">
                                            {formatKobo(originalPriceKobo)}
                                        </span>
                                    ) : null}
                                </div>

                                <p className="max-w-2xl text-sm leading-7 text-gray-600 dark:text-gray-300 sm:text-base">
                                    {shortDescription || "No description available for this product."}
                                </p>
                            </div>

                            {product.has_options && product.options && product.options.length > 0 ? (
                                <div className="space-y-3">
                                    <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-gray-400">
                                        Select {product.options[0].type}
                                    </h3>
                                    <div className="flex flex-wrap gap-3">
                                        {product.options[0].values.map((value) => (
                                            <button
                                                key={value}
                                                type="button"
                                                onClick={() => setSelectedOption(value)}
                                                className={cn(
                                                    "rounded-full border px-4 py-2 text-sm font-semibold transition-all",
                                                    selectedOption === value
                                                        ? "border-[#F58220] bg-orange-50 text-[#F58220] dark:bg-orange-950/20"
                                                        : "border-gray-200 text-gray-600 hover:border-orange-200 hover:text-[#F58220] dark:border-zinc-700 dark:text-gray-300"
                                                )}
                                            >
                                                {value}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : null}

                            <div className="flex flex-col gap-3 rounded-[1.5rem] border border-gray-100 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-center">
                                <div className="flex items-center rounded-full border border-gray-200 bg-gray-50 p-1 dark:border-zinc-700 dark:bg-zinc-900">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-10 w-10 rounded-full"
                                        onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                                        disabled={quantity <= 1}
                                    >
                                        <Minus className="h-4 w-4" />
                                    </Button>
                                    <span className="min-w-[3rem] text-center text-base font-bold text-gray-900 dark:text-white">
                                        {quantity}
                                    </span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-10 w-10 rounded-full"
                                        onClick={() => setQuantity((current) => Math.min(maxQuantity, current + 1))}
                                        disabled={product.stock_level < 1 || quantity >= maxQuantity}
                                    >
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>

                                <Button
                                    size="lg"
                                    className="h-12 flex-1 rounded-full bg-[#F58220] px-8 text-base font-bold text-white shadow-lg shadow-orange-500/20 hover:bg-[#F58220]/90"
                                    onClick={handleAddToCart}
                                    disabled={product.stock_level < 1}
                                >
                                    <ShoppingCart className="mr-2 h-5 w-5" />
                                    {product.stock_level > 0 ? "Add to Cart" : "Out of Stock"}
                                </Button>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                                {compactProductFacts.map((fact) => (
                                    <div key={fact.label} className="rounded-2xl border border-gray-100 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900/60">
                                        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">
                                            <fact.icon className="h-4 w-4 text-[#F58220]" />
                                            <span>{fact.label}</span>
                                        </div>
                                        <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">{fact.value}</p>
                                    </div>
                                ))}
                            </div>

                            {product.tags && product.tags.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {product.tags.map((tag) => (
                                        <span key={tag} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 dark:bg-zinc-800 dark:text-gray-300">
                                            #{tag}
                                        </span>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                    </div>
                </section>
                <section className="mt-8 rounded-[2rem] border border-gray-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/70 sm:p-6 lg:p-8">
                    <div className="flex flex-wrap gap-2 border-b border-gray-100 pb-4 dark:border-zinc-800">
                        {[
                            { key: "description", label: "Descriptions" },
                            { key: "reviews", label: "Customer Feedbacks" },
                        ].map((tab) => (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => setActiveTab(tab.key as "description" | "reviews")}
                                className={cn(
                                    "rounded-full px-4 py-2 text-sm font-semibold transition-all",
                                    activeTab === tab.key
                                        ? "bg-[#F58220] text-white shadow-lg shadow-orange-500/20"
                                        : "bg-gray-100 text-gray-600 hover:bg-orange-50 hover:text-[#F58220] dark:bg-zinc-800 dark:text-gray-300"
                                )}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {activeTab === "description" ? (
                        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                            <div className="space-y-6">
                                <section className="rounded-[1.75rem] border border-gray-100 bg-[#FFFDFC] p-5 dark:border-zinc-800 dark:bg-zinc-900/60 sm:p-6">
                                    <h3 className="text-xl font-black text-gray-900 dark:text-white">Product Description</h3>
                                    <div className="mt-4 space-y-4 text-sm leading-7 text-gray-600 dark:text-gray-300 sm:text-base">
                                        <p>{product.description || "No description available for this product."}</p>
                                    </div>
                                </section>

                                <div className="grid gap-6 xl:grid-cols-2">
                                    <section className="rounded-[1.75rem] border border-gray-100 bg-[#FFFDFC] p-5 dark:border-zinc-800 dark:bg-zinc-900/60 sm:p-6">
                                        <div className="flex items-center gap-3">
                                            <div className="rounded-2xl bg-orange-50 p-3 text-[#F58220] dark:bg-orange-950/20">
                                                <Leaf className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Nutritional Content</h3>
                                                <p className="text-sm text-gray-500 dark:text-gray-400">Core nutrition details at a glance.</p>
                                            </div>
                                        </div>
                                        {nutritionItems.length > 0 ? (
                                            <ul className="mt-5 space-y-3 text-sm text-gray-600 dark:text-gray-300">
                                                {nutritionItems.map((item) => (
                                                    <li key={item} className="rounded-2xl bg-white px-4 py-3 dark:bg-zinc-900">
                                                        {item}
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p className="mt-5 text-sm text-gray-500 dark:text-gray-400">
                                                Nutritional details will appear here when the merchant adds them.
                                            </p>
                                        )}
                                    </section>

                                    <section className="rounded-[1.75rem] border border-gray-100 bg-[#FFFDFC] p-5 dark:border-zinc-800 dark:bg-zinc-900/60 sm:p-6">
                                        <div className="flex items-center gap-3">
                                            <div className="rounded-2xl bg-orange-50 p-3 text-[#F58220] dark:bg-orange-950/20">
                                                <Heart className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Health Benefits</h3>
                                                <p className="text-sm text-gray-500 dark:text-gray-400">Why customers may keep coming back to it.</p>
                                            </div>
                                        </div>
                                        {healthBenefits.length > 0 ? (
                                            <ul className="mt-5 space-y-3 text-sm text-gray-600 dark:text-gray-300">
                                                {healthBenefits.map((item) => (
                                                    <li key={item} className="rounded-2xl bg-white px-4 py-3 dark:bg-zinc-900">
                                                        {item}
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p className="mt-5 text-sm text-gray-500 dark:text-gray-400">
                                                Health benefits will appear here when the merchant adds them.
                                            </p>
                                        )}
                                    </section>
                                </div>

                                <section className="rounded-[1.75rem] border border-gray-100 bg-[#FFFDFC] p-5 dark:border-zinc-800 dark:bg-zinc-900/60 sm:p-6">
                                    <div className="flex items-center gap-3">
                                        <div className="rounded-2xl bg-orange-50 p-3 text-[#F58220] dark:bg-orange-950/20">
                                            <UtensilsCrossed className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Suggested Combos</h3>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">Pairing ideas that help convert a bigger basket.</p>
                                        </div>
                                    </div>
                                    {suggestedCombos.length > 0 ? (
                                        <div className="mt-5 flex flex-wrap gap-3">
                                            {suggestedCombos.map((combo) => (
                                                <span key={combo} className="rounded-full border border-orange-100 bg-orange-50 px-4 py-2 text-sm font-medium text-[#B86112] dark:border-orange-900/40 dark:bg-orange-950/20 dark:text-orange-200">
                                                    {combo}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="mt-5 text-sm text-gray-500 dark:text-gray-400">
                                            Suggested pairings will appear here when the merchant adds them.
                                        </p>
                                    )}
                                </section>
                            </div>

                            <div className="space-y-6">
                                <section className="overflow-hidden rounded-[1.75rem] border border-gray-100 bg-[#FFFDFC] dark:border-zinc-800 dark:bg-zinc-900/60">
                                    <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-zinc-800 sm:px-6">
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Finished View</h3>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">Show buyers how the product looks prepared or served.</p>
                                        </div>
                                        <Package2 className="h-5 w-5 text-[#F58220]" />
                                    </div>
                                    <div className="p-5 sm:p-6">
                                        <div className="relative aspect-[4/3] overflow-hidden rounded-[1.5rem] border border-gray-100 bg-gray-50 dark:border-zinc-800 dark:bg-zinc-900">
                                            {preparedImage ? (
                                                <Image src={preparedImage} alt={`${product.name} prepared view`} fill className="object-cover" />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center px-6 text-center text-sm text-gray-400">
                                                    Finished or cooked images will appear here when the merchant uploads them.
                                                </div>
                                            )}
                                        </div>
                                        {cookedImages.length > 1 ? (
                                            <div className="mt-4 grid grid-cols-3 gap-3">
                                                {cookedImages.slice(0, 3).map((image) => (
                                                    <div key={image} className="relative aspect-square overflow-hidden rounded-2xl border border-gray-100 bg-gray-50 dark:border-zinc-800 dark:bg-zinc-900">
                                                        <Image src={image} alt={`${product.name} serving option`} fill className="object-cover" />
                                                    </div>
                                                ))}
                                            </div>
                                        ) : null}
                                    </div>
                                </section>

                                <section className="rounded-[1.75rem] border border-gray-100 bg-[#FFFDFC] p-5 dark:border-zinc-800 dark:bg-zinc-900/60 sm:p-6">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Product Details</h3>
                                    <div className="mt-5 space-y-4">
                                        {productFacts.map((fact) => (
                                            <div key={fact.label} className="flex items-start justify-between gap-4 rounded-2xl bg-white px-4 py-3 dark:bg-zinc-900">
                                                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-gray-400">
                                                    <fact.icon className="h-4 w-4 text-[#F58220]" />
                                                    <span>{fact.label}</span>
                                                </div>
                                                <p className="max-w-[55%] text-right text-sm font-semibold text-gray-900 dark:text-white">{fact.value}</p>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                <section className="rounded-[1.75rem] border border-gray-100 bg-[#FFFDFC] p-5 dark:border-zinc-800 dark:bg-zinc-900/60 sm:p-6">
                                    <div className="flex items-center gap-3">
                                        <div className="rounded-2xl bg-orange-50 p-3 text-[#F58220] dark:bg-orange-950/20">
                                            <ShieldCheck className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Return & Refund Policy</h3>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">Set expectations clearly before checkout.</p>
                                        </div>
                                    </div>
                                    <div className="mt-5 rounded-2xl bg-white px-5 py-4 text-sm leading-7 text-gray-600 dark:bg-zinc-900 dark:text-gray-300">
                                        {product.return_refund_policy?.trim()
                                            ? product.return_refund_policy
                                            : "The merchant has not added a return or refund note for this product yet."}
                                    </div>
                                </section>
                            </div>
                        </div>
                    ) : (
                        <div className="mt-6 rounded-[1.75rem] border border-gray-100 bg-[#FFFDFC] p-5 dark:border-zinc-800 dark:bg-zinc-900/60 sm:p-6">
                            <div className="flex flex-col gap-4 border-b border-gray-100 pb-5 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <h3 className="text-xl font-black text-gray-900 dark:text-white">Customer Feedback</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Verified buyer comments and star ratings.</p>
                                </div>
                                <div className="rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3 dark:border-orange-900/40 dark:bg-orange-950/20">
                                    <div className="flex items-center gap-3">
                                        <ReviewStars rating={reviewSummary.averageRating} size="sm" />
                                        <div>
                                            <p className="text-base font-bold text-gray-900 dark:text-white">
                                                {reviewSummary.reviewCount > 0 ? reviewSummary.averageRating.toFixed(1) : "0.0"} / 5
                                            </p>
                                            <p className="text-xs uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                                                {reviewSummary.reviewCount} review{reviewSummary.reviewCount === 1 ? "" : "s"}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {reviewSummary.reviewCount > 0 ? (
                                <div className="mt-6 space-y-4">
                                    {reviewSummary.reviews.map((review, index) => (
                                        <div key={`${review.customerName}-${review.createdAt ?? index}`} className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                <div>
                                                    <p className="font-semibold text-gray-900 dark:text-white">{review.customerName}</p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                                        {formatProductReviewDate(review.createdAt)}
                                                    </p>
                                                </div>
                                                <ReviewStars rating={review.rating} />
                                            </div>
                                            <div className="mt-4 flex gap-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
                                                <MessageSquareQuote className="mt-1 h-4 w-4 shrink-0 text-[#F58220]" />
                                                <p>{review.comment || "Rated this item without a written comment."}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="mt-6 rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-sm text-gray-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-gray-400">
                                    No one has reviewed this product yet.
                                </div>
                            )}
                        </div>
                    )}
                </section>

                <section className="mt-10">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#F58220]">Discover More</p>
                            <h2 className="mt-2 text-2xl font-black text-gray-900 dark:text-white sm:text-3xl">Similar Products</h2>
                        </div>
                        <Link
                            href={`/${product.sales_type === "wholesale" ? "wholesale" : "retail"}?category=${product.category}`}
                            className="text-sm font-semibold text-gray-600 transition-colors hover:text-[#F58220] dark:text-gray-300"
                        >
                            View More
                        </Link>
                    </div>

                    {relatedProducts.length > 0 ? (
                        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                            {relatedProducts.map((relatedProduct) => (
                                <ProductCard key={relatedProduct.id} product={relatedProduct} />
                            ))}
                        </div>
                    ) : (
                        <div className="mt-6 rounded-[1.75rem] border border-dashed border-gray-200 bg-white px-6 py-10 text-center text-sm text-gray-500 dark:border-zinc-800 dark:bg-zinc-950/70 dark:text-gray-400">
                            More similar products will appear here as the catalog grows.
                        </div>
                    )}
                </section>
            </div>

            <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-100 bg-white/90 p-3 backdrop-blur-xl dark:border-zinc-800 dark:bg-black/85 lg:hidden">
                <div className="mx-auto flex max-w-[1280px] items-center gap-3">
                    <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-400">Price</p>
                        <p className="truncate text-lg font-black text-[#F58220]">{formatKobo(effectivePriceKobo)}</p>
                    </div>
                    <Button
                        className="h-12 rounded-full bg-[#F58220] px-6 font-bold text-white hover:bg-[#F58220]/90"
                        onClick={handleAddToCart}
                        disabled={product.stock_level < 1}
                    >
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        {product.stock_level > 0 ? `Add ${quantity}` : "Out of Stock"}
                    </Button>
                </div>
            </div>
        </div>
    )
}
