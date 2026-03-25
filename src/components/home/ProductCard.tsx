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
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="group relative bg-white dark:bg-zinc-900/50 backdrop-blur-sm border border-gray-100 dark:border-zinc-800 rounded-xl md:rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover:shadow-orange-500/10 transition-all duration-300 flex flex-col"
        >
            <Dialog open={reviewsOpen} onOpenChange={setReviewsOpen}>
                <Link href={`/products/${product.id}`} className="flex flex-col flex-1 h-full">
                    {/* Image Container */}
                    <div className="relative aspect-[5/4] md:aspect-[4/5] bg-gray-50 dark:bg-zinc-900 overflow-hidden shrink-0">
                        <div className="w-full h-full transition-transform duration-500 ease-out group-hover:scale-105">
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
                        </div>

                        {/* Sale Badge */}
                        {product.isSale && (
                            <div className="absolute top-2 left-2 md:top-4 md:left-4 z-10">
                                <Badge className="bg-red-500 hover:bg-red-600 text-white border-0 px-2 py-0.5 md:px-3 md:py-1 text-[10px] md:text-xs font-bold shadow-lg shadow-red-500/20 uppercase tracking-widest backdrop-blur-md">
                                    Sale
                                </Badge>
                            </div>
                        )}

                        {/* Quick Actions (Floating) */}
                        <div className="absolute top-2 right-2 md:top-4 md:right-4 z-10 flex flex-col gap-2">
                            <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={handleToggleWishlist}
                                className={cn(
                                    "h-8 w-8 md:h-10 md:w-10 rounded-full flex items-center justify-center backdrop-blur-md border border-white/20 shadow-lg transition-colors",
                                    isWishlisted
                                        ? "bg-red-500 text-white border-red-500"
                                        : "bg-white/80 dark:bg-black/50 text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-zinc-800"
                                )}
                            >
                                <Heart className={cn("h-4 w-4 md:h-5 md:w-5", isWishlisted && "fill-current")} />
                            </motion.button>
                        </div>

                    </div>

                    {/* Content */}
                    <div className="p-2 md:p-5 flex flex-col gap-1 md:gap-2 flex-1">
                        <div className="flex items-center justify-between">
                            <Badge variant="secondary" className="text-[10px] md:text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-zinc-800 border-transparent hover:bg-gray-200 dark:hover:bg-zinc-700 px-2 py-0.5 rounded-full transition-colors">
                                {product.category}
                            </Badge>
                        </div>

                        <h3 className="font-bold text-xs md:text-base lg:text-lg text-gray-900 dark:text-white leading-tight line-clamp-2 min-h-0 md:min-h-[2.5rem] group-hover:text-[#F58220] transition-colors">
                            {product.name}
                        </h3>

                        {/* Mobile hide ratings for compactness */}
                        <div className="hidden md:flex flex-col gap-1 mt-1">
                            {reviewSummary && reviewSummary.reviewCount > 0 ? (
                                <button type="button" onClick={handleOpenReviews} className="flex items-center gap-1.5 hover:opacity-80 transition-opacity focus:outline-none w-fit">
                                    <ReviewStars rating={reviewSummary.averageRating} size="sm" />
                                    <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                                        {reviewSummary.averageRating.toFixed(1)}
                                    </span>
                                    <span className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400">
                                        ({reviewSummary.reviewCount})
                                    </span>
                                </button>
                            ) : (
                                <div className="flex items-center gap-1.5">
                                    <ReviewStars rating={0} size="sm" />
                                    <span className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 font-medium">
                                        No ratings
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-between mt-auto pt-2 md:pt-4">
                            <span className="text-sm md:text-xl font-extrabold text-[#F58220] tracking-tight">
                                {formatKobo(product.price)}
                            </span>
                            <Button
                                size="sm"
                                className="rounded-full bg-[#F58220] text-white hover:bg-[#E57210] h-8 w-8 md:h-9 md:w-9 p-0 md:w-auto md:px-4 flex items-center justify-center shadow-md active:scale-95 transition-all group-hover:shadow-lg"
                                onClick={handleAddToCart}
                            >
                                <ShoppingCart className="h-4 w-4 md:mr-2 shrink-0" />
                                <span className="hidden md:inline font-semibold">Add</span>
                            </Button>
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
