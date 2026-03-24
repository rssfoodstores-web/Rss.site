"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { ShoppingCart, Heart, Info, ArrowLeft, MessageSquareQuote } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ReviewStars } from "@/components/ui/ReviewStars"
import { useCart } from "@/context/CartContext"
import { useWishlist } from "@/context/WishlistContext"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { formatKobo } from "@/lib/money"
import {
    formatProductReviewDate,
    summarizeProductReviews,
    type ProductReview,
    type ProductReviewRow,
} from "@/lib/productReviews"
// Import Lottie Loader (User provided animations?)
import { LottieLoader } from "@/components/ui/lottie-loader"
// If user has a specific lottie file, they can import it here.
// import loadingAnimation from "@/assets/lottie/loading.json" 

interface ProductDetails {
    id: string
    name: string
    description: string
    price: number
    image_url: string
    category: string
    stock_level: number
    merchant_id: string
    weight?: string
    sales_type?: string
    tags?: string[]
    discount_price?: string | number
    has_options?: boolean
    options?: { type: string; values: string[] }[]
    merchants?: {
        store_name: string
        business_address: string
    }
    merchant_profile?: {
        state: string
        avatar_url?: string | null
    }
}

interface ProductReviewQueryRow extends ProductReviewRow {
    customer?: {
        full_name: string | null
    } | null
}

export default function ProductDetailsPage() {
    const params = useParams()
    const router = useRouter()
    const { id } = params as { id: string }

    const [product, setProduct] = useState<ProductDetails | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [selectedOption, setSelectedOption] = useState<string | null>(null)
    const [reviews, setReviews] = useState<ProductReview[]>([])

    const { addToCart } = useCart()
    const { toggleWishlist, isInWishlist } = useWishlist()
    const supabase = createClient()

    useEffect(() => {
        let mounted = true
        const controller = new AbortController()
        const signal = controller.signal

        const fetchProductData = async () => {
            if (!id) return
            setLoading(true)
            setError(null)

            try {
                // 1. Fetch Product
                const [{ data: productData, error: productError }, { data: reviewData, error: reviewError }] = await Promise.all([
                    supabase
                        .from('products')
                        .select('*')
                        .eq('id', id)
                        .eq('status', 'approved')
                        .not('active_pricing_id', 'is', null)
                        .single()
                        .abortSignal(signal),
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

                if (!mounted) return

                if (mounted) {
                    setProduct(productData)
                    setReviews(
                        ((reviewData ?? []) as ProductReviewQueryRow[]).map((review) => ({
                            productId: review.product_id,
                            rating: review.rating,
                            comment: review.comment?.trim() ?? "",
                            createdAt: review.created_at,
                            customerName: review.customer?.full_name?.trim() || "Verified buyer",
                        }))
                    )

                    if (productData.has_options && productData.options && productData.options.length > 0 && productData.options[0].values.length > 0) {
                        setSelectedOption(productData.options[0].values[0])
                    }
                }

            } catch (err: unknown) {
                if (
                    err instanceof Error
                    && (err.name === 'AbortError' || err.message === 'Fetch is aborted')
                ) {
                    // Ignore abort errors
                    return
                }
                console.error("Error fetching product:", err)
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
            <div className="min-h-screen bg-white dark:bg-black font-sans flex items-center justify-center">
                {/* 
                   USER: If you have a Lottie JSON file, import it and pass it here:
                   <LottieLoader animationData={yourAnimationJson} text="Loading Product..." />
                */}
                <LottieLoader text="Loading details..." className="scale-125" />
            </div>
        )
    }

    if (error || !product) {
        return (
            <div className="min-h-screen bg-white dark:bg-black font-sans flex flex-col items-center justify-center p-4">
                <div className="bg-red-50 dark:bg-red-900/10 p-6 rounded-3xl flex flex-col items-center text-center max-w-md">
                    <Info className="h-12 w-12 text-red-500 mb-4" />
                    <h1 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">Product Not Found</h1>
                    <p className="text-gray-500 mb-6">
                        We couldn&apos;t find the product you&apos;re looking for. It might have been removed or the link is invalid.
                    </p>
                    <Link href="/">
                        <Button className="rounded-full bg-[#F58220] hover:bg-[#F58220]/90 text-white px-8 font-bold">
                            Back to Store
                        </Button>
                    </Link>
                </div>
            </div>
        )
    }

    const isWishlisted = isInWishlist(product.id)
    const hasDiscount = false
    const reviewSummary = summarizeProductReviews(reviews)

    // Helper to calculate discount percentage
    const discountPercent = hasDiscount
        ? Math.round(((product.price - Number(product.discount_price)) / product.price) * 100)
        : 0

    return (
        <div className="min-h-screen bg-white dark:bg-black pb-32 font-sans text-[#1A1A1A] dark:text-white">
            {/* Header / Nav */}
            <div className="sticky top-0 z-40 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-gray-100 dark:border-zinc-900">
                <div className="container mx-auto px-4 lg:px-6 h-16 flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <span className="font-bold text-lg truncate flex-1">{product.name}</span>
                    <Button variant="ghost" size="icon" onClick={() => router.push('/cart')} className="rounded-full relative">
                        <ShoppingCart className="h-5 w-5" />
                        {/* Dot for cart items could go here */}
                    </Button>
                </div>
            </div>

            <div className="container mx-auto px-4 lg:px-6 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 xl:gap-24 items-start">

                    {/* Image Gallery Section */}
                    <div className="relative sticky top-24">
                        <div className="aspect-[4/5] md:aspect-square bg-gray-50 dark:bg-zinc-900 rounded-[2.5rem] overflow-hidden border border-gray-100 dark:border-zinc-800 relative group shadow-2xl shadow-gray-200/50 dark:shadow-black/50">
                            {product.image_url ? (
                                <Image
                                    src={product.image_url}
                                    alt={product.name}
                                    fill
                                    className="object-cover transition-transform duration-700 hover:scale-105"
                                    priority
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-300">
                                    <Info className="h-20 w-20" />
                                </div>
                            )}

                            {/* Discount Badge on Image */}
                            {hasDiscount && (
                                <div className="absolute top-6 left-6 z-10">
                                    <Badge className="bg-red-500 hover:bg-red-600 text-white border-0 px-3 py-1.5 text-sm font-bold shadow-lg shadow-red-500/20">
                                        -{discountPercent}% OFF
                                    </Badge>
                                </div>
                            )}

                            <div className="absolute top-6 right-6 z-10">
                                <Button
                                    size="icon"
                                    variant="secondary"
                                    className={cn("h-14 w-14 rounded-full shadow-xl hover:scale-110 transition-all border border-white/20 backdrop-blur-md bg-white/80 dark:bg-black/50", isWishlisted && "text-red-500 bg-red-50 dark:bg-red-900/20")}
                                    onClick={() => toggleWishlist({
                                        id: product.id,
                                        name: product.name,
                                        price: product.price,
                                        image: product.image_url,
                                        category: product.category,
                                        stock_level: product.stock_level
                                    })}
                                >
                                    <Heart className={cn("h-7 w-7", isWishlisted && "fill-current")} />
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Product Info Section */}
                    <div className="flex flex-col h-full justify-center pt-4 space-y-8">

                        {/* Categories & Stock Status */}
                        <div className="flex items-center flex-wrap gap-3">
                            <Badge variant="outline" className="text-[#F58220] border-orange-200 bg-orange-50 dark:bg-orange-900/10 px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wider">
                                {product.category}
                            </Badge>
                            {product.sales_type && (
                                <Badge variant="secondary" className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-gray-100 dark:bg-gray-800">
                                    {product.sales_type.toUpperCase()}
                                </Badge>
                            )}
                            {product.stock_level > 0 ? (
                                <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-0 rounded-full px-3 py-1">
                                    In Stock
                                </Badge>
                            ) : (
                                <Badge variant="destructive" className="rounded-full px-3 py-1">Out of Stock</Badge>
                            )}
                        </div>

                        {/* Title & Price */}
                        <div>
                            <h1 className="text-4xl md:text-5xl font-black mb-4 leading-[1.1] tracking-tight text-gray-900 dark:text-white">
                                {product.name}
                            </h1>

                            <div className="flex items-baseline gap-4 mb-2">
                                <span className="text-5xl font-bold text-[#F58220]">
                                    {formatKobo(product.price)}
                                </span>
                                {hasDiscount && (
                                    <span className="text-2xl text-gray-400 line-through font-medium">
                                        {formatKobo(product.price)}
                                    </span>
                                )}
                            </div>

                            {/* Weight Display */}
                            {product.weight && (
                                <p className="text-gray-500 font-medium text-lg">
                                    Weight: <span className="text-gray-900 dark:text-gray-200">{product.weight}</span>
                                </p>
                            )}

                            <div className="mt-6 rounded-2xl border border-orange-100 bg-orange-50/70 px-4 py-4 dark:border-orange-900/40 dark:bg-orange-950/20">
                                {reviewSummary.reviewCount > 0 ? (
                                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                        <div className="flex items-center gap-3">
                                            <ReviewStars rating={reviewSummary.averageRating} size="md" />
                                            <div>
                                                <p className="text-lg font-bold text-gray-900 dark:text-white">
                                                    {reviewSummary.averageRating.toFixed(1)} out of 5
                                                </p>
                                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                                    Based on {reviewSummary.reviewCount} customer review{reviewSummary.reviewCount === 1 ? "" : "s"}
                                                </p>
                                            </div>
                                        </div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            Buyer feedback is shown before checkout.
                                        </p>
                                    </div>
                                ) : (
                                    <div>
                                        <p className="text-lg font-semibold text-gray-900 dark:text-white">No customer reviews yet</p>
                                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                            This product is live, but no buyer has left feedback yet.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Tags */}
                        {product.tags && product.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {product.tags.map(tag => (
                                    <span key={tag} className="text-xs font-medium px-2.5 py-1 bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 rounded-md">
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Options Selection */}
                        {product.has_options && product.options && product.options.length > 0 && (
                            <div className="space-y-3">
                                <h3 className="font-bold text-sm uppercase tracking-wide text-gray-500">
                                    Select {product.options[0].type}
                                </h3>
                                <div className="flex flex-wrap gap-3">
                                    {product.options[0].values.map((value) => (
                                        <button
                                            key={value}
                                            onClick={() => setSelectedOption(value)}
                                            className={cn(
                                                "px-6 py-3 rounded-xl font-bold border-2 transition-all duration-200",
                                                selectedOption === value
                                                    ? "border-[#F58220] bg-orange-50 text-[#F58220] dark:bg-orange-900/20"
                                                    : "border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-zinc-700"
                                            )}
                                        >
                                            {value}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Description */}
                        <div>
                            <h3 className="font-bold text-lg mb-3 flex items-center gap-2 text-gray-900 dark:text-gray-100">
                                Description
                            </h3>
                            <div className="prose dark:prose-invert max-w-none text-gray-500 dark:text-gray-400 text-lg leading-relaxed bg-gray-50 dark:bg-zinc-900/50 p-6 rounded-2xl border border-gray-100 dark:border-zinc-800/50">
                                <p>{product.description || "No description available for this product."}</p>
                            </div>
                        </div>

                        <div>
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">Customer Reviews</h3>
                                {reviewSummary.reviewCount > 0 && (
                                    <span className="text-sm text-gray-500 dark:text-gray-400">
                                        {reviewSummary.averageRating.toFixed(1)} average · {reviewSummary.reviewCount} review{reviewSummary.reviewCount === 1 ? "" : "s"}
                                    </span>
                                )}
                            </div>
                            {reviewSummary.reviewCount > 0 ? (
                                <div className="space-y-4">
                                    {reviewSummary.reviews.map((review, index) => (
                                        <div key={`${review.customerName}-${review.createdAt ?? index}`} className="rounded-2xl border border-gray-100 bg-gray-50/80 p-5 dark:border-zinc-800 dark:bg-zinc-900/50">
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
                                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-sm text-gray-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-gray-400">
                                    No one has reviewed this product yet.
                                </div>
                            )}
                        </div>

                        {/* Footer Action Bar (Mobile Sticky) */}
                        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-t border-gray-100 dark:border-zinc-800 lg:relative lg:p-0 lg:bg-transparent lg:border-0 lg:backdrop-blur-none z-50">
                            <Button
                                size="lg"
                                className="w-full rounded-full bg-[#F58220] hover:bg-[#F58220]/90 text-white font-bold h-16 text-xl shadow-xl shadow-orange-500/20 active:scale-[0.98] transition-all"
                                onClick={() => addToCart({
                                    id: product.id,
                                    name: product.name,
                                    price: product.price,
                                    image: product.image_url,
                                    category: product.category,
                                    stock_level: product.stock_level,
                                    merchantId: product.merchant_id
                                })}
                                disabled={product.stock_level < 1}
                            >
                                <ShoppingCart className="mr-2 h-6 w-6" />
                                {product.stock_level > 0 ? "Add to Cart" : "Out of Stock"}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
