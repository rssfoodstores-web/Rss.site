"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { ShoppingCart, Heart, MessageSquareQuote } from "lucide-react"
import { motion, useReducedMotion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { ReviewStars } from "@/components/ui/ReviewStars"
import { useCart } from "@/context/CartContext"
import { useWishlist } from "@/context/WishlistContext"
import { cn } from "@/lib/utils"
import { formatKobo } from "@/lib/money"
import type { ProductReviewSummary } from "@/lib/productReviews"
import { formatProductReviewDate } from "@/lib/productReviews"
import { buildCanonicalProductPath } from "@/lib/seo"
import { buildOptimizedImageUrl, shouldBypassNextImageOptimizer } from "@/lib/imageDelivery"

export interface Product {
    id: string
    name: string
    price: number
    category: string
    imageUrl: string
    rating?: number
    isSale?: boolean
    stock?: number
    merchantId?: string
    reviewSummary?: ProductReviewSummary | null
}

export function ProductCard({ product }: { product: Product }) {
    const reduceMotion = useReducedMotion() ?? false
    const { addToCart } = useCart()
    const { toggleWishlist, isInWishlist } = useWishlist()
    const isWishlisted = isInWishlist(product.id)
    const [reviewsOpen, setReviewsOpen] = useState(false)

    const reviewSummary = product.reviewSummary ?? null
    const productImageSrc = buildOptimizedImageUrl(product.imageUrl, { width: 960 })
    const bypassNextImageOptimizer = shouldBypassNextImageOptimizer(product.imageUrl)

    const handleAddToCart = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        addToCart(product)
    }

    const handleToggleWishlist = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        toggleWishlist(product)
    }

    const handleOpenReviews = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setReviewsOpen(true)
    }

    return (
        <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.24, ease: "easeOut" }}
            className="group relative flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-orange-100 hover:shadow-lg hover:shadow-orange-500/[0.08] dark:border-zinc-800 dark:bg-zinc-900/50 md:rounded-3xl"
        >
            <Dialog open={reviewsOpen} onOpenChange={setReviewsOpen}>
                <Link href={buildCanonicalProductPath(product.name, product.id)} className="flex min-w-0 flex-1 flex-col">
                    {/* Image Container */}
                    <div className="relative aspect-square shrink-0 overflow-hidden bg-gray-50 dark:bg-zinc-900 md:aspect-[4/5]">
                        <div className="h-full w-full transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none">
                            {product.imageUrl ? (
                                <Image
                                    src={productImageSrc}
                                    alt={product.name}
                                    fill
                                    className="object-cover"
                                    sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 20vw"
                                    unoptimized={bypassNextImageOptimizer}
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-300">
                                    No Image
                                </div>
                            )}
                        </div>

                        {/* Sale Badge */}
                        {product.isSale && (
                            <div className="absolute top-2 left-2 md:top-4 md:left-4 z-10">
                                <Badge className="bg-red-500 hover:bg-red-600 text-white border-0 px-2 py-0.5 md:px-3 md:py-1 text-[10px] md:text-xs font-bold shadow-lg shadow-red-500/20 uppercase tracking-widest backdrop-blur-md">
                                    Sale
                                </Badge>
                            </div>
                        )}

                    </div>

                    {/* Content */}
                    <div className="flex flex-col gap-2 p-3 md:gap-2.5 md:p-5">
                        <div className="flex items-center justify-between">
                            <Badge variant="secondary" className="text-[10px] md:text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-zinc-800 border-transparent hover:bg-gray-200 dark:hover:bg-zinc-700 px-2 py-0.5 rounded-full transition-colors">
                                {product.category.replaceAll("_", " ")}
                            </Badge>
                        </div>

                        <h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-snug text-gray-900 transition-colors group-hover:text-[#F58220] dark:text-white md:min-h-[2.5rem] md:text-base lg:text-lg">
                            {product.name}
                        </h3>

                    </div>
                </Link>

                <div className="absolute right-2 top-2 z-10 flex flex-col gap-2 md:right-4 md:top-4">
                    <motion.button
                        whileHover={reduceMotion ? undefined : { scale: 1.06 }}
                        whileTap={reduceMotion ? undefined : { scale: 0.94 }}
                        onClick={handleToggleWishlist}
                        aria-label={isWishlisted ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
                        title={isWishlisted ? "Remove from wishlist" : "Save to wishlist"}
                        className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-full border border-white/20 shadow-lg backdrop-blur-md transition-colors",
                            isWishlisted
                                ? "border-red-500 bg-red-500 text-white"
                                : "bg-white/90 text-gray-700 hover:bg-white dark:bg-black/60 dark:text-gray-200 dark:hover:bg-zinc-800"
                        )}
                    >
                        <Heart className={cn("h-4 w-4 md:h-5 md:w-5", isWishlisted && "fill-current")} />
                    </motion.button>
                </div>

                <div className="mt-auto flex flex-col gap-2 px-3 pb-3 md:px-5 md:pb-5">
                    <button
                        type="button"
                        onClick={handleOpenReviews}
                        className="hidden w-fit items-center gap-1.5 text-left transition-opacity hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F58220] md:flex"
                        aria-label={reviewSummary && reviewSummary.reviewCount > 0 ? `Read ${reviewSummary.reviewCount} reviews for ${product.name}` : `See ratings for ${product.name}`}
                    >
                        {reviewSummary && reviewSummary.reviewCount > 0 ? (
                            <>
                                <ReviewStars rating={reviewSummary.averageRating} size="sm" />
                                <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">{reviewSummary.averageRating.toFixed(1)}</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">({reviewSummary.reviewCount})</span>
                            </>
                        ) : (
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">No ratings yet · View reviews</span>
                        )}
                    </button>

                    <div className="flex items-center justify-between gap-2 pt-1">
                            <span className="text-sm font-extrabold tracking-tight text-[#F58220] sm:text-base md:text-xl">
                                {formatKobo(product.price)}
                            </span>
                            <Button
                                size="sm"
                                aria-label={`Add ${product.name} to cart`}
                                className="h-10 w-10 shrink-0 rounded-full bg-[#F58220] p-0 text-white shadow-md transition-all hover:bg-[#E57210] hover:shadow-lg active:scale-95 md:h-10 md:w-auto md:px-4"
                                onClick={handleAddToCart}
                            >
                                <ShoppingCart className="h-4 w-4 md:mr-2 shrink-0" />
                                <span className="hidden md:inline font-semibold">Add</span>
                            </Button>
                    </div>
                </div>

                <DialogContent className="max-w-2xl rounded-3xl border-orange-100 p-0">
                    <DialogHeader className="border-b border-orange-100 bg-orange-50/70 px-6 py-5">
                        <DialogTitle className="text-xl text-gray-900">{product.name} reviews</DialogTitle>
                        <DialogDescription>
                            Customer ratings and comments for this product.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-5">
                        {reviewSummary && reviewSummary.reviewCount > 0 ? (
                            <>
                                <div className="flex items-center justify-between rounded-2xl border border-orange-100 bg-white px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <ReviewStars rating={reviewSummary.averageRating} size="md" />
                                        <span className="text-lg font-bold text-gray-900">
                                            {reviewSummary.averageRating.toFixed(1)}
                                        </span>
                                    </div>
                                    <span className="text-sm text-gray-500">
                                        {reviewSummary.reviewCount} verified buyer review{reviewSummary.reviewCount === 1 ? "" : "s"}
                                    </span>
                                </div>
                                <div className="space-y-3">
                                    {reviewSummary.reviews.map((review, index) => (
                                        <div key={`${review.customerName}-${review.createdAt ?? index}`} className="rounded-2xl border border-gray-100 bg-gray-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="font-semibold text-gray-900 dark:text-white">{review.customerName}</p>
                                                    <p className="text-xs text-gray-500">{formatProductReviewDate(review.createdAt)}</p>
                                                </div>
                                                <ReviewStars rating={review.rating} />
                                            </div>
                                            <div className="mt-3 flex gap-2 text-sm text-gray-600 dark:text-gray-300">
                                                <MessageSquareQuote className="mt-0.5 h-4 w-4 shrink-0 text-[#F58220]" />
                                                <p>{review.comment || "Rated this item without a written comment."}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-8 text-center text-sm text-gray-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-gray-400">
                                No buyer reviews yet for this product.
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </motion.div>
    )
}
