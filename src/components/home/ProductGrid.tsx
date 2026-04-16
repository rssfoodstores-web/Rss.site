"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { createPublicStorefrontClient } from "@/lib/supabase/client"
import { ProductCard, type Product } from "@/components/home/ProductCard"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle, Filter, MapPin, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { groupProductReviewsByProduct, type ProductReviewRow } from "@/lib/productReviews"
import {
    createStorefrontHref,
    getActiveStorefrontCategory,
    getStorefrontCategoryFromPath,
    getStorefrontCategoryDescription,
    getStorefrontCategoryLabel,
    type StorefrontCategorySlug,
    storefrontNavigationCategories,
} from "@/lib/categories"
import { getNigerianStateFilterCandidates, NIGERIAN_STATES } from "@/lib/constants/nigerianStates"
import { cn } from "@/lib/utils"

interface ProductGridProps {
    forcedCategory?: StorefrontCategorySlug | null
    salesType?: "retail" | "wholesale"
    title?: string
}

interface ProductRow {
    category: string
    id: string
    image_url: string | null
    merchant_id: string
    name: string
    price: number
    stock_level: number | null
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

function sanitizeSearchTerm(value: string) {
    return value
        .replace(/[^a-zA-Z0-9\s-]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
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

export function ProductGrid({ forcedCategory = null, salesType, title }: ProductGridProps) {
    const pathname = usePathname()
    const router = useRouter()
    const searchParams = useSearchParams()
    const routeCategory = getStorefrontCategoryFromPath(pathname)
    const activeCategory = forcedCategory ?? getActiveStorefrontCategory(pathname, searchParams)
    const categoryFilter = activeCategory
    const searchQuery = searchParams.get("q")?.trim() ?? ""
    const locationFilter = searchParams.get("state")?.trim() ?? "all"
    const hasCanonicalCategoryRoute = Boolean(forcedCategory ?? routeCategory)

    const [products, setProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [retryCount, setRetryCount] = useState(0)

    const [supabase] = useState(() => createPublicStorefrontClient())
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

            if (salesType) {
                query = query.eq("sales_type", salesType)
            }

            if (categoryFilter) {
                query = query.filter("category", "eq", categoryFilter)
            }

            const normalizedSearch = sanitizeSearchTerm(searchQuery)
            if (normalizedSearch) {
                query = query.or(
                    `name.ilike.%${normalizedSearch}%,description.ilike.%${normalizedSearch}%,seo_title.ilike.%${normalizedSearch}%`
                )
            }

            if (locationFilter !== "all") {
                query = query.in("state", getNigerianStateFilterCandidates(locationFilter))
            }

            const { data, error } = await query

            if (!isMountedRef.current || requestId !== requestIdRef.current) return

            if (error) {
                throw error
            }

            if (data) {
                const productRows = data as unknown as ProductRow[]
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

                setProducts(productRows.map((item) => ({
                    id: item.id,
                    name: item.name,
                    price: item.price,
                    imageUrl: item.image_url ?? "",
                    category: item.category,
                    stock: item.stock_level ?? 0,
                    merchantId: item.merchant_id,
                    reviewSummary: reviewSummaryByProduct[item.id] ?? null,
                })))
            }
        } catch (err) {
            if (!isMountedRef.current || requestId !== requestIdRef.current) return

            if (isAbortLikeError(err)) {
                return
            }

            console.error("Error fetching products:", {
                message: getErrorMessage(err),
                error: err,
            })
            setError("Failed to load products. Please try again.")
        } finally {
            if (isMountedRef.current && requestId === requestIdRef.current) {
                setLoading(false)
            }
        }
    }, [categoryFilter, locationFilter, salesType, searchQuery, supabase])

    useEffect(() => {
        isMountedRef.current = true
        fetchProducts()

        return () => {
            isMountedRef.current = false
        }
    }, [fetchProducts, retryCount])

    const hasAnyFilter = Boolean(searchQuery || locationFilter !== "all" || (!hasCanonicalCategoryRoute && categoryFilter))
    const categoryTitle = getStorefrontCategoryLabel(categoryFilter)
    const categoryDescription = getStorefrontCategoryDescription(categoryFilter)
    const searchTitle = searchQuery ? `Search results for "${searchQuery}"` : null
    const displayTitle = searchTitle
        ?? (categoryFilter ? categoryTitle : title)
        ?? (salesType === "wholesale" ? "Wholesale products" : "Fresh products")
    const displaySubtitle = searchQuery
        ? `Showing ${categoryFilter ? `${categoryTitle.toLowerCase()} ` : ""}matches${locationFilter !== "all" ? ` in ${locationFilter}` : ""}.`
        : categoryFilter
            ? categoryDescription
            : salesType === "wholesale"
                ? "Browse bulk-ready listings, organized for fast wholesale ordering."
                : "Browse approved products across fresh, packaged, and specialty categories."

    const clearFiltersHref = createStorefrontHref({
        pathname,
        searchParams,
        patch: {
            category: hasCanonicalCategoryRoute ? undefined : null,
            q: null,
            state: null,
        },
        hash: "product-grid",
    })

    const handleLocationChange = (nextValue: string) => {
        router.push(createStorefrontHref({
            pathname,
            searchParams,
            patch: {
                state: nextValue,
            },
            hash: "product-grid",
        }))
    }

    const activeFilters = [
        searchQuery
            ? {
                key: "q",
                label: `Search: ${searchQuery}`,
            }
            : null,
        categoryFilter && !hasCanonicalCategoryRoute
            ? {
                key: "category",
                label: categoryTitle,
            }
            : null,
        locationFilter !== "all"
            ? {
                key: "state",
                label: locationFilter,
            }
            : null,
    ].filter(Boolean) as Array<{ key: "q" | "category" | "state"; label: string }>

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="mb-4 h-10 w-10 text-red-500" />
                <p className="mb-2 text-lg font-medium text-gray-900 dark:text-gray-100">{error}</p>
                <Button onClick={() => setRetryCount((current) => current + 1)}>Try Again</Button>
            </div>
        )
    }

    return (
        <section className="py-8" id="product-grid">
            <div className="container mx-auto px-4 md:px-8">
                <div className="mb-6 rounded-[28px] border border-gray-100 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#F58220]">
                                {products.length} product{products.length === 1 ? "" : "s"} loaded
                            </p>
                            <h2 className="mt-2 text-2xl font-bold text-[#002603] dark:text-white md:text-3xl">
                                {displayTitle}
                            </h2>
                            <p className="mt-2 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
                                {displaySubtitle}
                            </p>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-950">
                                <Filter className="h-4 w-4 text-gray-500" />
                                <label className="sr-only" htmlFor="product-location-filter">
                                    Filter products by location
                                </label>
                                <select
                                    id="product-location-filter"
                                    value={locationFilter}
                                    onChange={(event) => handleLocationChange(event.target.value)}
                                    className="min-w-[160px] bg-transparent text-sm text-foreground outline-none"
                                >
                                    <option value="all">All locations</option>
                                    {NIGERIAN_STATES.map((state) => (
                                        <option key={state} value={state}>
                                            {state}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {hasAnyFilter ? (
                                <Button variant="outline" asChild className="rounded-full">
                                    <Link href={clearFiltersHref}>Clear all filters</Link>
                                </Button>
                            ) : null}
                        </div>
                    </div>

                    <div className="mt-5 flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                        {storefrontNavigationCategories.map((category) => {
                            const isActive = category.slug === null ? !categoryFilter : categoryFilter === category.slug
                            const href = createStorefrontHref({
                                pathname,
                                searchParams,
                                patch: {
                                    category: category.slug,
                                },
                                hash: "product-grid",
                            })

                            return (
                                <Link
                                    key={category.label}
                                    href={href}
                                    className={cn(
                                        "whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
                                        isActive
                                            ? "border-[#F58220] bg-[#F58220] text-white"
                                            : "border-gray-200 bg-white text-gray-600 hover:border-orange-200 hover:text-[#F58220] dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
                                    )}
                                >
                                    {category.label}
                                </Link>
                            )
                        })}
                    </div>

                    {activeFilters.length > 0 ? (
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                            {activeFilters.map((filter) => (
                                <Link
                                    key={filter.key}
                                    href={createStorefrontHref({
                                        pathname,
                                        searchParams,
                                        patch: {
                                            [filter.key]: null,
                                        },
                                        hash: "product-grid",
                                    })}
                                    className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1.5 text-xs font-semibold text-[#C25F14] dark:bg-orange-950/20 dark:text-orange-200"
                                >
                                    {filter.key === "q" ? <Search className="h-3.5 w-3.5" /> : null}
                                    {filter.key === "state" ? <MapPin className="h-3.5 w-3.5" /> : null}
                                    <span>{filter.label}</span>
                                    <X className="h-3.5 w-3.5" />
                                </Link>
                            ))}
                        </div>
                    ) : null}
                </div>

                {loading ? (
                    <>
                        <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar md:hidden">
                            {[...Array(4)].map((_, index) => (
                                <div key={index} className="flex min-w-[calc(50vw-1.5rem)] snap-start flex-col gap-3">
                                    {[0, 1].map((row) => (
                                        <div key={row} className="space-y-2">
                                            <Skeleton className="h-[120px] w-full rounded-xl" />
                                            <Skeleton className="h-3 w-3/4" />
                                            <Skeleton className="h-3 w-1/2" />
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                        <div className="hidden gap-4 md:grid md:grid-cols-3 lg:grid-cols-4 md:gap-6">
                            {[...Array(8)].map((_, index) => (
                                <div key={index} className="space-y-3">
                                    <Skeleton className="h-[180px] w-full rounded-xl" />
                                    <Skeleton className="h-4 w-3/4" />
                                    <Skeleton className="h-4 w-1/2" />
                                </div>
                            ))}
                        </div>
                    </>
                ) : products.length > 0 ? (
                    <>
                        <div className="md:hidden">
                            <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                                {(() => {
                                    const columns: Product[][] = []
                                    for (let index = 0; index < products.length; index += 2) {
                                        columns.push(products.slice(index, index + 2))
                                    }

                                    return columns.map((pair, columnIndex) => (
                                        <div key={columnIndex} className="flex min-w-[calc(50vw-1.25rem)] max-w-[calc(50vw-1.25rem)] shrink-0 snap-start flex-col gap-3">
                                            {pair.map((product) => (
                                                <ProductCard key={product.id} product={product} />
                                            ))}
                                        </div>
                                    ))
                                })()}
                            </div>
                        </div>
                        <div className="hidden text-left md:grid md:grid-cols-3 md:gap-4 lg:grid-cols-4 md:gap-6">
                            {products.map((product) => (
                                <ProductCard key={product.id} product={product} />
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="rounded-[28px] border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
                        <p className="text-lg font-semibold text-gray-900 dark:text-white">
                            No products matched your current filters.
                        </p>
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                            Try a broader search, switch category, or clear the location filter.
                        </p>
                        <div className="mt-5">
                            <Button asChild className="rounded-full bg-[#F58220] text-white hover:bg-[#E57210]">
                                <Link href={clearFiltersHref}>View all products</Link>
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </section>
    )
}
