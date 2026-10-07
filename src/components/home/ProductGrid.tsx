"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { createPublicStorefrontClient } from "@/lib/supabase/client"
import { ProductCard, type Product } from "@/components/home/ProductCard"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle, ChevronLeft, ChevronRight, Filter, MapPin, Search, X } from "lucide-react"
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

const PRODUCTS_PER_PAGE = 20
const PRODUCT_SORT_OPTIONS = ["newest", "price_asc", "price_desc"] as const
type ProductSortOption = (typeof PRODUCT_SORT_OPTIONS)[number]

function getProductSortOption(value: string | null): ProductSortOption {
    return PRODUCT_SORT_OPTIONS.find((option) => option === value) ?? "newest"
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

function getPageFromSearchParams(searchParams: { get(name: string): string | null }) {
    const rawPage = Number.parseInt(searchParams.get("page") ?? "1", 10)

    return Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1
}

function getVisiblePaginationItems(currentPage: number, totalPages: number) {
    const pages = new Set<number>([1, totalPages])

    for (let page = currentPage - 1; page <= currentPage + 1; page += 1) {
        if (page > 1 && page < totalPages) {
            pages.add(page)
        }
    }

    const orderedPages = Array.from(pages).sort((a, b) => a - b)
    const items: Array<number | "ellipsis"> = []

    orderedPages.forEach((page, index) => {
        const previousPage = orderedPages[index - 1]

        if (previousPage && page - previousPage > 1) {
            items.push("ellipsis")
        }

        items.push(page)
    })

    return items
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
    const sortOption = getProductSortOption(searchParams.get("sort"))
    const currentPage = getPageFromSearchParams(searchParams)
    const hasCanonicalCategoryRoute = Boolean(forcedCategory ?? routeCategory)

    const [products, setProducts] = useState<Product[]>([])
    const [totalProducts, setTotalProducts] = useState(0)
    const [loading, setLoading] = useState(true)
    const [hasLoadedProducts, setHasLoadedProducts] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [retryCount, setRetryCount] = useState(0)
    const [searchInput, setSearchInput] = useState(searchQuery)

    const [supabase] = useState(() => createPublicStorefrontClient())
    const requestIdRef = useRef(0)
    const isMountedRef = useRef(false)

    useEffect(() => {
        setSearchInput(searchQuery)
    }, [searchQuery])

    const fetchProducts = useCallback(async () => {
        const requestId = ++requestIdRef.current

        try {
            setLoading(true)
            setError(null)

            let query = supabase
                .from("products")
                .select("*", { count: "exact" })
                .eq("status", "approved")
                .not("active_pricing_id", "is", null)

            if (sortOption === "price_asc") {
                query = query.order("price", { ascending: true })
            } else if (sortOption === "price_desc") {
                query = query.order("price", { ascending: false })
            } else {
                query = query.order("created_at", { ascending: false })
            }

            query = query.range((currentPage - 1) * PRODUCTS_PER_PAGE, currentPage * PRODUCTS_PER_PAGE - 1)

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

            const { data, error, count } = await query

            if (!isMountedRef.current || requestId !== requestIdRef.current) return

            if (error) {
                throw error
            }

            const nextTotalProducts = count ?? 0
            const nextTotalPages = Math.max(1, Math.ceil(nextTotalProducts / PRODUCTS_PER_PAGE))

            if (nextTotalProducts > 0 && currentPage > nextTotalPages) {
                router.replace(createStorefrontHref({
                    pathname,
                    searchParams,
                    patch: {
                        page: nextTotalPages === 1 ? null : String(nextTotalPages),
                    },
                }), { scroll: false })
                return
            }

            setTotalProducts(nextTotalProducts)

            if (data) {
                const productRows = data as unknown as ProductRow[]
                const productIds = productRows.map((item) => item.id)

                setProducts(productRows.map((item) => ({
                    id: item.id,
                    name: item.name,
                    price: item.price,
                    imageUrl: item.image_url ?? "",
                    category: item.category,
                    stock: item.stock_level ?? 0,
                    merchantId: item.merchant_id,
                    reviewSummary: null,
                })))
                setHasLoadedProducts(true)
                setLoading(false)

                if (productIds.length > 0) {
                    void Promise.resolve(supabase
                        .from("product_reviews")
                        .select("product_id, rating, comment, created_at, customer:customer_id(full_name)")
                        .in("product_id", productIds)
                        .order("created_at", { ascending: false })
                    ).then(({ data: reviewData, error: reviewError }) => {
                            if (!isMountedRef.current || requestId !== requestIdRef.current) return

                            if (reviewError) {
                                console.error("Error fetching product reviews:", reviewError)
                                return
                            }

                            const reviewSummaryByProduct = groupProductReviewsByProduct(
                                (reviewData ?? []) as ProductReviewQueryRow[]
                            )
                            setProducts((currentProducts) => currentProducts.map((product) => ({
                                ...product,
                                reviewSummary: reviewSummaryByProduct[product.id] ?? null,
                            })))
                    }).catch((reviewFetchError: unknown) => {
                            console.error("Error fetching product reviews:", reviewFetchError)
                        })
                }
            } else {
                setProducts([])
                setHasLoadedProducts(true)
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
    }, [categoryFilter, currentPage, locationFilter, pathname, router, salesType, searchParams, searchQuery, sortOption, supabase])

    useEffect(() => {
        isMountedRef.current = true
        fetchProducts()

        return () => {
            isMountedRef.current = false
        }
    }, [fetchProducts, retryCount])

    const hasAnyFilter = Boolean(searchQuery || locationFilter !== "all" || sortOption !== "newest" || (!hasCanonicalCategoryRoute && categoryFilter))
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
    const totalPages = Math.max(1, Math.ceil(totalProducts / PRODUCTS_PER_PAGE))
    const firstVisibleProduct = products.length > 0 ? (currentPage - 1) * PRODUCTS_PER_PAGE + 1 : 0
    const lastVisibleProduct = products.length > 0 ? firstVisibleProduct + products.length - 1 : 0
    const paginationItems = getVisiblePaginationItems(currentPage, totalPages)

    const clearFiltersHref = createStorefrontHref({
        pathname,
        searchParams,
        patch: {
            category: hasCanonicalCategoryRoute ? undefined : null,
            q: null,
            state: null,
            sort: null,
            page: null,
        },
    })

    const applySearch = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        router.push(createStorefrontHref({
            pathname,
            searchParams,
            patch: {
                q: searchInput.trim() || null,
                page: null,
            },
        }), { scroll: false })
    }

    const handleLocationChange = (nextValue: string) => {
        router.push(createStorefrontHref({
            pathname,
            searchParams,
            patch: {
                state: nextValue,
                page: null,
            },
        }), { scroll: false })
    }

    const handleSortChange = (nextValue: ProductSortOption) => {
        router.push(createStorefrontHref({
            pathname,
            searchParams,
            patch: {
                sort: nextValue === "newest" ? null : nextValue,
                page: null,
            },
        }), { scroll: false })
    }

    const createPaginationHref = (page: number) => createStorefrontHref({
        pathname,
        searchParams,
        patch: {
            page: page <= 1 ? null : String(page),
        },
    })

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
        sortOption !== "newest"
            ? {
                key: "sort",
                label: sortOption === "price_asc" ? "Price: low to high" : "Price: high to low",
            }
            : null,
    ].filter(Boolean) as Array<{ key: "q" | "category" | "state" | "sort"; label: string }>

    if (error && (!hasLoadedProducts || products.length === 0)) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="mb-4 h-10 w-10 text-red-500" />
                <p className="mb-2 text-lg font-medium text-gray-900 dark:text-gray-100">{error}</p>
                <Button onClick={() => setRetryCount((current) => current + 1)}>Try Again</Button>
            </div>
        )
    }

    return (
        <section className="scroll-mt-24 py-8 md:py-12" id="product-grid" aria-busy={loading}>
            <div className="container mx-auto px-4 md:px-8">
                <div className="mb-6 overflow-hidden rounded-3xl border border-gray-200/80 bg-white shadow-sm shadow-gray-900/[0.03] dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex flex-col gap-5 p-5 md:p-7 lg:flex-row lg:items-end lg:justify-between">
                        <div className="min-w-0">
                            <p aria-live="polite" className="text-xs font-bold uppercase tracking-[0.18em] text-[#F58220]">
                                {loading && !hasLoadedProducts
                                    ? "Finding your next favourite"
                                    : loading
                                        ? "Updating results"
                                        : totalProducts > 0
                                            ? `${firstVisibleProduct}–${lastVisibleProduct} of ${totalProducts} products`
                                            : "No products found"}
                            </p>
                            <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#002603] dark:text-white md:text-3xl">
                                {displayTitle}
                            </h2>
                            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                                {displaySubtitle}
                            </p>
                        </div>

                        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
                            <label className="flex min-h-11 min-w-0 items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 dark:border-zinc-700 dark:bg-zinc-950 sm:min-w-[190px]">
                                <Filter className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
                                <span className="sr-only">Filter products by location</span>
                                <select
                                    id="product-location-filter"
                                    value={locationFilter}
                                    onChange={(event) => handleLocationChange(event.target.value)}
                                    className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none"
                                >
                                    <option value="all">All locations</option>
                                    {NIGERIAN_STATES.map((state) => (
                                        <option key={state} value={state}>{state}</option>
                                    ))}
                                </select>
                            </label>

                            <label className="flex min-h-11 min-w-0 items-center rounded-xl border border-gray-200 bg-gray-50 px-3 dark:border-zinc-700 dark:bg-zinc-950 sm:min-w-[190px]">
                                <span className="sr-only">Sort products</span>
                                <select
                                    aria-label="Sort products"
                                    value={sortOption}
                                    onChange={(event) => handleSortChange(getProductSortOption(event.target.value))}
                                    className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none"
                                >
                                    <option value="newest">Sort: newest</option>
                                    <option value="price_asc">Price: low to high</option>
                                    <option value="price_desc">Price: high to low</option>
                                </select>
                            </label>

                            {hasAnyFilter ? (
                                <Button variant="outline" asChild className="col-span-2 min-h-11 rounded-xl sm:col-span-1">
                                    <Link href={clearFiltersHref} scroll={false}>Clear filters</Link>
                                </Button>
                            ) : null}
                        </div>
                    </div>

                    <form onSubmit={applySearch} className="px-5 pb-5 md:px-7 md:pb-6">
                        <label htmlFor="product-search" className="sr-only">Search products</label>
                        <div className="flex min-h-12 gap-2 rounded-2xl border border-gray-200 bg-gray-50 p-1.5 pl-3 focus-within:border-[#F58220] focus-within:ring-2 focus-within:ring-orange-500/15 dark:border-zinc-700 dark:bg-zinc-950">
                            <Search className="my-auto h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                            <input
                                id="product-search"
                                type="search"
                                value={searchInput}
                                onChange={(event) => setSearchInput(event.target.value)}
                                placeholder="Search rice, tomatoes, and more"
                                className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-gray-400"
                            />
                            <Button type="submit" className="min-h-10 rounded-xl bg-[#F58220] px-4 text-white hover:bg-[#E57210]">
                                Search
                            </Button>
                        </div>
                    </form>

                    <div className="border-t border-gray-100 px-5 py-4 dark:border-zinc-800 md:px-7">
                        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">Browse categories</p>
                        <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {storefrontNavigationCategories.map((category) => {
                            const isActive = category.slug === null ? !categoryFilter : categoryFilter === category.slug
                            const href = createStorefrontHref({
                                pathname,
                                searchParams,
                                patch: {
                                    category: category.slug,
                                    page: null,
                                },
                            })

                            return (
                                <Link
                                    key={category.label}
                                    href={href}
                                    scroll={false}
                                    aria-current={isActive ? "page" : undefined}
                                    className={cn(
                                        "min-h-11 shrink-0 snap-start whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F58220] focus-visible:ring-offset-2",
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
                                            page: null,
                                        },
                                    })}
                                    scroll={false}
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

                {error && hasLoadedProducts ? (
                    <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                        <span>{error} Showing the last results we loaded.</span>
                        <Button variant="outline" size="sm" onClick={() => setRetryCount((current) => current + 1)} className="min-h-10 rounded-xl border-amber-300 bg-white dark:bg-zinc-900">
                            Try again
                        </Button>
                    </div>
                ) : null}

                {loading && (!hasLoadedProducts || products.length === 0) ? (
                    <>
                        <div className="grid grid-cols-2 gap-3 md:hidden" aria-label="Loading products">
                            {[...Array(6)].map((_, index) => (
                                <div key={index} className="overflow-hidden rounded-2xl border border-gray-100 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
                                    <Skeleton className="aspect-[5/4] w-full rounded-xl" />
                                    <Skeleton className="mt-3 h-3 w-2/5" />
                                    <Skeleton className="mt-2 h-4 w-4/5" />
                                    <Skeleton className="mt-4 h-5 w-1/2" />
                                </div>
                            ))}
                        </div>
                        <div className="hidden gap-4 md:grid md:grid-cols-3 lg:grid-cols-4 md:gap-6" aria-label="Loading products">
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
                        <div className={cn("grid grid-cols-2 gap-3 transition-opacity duration-200 md:hidden", loading && "opacity-60")}>
                            {products.map((product) => (
                                <ProductCard key={product.id} product={product} />
                            ))}
                        </div>
                        <div className={cn("hidden text-left transition-opacity duration-200 md:grid md:grid-cols-3 md:gap-4 lg:grid-cols-4 md:gap-6", loading && "opacity-60")}>
                            {products.map((product) => (
                                <ProductCard key={product.id} product={product} />
                            ))}
                        </div>
                        {totalPages > 1 ? (
                            <nav
                                aria-label="Product pages"
                                className="mt-8 flex flex-col items-center justify-between gap-4 rounded-[28px] border border-gray-100 bg-white px-4 py-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row"
                            >
                                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                                    Showing {firstVisibleProduct}-{lastVisibleProduct} of {totalProducts} products
                                </p>

                                <div className="flex flex-wrap items-center justify-center gap-2">
                                    {currentPage > 1 ? (
                                        <Button asChild variant="outline" size="sm" className="rounded-full">
                                            <Link href={createPaginationHref(currentPage - 1)} scroll={false} aria-label="Go to previous product page">
                                                <ChevronLeft className="mr-1 h-4 w-4" />
                                                Previous
                                            </Link>
                                        </Button>
                                    ) : (
                                        <Button variant="outline" size="sm" className="rounded-full" disabled>
                                            <ChevronLeft className="mr-1 h-4 w-4" />
                                            Previous
                                        </Button>
                                    )}

                                    {paginationItems.map((item, index) => item === "ellipsis" ? (
                                        <span
                                            key={`ellipsis-${index}`}
                                            className="flex h-9 min-w-9 items-center justify-center rounded-full px-2 text-sm font-semibold text-gray-400"
                                        >
                                            ...
                                        </span>
                                    ) : (
                                        <Button
                                            key={item}
                                            asChild={item !== currentPage}
                                            variant={item === currentPage ? "default" : "outline"}
                                            size="sm"
                                            className={cn(
                                                "h-9 min-w-9 rounded-full px-3",
                                                item === currentPage
                                                    ? "bg-[#F58220] text-white hover:bg-[#E57210]"
                                                    : "border-gray-200 bg-white text-gray-700 hover:border-orange-200 hover:text-[#F58220] dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
                                            )}
                                            disabled={item === currentPage}
                                        >
                                            {item === currentPage ? (
                                                <span aria-current="page">{item}</span>
                                            ) : (
                                                <Link href={createPaginationHref(item)} scroll={false} aria-label={`Go to product page ${item}`}>
                                                    {item}
                                                </Link>
                                            )}
                                        </Button>
                                    ))}

                                    {currentPage < totalPages ? (
                                        <Button asChild variant="outline" size="sm" className="rounded-full">
                                            <Link href={createPaginationHref(currentPage + 1)} scroll={false} aria-label="Go to next product page">
                                                Next
                                                <ChevronRight className="ml-1 h-4 w-4" />
                                            </Link>
                                        </Button>
                                    ) : (
                                        <Button variant="outline" size="sm" className="rounded-full" disabled>
                                            Next
                                            <ChevronRight className="ml-1 h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </nav>
                        ) : null}
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
