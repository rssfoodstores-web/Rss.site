"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { ShoppingCart, Heart, Eye, MessageSquareQuote } from "lucide-react"
import { motion } from "framer-motion"
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
    const { addToCart } = useCart()
    const { toggleWishlist, isInWishlist } = useWishlist()
    const isWishlisted = isInWishlist(product.id)
    const [reviewsOpen, setReviewsOpen] = useState(false)

    const reviewSummary = product.reviewSummary ?? null
    const previewReviews = reviewSummary?.reviews.filter((review) => review.comment).slice(0, 1) ?? []

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
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -8 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="group relative bg-white dark:bg-zinc-900/50 backdrop-blur-sm border border-gray-100 dark:border-zinc-800 rounded-[2rem] overflow-hidden shadow-sm hover:shadow-xl hover:shadow-orange-500/10 transition-all duration-300"
        >
            <Dialog open={reviewsOpen} onOpenChange={setReviewsOpen}>
                <Link href={`/products/${product.id}`} className="block h-full">
                    {/* Image Container */}
                    <div className="relative aspect-[4/5] bg-gray-50 dark:bg-zinc-900 overflow-hidden">
                        <motion.div
                            className="w-full h-full"
                            whileHover={{ scale: 1.1 }}
                            transition={{ duration: 0.6 }}
                        >
                            {product.imageUrl ? (
                                <Image
                                    src={product.imageUrl}
                                    alt={product.name}
                                    fill
                                    className="object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-300">
                                    No Image
                                </div>
                            )}
                        </motion.div>

                        {/* Sale Badge */}
                        {product.isSale && (
                            <div className="absolute top-4 left-4 z-10">
                                <Badge className="bg-red-500 hover:bg-red-600 text-white border-0 px-3 py-1 text-xs font-bold shadow-lg shadow-red-500/20 uppercase tracking-widest backdrop-blur-md">
                                    Sale
                                </Badge>
                            </div>
                        )}

                        {/* Quick Actions (Floating) */}
                        <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
                            <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={handleToggleWishlist}
                                className={cn(
                                    "h-10 w-10 rounded-full flex items-center justify-center backdrop-blur-md border border-white/20 shadow-lg transition-colors",
                                    isWishlisted
                                        ? "bg-red-500 text-white border-red-500"
                                        : "bg-white/80 dark:bg-black/50 text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-zinc-800"
                                )}
                            >
                                <Heart className={cn("h-5 w-5", isWishlisted && "fill-current")} />
                            </motion.button>
                        </div>

                        {/* Add to Cart Overlay (Slide Up) */}
                        <div className="absolute inset-x-4 bottom-4 z-10 translate-y-[120%] group-hover:translate-y-0 transition-transform duration-300 ease-in-out">
                            <Button
                                className="w-full rounded-xl bg-white/90 dark:bg-black/90 backdrop-blur-md text-black dark:text-white hover:bg-primary hover:text-white dark:hover:text-white font-bold h-12 shadow-lg border border-white/20 transition-all"
                                onClick={handleAddToCart}
                            >
                                <ShoppingCart className="mr-2 h-4 w-4" />
                                Add to Cart
                            </Button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-3 md:p-5 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <Badge variant="outline" className="text-[10px] md:text-xs font-medium text-gray-500 border-gray-200 dark:border-zinc-700 bg-transparent px-1.5 py-0.5">
                                {product.category}
                            </Badge>
                        </div>

                        <h3 className="font-bold text-sm md:text-lg text-gray-900 dark:text-white leading-tight line-clamp-2 min-h-[2.5rem] md:min-h-[3rem] group-hover:text-[#F58220] transition-colors">
                            {product.name}
                        </h3>

                        <div className="rounded-2xl border border-orange-100 bg-orange-50/60 px-3 py-2 text-sm dark:border-orange-900/40 dark:bg-orange-950/20">
                            {reviewSummary && reviewSummary.reviewCount > 0 ? (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <ReviewStars rating={reviewSummary.averageRating} />
                                            <span className="font-semibold text-gray-900 dark:text-white">
                                                {reviewSummary.averageRating.toFixed(1)}
                                            </span>
                                        </div>
                                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                            {reviewSummary.reviewCount} review{reviewSummary.reviewCount === 1 ? "" : "s"}
                                        </span>
                                    </div>
                                    {previewReviews.length > 0 ? (
                                        <p className="line-clamp-2 text-xs text-gray-600 dark:text-gray-300">
                                            &ldquo;{previewReviews[0].comment}&rdquo;
                                        </p>
                                    ) : (
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            Buyers have rated this item. Open reviews to read their notes.
                                        </p>
                                    )}
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-auto p-0 text-xs font-semibold text-[#F58220] hover:bg-transparent hover:text-[#E57210]"
                                        onClick={handleOpenReviews}
                                    >
                                        <Eye className="mr-1.5 h-3.5 w-3.5" />
                                        View all reviews
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
                                        <ReviewStars rating={0} />
                                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                                            No ratings yet
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        This item has not received buyer feedback yet.
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="flex items-end justify-between mt-1 md:mt-2">
                            <div className="flex flex-col">
                                <span className="text-[10px] md:text-xs text-gray-400 font-medium">Price</span>
                                <span className="text-base md:text-xl font-bold text-[#F58220] tracking-tight">
                                    {formatKobo(product.price)}
                                </span>
                            </div>
                            <div className="md:hidden">
                                <Button
                                    size="icon"
                                    className="rounded-full bg-[#F58220] h-8 w-8 shadow-md active:scale-95 transition-transform"
                                    onClick={handleAddToCart}
                                >
                                    <ShoppingCart className="h-4 w-4 text-white" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </Link>

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
