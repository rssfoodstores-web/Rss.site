"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { ProductCard, Product } from "@/components/home/ProductCard"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { groupProductReviewsByProduct, type ProductReviewRow } from "@/lib/productReviews"
const NIGERIAN_STATES = [
    "Lagos", "Abuja", "Rivers", "Oyo", "Ogun", "Kano", "Kaduna", "Enugu", "Delta", "Edo"
]

import { useSearchParams } from "next/navigation"

interface ProductGridProps {
    salesType?: 'retail' | 'wholesale'
    title?: string
}

interface ProductRow {
    id: string
    name: string
    price: number
    image_url: string | null
    category: string
    stock_level: number
    merchant_id: string
}

interface ProductReviewQueryRow extends ProductReviewRow {
    customer?: {
        full_name: string | null
    } | null
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

export function ProductGrid({ salesType, title }: ProductGridProps) {
    const searchParams = useSearchParams()
    const categoryFilter = searchParams.get('category')

    const [products, setProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [retryCount, setRetryCount] = useState(0)
    const [locationFilter, setLocationFilter] = useState<string>("all")

    const supabase = createClient()
    const requestIdRef = useRef(0)
    const isMountedRef = useRef(false)

    const fetchProducts = useCallback(async () => {
        const requestId = ++requestIdRef.current

        try {
            setLoading(true)
            setError(null)

            let query = supabase
                .from("products")
                .select("*")
                .eq("status", "approved")
                .not("active_pricing_id", "is", null)
                .order("created_at", { ascending: false })
                .limit(20)

            // Filter by sales type if provided
            if (salesType) {
                query = query.eq('sales_type', salesType)
            }

            // Filter by Category
            if (categoryFilter) {
                query = query.eq('category', categoryFilter)
            }

            // Manual Location Filter
            if (locationFilter && locationFilter !== "all") {
                const baseState = locationFilter.trim()
                const stateVariations = [
                    baseState,
                    `${baseState} State`
                ]
                query = query.in("state", stateVariations)
            }

            const { data, error } = await query

            if (!isMountedRef.current || requestId !== requestIdRef.current) return

            if (error) {
                throw error
            }

            if (data) {
                const productRows = data as ProductRow[]
                const productIds = productRows.map((item) => item.id)
                let reviewSummaryByProduct: Record<string, Product["reviewSummary"]> = {}

                if (productIds.length > 0) {
                    const { data: reviewData, error: reviewError } = await supabase
                        .from("product_reviews")
                        .select("product_id, rating, comment, created_at, customer:customer_id(full_name)")
                        .in("product_id", productIds)
                        .order("created_at", { ascending: false })

                    if (reviewError) {
                        console.error("Error fetching product reviews:", reviewError)
                    } else {
                        reviewSummaryByProduct = groupProductReviewsByProduct(
                            (reviewData ?? []) as ProductReviewQueryRow[]
                        )
                    }
                }

                const formattedProducts: Product[] = productRows.map((item) => ({
                    id: item.id,
                    name: item.name,
                    price: item.price,
                    imageUrl: item.image_url ?? "",
                    category: item.category,
                    stock: item.stock_level,
                    merchantId: item.merchant_id,
                    reviewSummary: reviewSummaryByProduct[item.id] ?? null,
                }))
                setProducts(formattedProducts)
            }
        } catch (err) {
            if (!isMountedRef.current || requestId !== requestIdRef.current) return

            if (isAbortLikeError(err)) {
                return
            }

            console.error("Error fetching products:", {
                message: getErrorMessage(err),
                error: err
            })
            setError("Failed to load products. Please try again.")
        } finally {
            if (isMountedRef.current && requestId === requestIdRef.current) {
                setLoading(false)
            }
        }
    }, [supabase, locationFilter, salesType, categoryFilter])

    useEffect(() => {
        isMountedRef.current = true
        fetchProducts()
        return () => {
            isMountedRef.current = false
        }
    }, [fetchProducts, retryCount])

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="h-10 w-10 text-red-500 mb-4" />
                <p className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">{error}</p>
                <Button onClick={() => setRetryCount(c => c + 1)}>Try Again</Button>
            </div>
        )
    }

    const formatCategoryName = (slug: string) => {
        return slug.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
    }

    const displayTitle = title
        ? title
        : categoryFilter
            ? `${formatCategoryName(categoryFilter)} Products`
            : locationFilter !== 'all'
                ? `Products in ${locationFilter}`
                : "Fresh products"

    return (
        <section className="py-8" id="product-grid">
            <div className="container mx-auto px-4 md:px-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <h2 className="text-2xl font-bold text-[#002603] dark:text-white">
                        {displayTitle}
                    </h2>

                    <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-gray-500" />
                        <label className="sr-only" htmlFor="product-location-filter">
                            Filter products by location
                        </label>
                        <select
                            id="product-location-filter"
                            value={locationFilter}
                            onChange={(event) => setLocationFilter(event.target.value)}
                            className="h-10 w-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                            <option value="all">All Locations</option>
                            {NIGERIAN_STATES.map((state) => (
                                <option key={state} value={state}>
                                    {state}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {loading ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                        {[...Array(8)].map((_, i) => (
                            <div key={i} className="space-y-3">
                                <Skeleton className="h-[180px] w-full rounded-xl" />
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-4 w-1/2" />
                            </div>
                        ))}
                    </div>
                ) : products.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 text-left">
                        {products.map((product) => (
                            <ProductCard key={product.id} product={product} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 bg-gray-50 dark:bg-zinc-900 rounded-xl">
                        <p className="text-gray-500 dark:text-gray-400">
                            No products found {locationFilter !== 'all' ? `in ${locationFilter}` : ''}.
                        </p>
                        <Button variant="link" onClick={() => setLocationFilter("all")}>
                            View all products
                        </Button>
                    </div>
                )}
            </div>
        </section>
    )
}
