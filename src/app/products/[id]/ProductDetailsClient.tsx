"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
    ArrowLeft,
    Heart,
    Home,
    MapPin,
    MessageSquareQuote,
    Minus,
    Plus,
    ShoppingCart,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ProductCard, type Product as ProductCardProduct } from "@/components/home/ProductCard"
import { ReviewStars } from "@/components/ui/ReviewStars"
import { useCart } from "@/context/CartContext"
import { useWishlist } from "@/context/WishlistContext"
import {
    buildStorefrontCategoryPath,
    getStorefrontCategoryLabel,
    isStorefrontCategorySlug,
} from "@/lib/categories"
import { formatKobo } from "@/lib/money"
import {
    formatProductReviewDate,
    type ProductReview,
    type ProductReviewSummary,
} from "@/lib/productReviews"
import { buildOptimizedImageUrl, shouldBypassNextImageOptimizer } from "@/lib/imageDelivery"
import type { StorefrontProductDetails } from "@/lib/storefrontProducts"
import { cn } from "@/lib/utils"

interface ProductDetailsClientProps {
    cookedImages: string[]
    galleryImages: string[]
    product: StorefrontProductDetails
    relatedProducts: ProductCardProduct[]
    reviews: ProductReview[]
    reviewSummary: ProductReviewSummary
    sellerName: string
}

function getEffectivePriceKobo(price: number, discountPrice?: string | number | null) {
    const basePriceKobo = Number(price ?? 0)
    const discountPriceKobo = Number(discountPrice ?? 0)

    if (Number.isFinite(discountPriceKobo) && discountPriceKobo > 0 && discountPriceKobo < basePriceKobo) {
        return discountPriceKobo
    }

    return basePriceKobo
}

function getDisplayFacts(product: StorefrontProductDetails) {
    return [
        { label: "Available From", value: product.state?.trim() || "Not provided" },
        {
            label: "Product Size",
            value: product.weight?.trim()
                || product.options?.map((option) => `${option.type}: ${option.values.join(", ")}`).join(" | ")
                || "Not provided",
        },
    ]
}

export function ProductDetailsClient({
    cookedImages,
    galleryImages,
    product,
    relatedProducts,
    reviews,
    reviewSummary,
    sellerName,
}: ProductDetailsClientProps) {
    const router = useRouter()
    const { addToCart } = useCart()
    const { isInWishlist, toggleWishlist } = useWishlist()
    const [selectedImage, setSelectedImage] = useState<string | null>(galleryImages[0] ?? null)
    const [selectedOption, setSelectedOption] = useState<string | null>(
        product.has_options && product.options?.[0]?.values?.length
            ? product.options[0].values[0]
            : null
    )
    const [activeTab, setActiveTab] = useState<"description" | "reviews">("description")
    const [quantity, setQuantity] = useState(1)

    const categoryLabel = getStorefrontCategoryLabel(product.category)
    const salesPath = product.sales_type === "wholesale" ? "/wholesale" : "/retail"
    const categoryPath = isStorefrontCategorySlug(product.category)
        ? buildStorefrontCategoryPath(product.sales_type === "wholesale" ? "wholesale" : "retail", product.category)
        : salesPath
    const effectivePriceKobo = getEffectivePriceKobo(product.price, product.discount_price)
    const hasDiscount = effectivePriceKobo !== Number(product.price ?? 0)
    const primaryImage = selectedImage ?? galleryImages[0] ?? null
    const facts = getDisplayFacts(product)
    const isWishlisted = isInWishlist(product.id)
    const maxQuantity = Math.max(1, product.stock_level || 1)
    const nutritionItems = product.nutrition_content?.filter(Boolean) ?? []
    const healthBenefits = product.health_benefits?.filter(Boolean) ?? []
    const suggestedCombos = product.suggested_combos?.filter(Boolean) ?? []
    const primaryImageSrc = buildOptimizedImageUrl(primaryImage, { width: 1600 })
    const bypassPrimaryImageOptimizer = shouldBypassNextImageOptimizer(primaryImage)

    const handleAddToCart = () => {
        addToCart({
            category: product.category,
            id: product.id,
            image: primaryImage ?? undefined,
            merchantId: product.merchant_id,
            name: product.name,
            price: effectivePriceKobo,
            quantity,
            stock_level: product.stock_level,
        })
    }

    const handleToggleWishlist = async () => {
        await toggleWishlist({
            category: product.category,
            id: product.id,
            image: primaryImage ?? undefined,
            imageUrl: primaryImage ?? undefined,
            name: product.name,
            price: effectivePriceKobo,
            stock_level: product.stock_level,
        })
    }

    return (
        <div className="min-h-screen bg-[#FCFAF7] pb-28 text-[#1A1A1A] dark:bg-black dark:text-white">
            <div className="border-b border-gray-100 bg-white/90 backdrop-blur-md dark:border-zinc-900 dark:bg-black/80">
                <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
                    <div className="flex min-w-0 items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-gray-400">
                                <Link href="/" className="transition-colors hover:text-[#F58220]">
                                    <Home className="h-3.5 w-3.5" />
                                </Link>
                                <span>/</span>
                                <Link href={salesPath} className="transition-colors hover:text-[#F58220]">
                                    {product.sales_type === "wholesale" ? "Wholesale" : "Retail"}
                                </Link>
                                <span>/</span>
                                <Link href={categoryPath} className="truncate transition-colors hover:text-[#F58220]">
                                    {categoryLabel}
                                </Link>
                            </div>
                            <h1 className="mt-1 truncate text-lg font-black text-gray-900 dark:text-white sm:text-xl">
                                {product.name}
                            </h1>
                        </div>
                    </div>

                    <Button variant="ghost" size="icon" onClick={handleToggleWishlist} className="rounded-full">
                        <Heart className={cn("h-5 w-5", isWishlisted && "fill-current text-red-500")} />
                    </Button>
                </div>
            </div>

            <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 lg:px-8">
                <section className="rounded-[2rem] border border-gray-100 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/70 sm:p-6 lg:p-8">
                    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
                        <div className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-[84px_minmax(0,1fr)]">
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
                                                <Image
                                                    src={buildOptimizedImageUrl(image, { width: 240, height: 240 })}
                                                    alt={`${product.name} product image`}
                                                    fill
                                                    sizes="80px"
                                                    className="object-cover"
                                                    unoptimized={shouldBypassNextImageOptimizer(image)}
                                                />
                                            </button>
                                        ))}
                                    </div>
                                ) : null}

                                <div className="order-1 overflow-hidden rounded-[1.75rem] border border-gray-100 bg-gray-50 dark:border-zinc-800 dark:bg-zinc-900">
                                    <div className="relative aspect-[4/4.2]">
                                        {primaryImage ? (
                                            <Image
                                                src={primaryImageSrc}
                                                alt={product.name}
                                                fill
                                                priority
                                                sizes="(max-width: 1024px) 100vw, 50vw"
                                                className="object-cover"
                                                unoptimized={bypassPrimaryImageOptimizer}
                                            />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center px-6 text-center text-sm text-gray-400">
                                                Product image unavailable.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {cookedImages.length > 0 ? (
                                <div className="grid gap-3 sm:grid-cols-3">
                                    {cookedImages.slice(0, 3).map((image) => (
                                        <div key={image} className="relative aspect-square overflow-hidden rounded-2xl border border-gray-100 bg-gray-50 dark:border-zinc-800 dark:bg-zinc-900">
                                            <Image
                                                src={buildOptimizedImageUrl(image, { width: 720, height: 720 })}
                                                alt={`${product.name} prepared view`}
                                                fill
                                                sizes="(max-width: 768px) 33vw, 20vw"
                                                className="object-cover"
                                                unoptimized={shouldBypassNextImageOptimizer(image)}
                                            />
                                        </div>
                                    ))}
                                </div>
                            ) : null}
                        </div>

                        <div className="space-y-6">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[#C25F14] dark:bg-orange-950/20 dark:text-orange-200">
                                    {categoryLabel}
                                </Badge>
                                <Badge variant="secondary" className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold capitalize text-gray-600 dark:bg-zinc-800 dark:text-zinc-200">
                                    {product.sales_type === "wholesale" ? "Wholesale" : "Retail"}
                                </Badge>
                                {product.stock_level > 0 ? (
                                    <Badge className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-200">
                                        In stock
                                    </Badge>
                                ) : (
                                    <Badge className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600 dark:bg-red-950/20 dark:text-red-200">
                                        Out of stock
                                    </Badge>
                                )}
                            </div>

                            <div>
                                <div className="flex flex-wrap items-center gap-3">
                                    <div className="flex items-center gap-2 rounded-full bg-gray-50 px-4 py-2 dark:bg-zinc-900">
                                        <ReviewStars rating={reviewSummary.averageRating} size="sm" />
                                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                            {reviewSummary.reviewCount > 0 ? reviewSummary.averageRating.toFixed(1) : "0.0"}
                                        </span>
                                        <span className="text-sm text-gray-500 dark:text-gray-400">
                                            ({reviewSummary.reviewCount} review{reviewSummary.reviewCount === 1 ? "" : "s"})
                                        </span>
                                    </div>
                                    <div className="rounded-full bg-gray-50 px-4 py-2 text-sm text-gray-500 dark:bg-zinc-900 dark:text-zinc-300">
                                        Sold by {sellerName}
                                    </div>
                                </div>

                                <div className="mt-6 flex items-end gap-3">
                                    <span className="text-3xl font-black text-[#F58220] sm:text-4xl">{formatKobo(effectivePriceKobo)}</span>
                                    {hasDiscount ? (
                                        <span className="pb-1 text-lg text-gray-400 line-through">{formatKobo(product.price)}</span>
                                    ) : null}
                                </div>

                                <p className="mt-4 text-base leading-7 text-gray-600 dark:text-gray-300">
                                    {product.description || "No description available for this product."}
                                </p>
                            </div>

                            {product.has_options && product.options?.length ? (
                                <div className="space-y-4">
                                    {product.options.map((option) => (
                                        <div key={option.type}>
                                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-400">{option.type}</p>
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {option.values.map((value) => (
                                                    <button
                                                        key={value}
                                                        type="button"
                                                        onClick={() => setSelectedOption(value)}
                                                        className={cn(
                                                            "rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
                                                            selectedOption === value
                                                                ? "border-[#F58220] bg-[#F58220] text-white"
                                                                : "border-gray-200 bg-white text-gray-700 hover:border-orange-200 hover:text-[#F58220] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                                                        )}
                                                    >
                                                        {value}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : null}

                            <div className="grid gap-3 sm:grid-cols-2">
                                {facts.map((fact) => (
                                    <div key={fact.label} className="rounded-2xl bg-gray-50 px-4 py-3 dark:bg-zinc-900">
                                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-400">{fact.label}</p>
                                        <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">{fact.value}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                                <div className="flex items-center justify-between rounded-full border border-gray-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900">
                                    <button type="button" onClick={() => setQuantity((current) => Math.max(1, current - 1))} className="rounded-full p-1 text-gray-500 transition-colors hover:text-[#F58220]">
                                        <Minus className="h-4 w-4" />
                                    </button>
                                    <span className="px-4 text-base font-bold">{quantity}</span>
                                    <button type="button" onClick={() => setQuantity((current) => Math.min(maxQuantity, current + 1))} className="rounded-full p-1 text-gray-500 transition-colors hover:text-[#F58220]">
                                        <Plus className="h-4 w-4" />
                                    </button>
                                </div>

                                <Button className="h-12 flex-1 rounded-full bg-[#F58220] px-6 font-bold text-white hover:bg-[#E57210]" onClick={handleAddToCart} disabled={product.stock_level < 1}>
                                    <ShoppingCart className="mr-2 h-4 w-4" />
                                    {product.stock_level > 0 ? `Add ${quantity} to cart` : "Out of Stock"}
                                </Button>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="mt-10 rounded-[2rem] border border-gray-100 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/70 sm:p-6">
                    <div className="flex flex-wrap gap-3">
                        <button type="button" onClick={() => setActiveTab("description")} className={cn("rounded-full px-5 py-2 text-sm font-semibold transition-all", activeTab === "description" ? "bg-[#F58220] text-white" : "bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-300")}>
                            Description
                        </button>
                        <button type="button" onClick={() => setActiveTab("reviews")} className={cn("rounded-full px-5 py-2 text-sm font-semibold transition-all", activeTab === "reviews" ? "bg-[#F58220] text-white" : "bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-300")}>
                            Reviews ({reviewSummary.reviewCount})
                        </button>
                    </div>

                    {activeTab === "description" ? (
                        <div className="mt-6 grid gap-6 lg:grid-cols-2">
                            <div className="rounded-[1.75rem] border border-gray-100 bg-[#FFFDFC] p-5 dark:border-zinc-800 dark:bg-zinc-900/60">
                                <h2 className="text-xl font-black text-gray-900 dark:text-white">Product Notes</h2>
                                <p className="mt-4 text-sm leading-7 text-gray-600 dark:text-gray-300">{product.description || "No description available for this product."}</p>
                            </div>
                            <div className="rounded-[1.75rem] border border-gray-100 bg-[#FFFDFC] p-5 dark:border-zinc-800 dark:bg-zinc-900/60">
                                <h2 className="text-xl font-black text-gray-900 dark:text-white">Extra Details</h2>
                                <div className="mt-4 space-y-3 text-sm leading-7 text-gray-600 dark:text-gray-300">
                                    {nutritionItems.length > 0 ? <p><span className="font-semibold text-gray-900 dark:text-white">Nutrition:</span> {nutritionItems.join(", ")}</p> : null}
                                    {healthBenefits.length > 0 ? <p><span className="font-semibold text-gray-900 dark:text-white">Benefits:</span> {healthBenefits.join(", ")}</p> : null}
                                    {suggestedCombos.length > 0 ? <p><span className="font-semibold text-gray-900 dark:text-white">Suggested combos:</span> {suggestedCombos.join(", ")}</p> : null}
                                    <p><span className="font-semibold text-gray-900 dark:text-white">Pickup state:</span> {product.state?.trim() || "Not provided"}</p>
                                    <p><span className="font-semibold text-gray-900 dark:text-white">Merchant:</span> {sellerName}</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="mt-6 space-y-4">
                            {reviews.length > 0 ? (
                                reviews.map((review, index) => (
                                    <div key={`${review.customerName}-${review.createdAt ?? index}`} className="rounded-[1.75rem] border border-gray-100 bg-[#FFFDFC] p-5 dark:border-zinc-800 dark:bg-zinc-900/60">
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                            <div>
                                                <p className="font-semibold text-gray-900 dark:text-white">{review.customerName}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">{formatProductReviewDate(review.createdAt)}</p>
                                            </div>
                                            <ReviewStars rating={review.rating} />
                                        </div>
                                        <div className="mt-4 flex gap-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
                                            <MessageSquareQuote className="mt-1 h-4 w-4 shrink-0 text-[#F58220]" />
                                            <p>{review.comment || "Rated this item without a written comment."}</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="rounded-[1.75rem] border border-dashed border-gray-200 bg-gray-50 p-6 text-sm text-gray-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-gray-400">
                                    No buyer reviews yet for this product.
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
                        <Link href={categoryPath} className="flex items-center gap-2 text-sm font-semibold text-gray-600 transition-colors hover:text-[#F58220] dark:text-gray-300">
                            <MapPin className="h-4 w-4" />
                            View this category
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
                    <Button className="h-12 rounded-full bg-[#F58220] px-6 font-bold text-white hover:bg-[#E57210]" onClick={handleAddToCart} disabled={product.stock_level < 1}>
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        {product.stock_level > 0 ? `Add ${quantity}` : "Out of Stock"}
                    </Button>
                </div>
            </div>
        </div>
    )
}
