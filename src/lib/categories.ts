import {
    Beef,
    CookingPot,
    Droplets,
    Home,
    type LucideIcon,
    Package,
    Sparkles,
    Sprout,
    Wheat,
} from "lucide-react"

export type StorefrontCategorySlug =
    | "fresh_produce"
    | "tubers"
    | "grains"
    | "oils"
    | "spices"
    | "proteins"
    | "packaged"
    | "specialty"

export interface StorefrontCategory {
    description: string
    icon: LucideIcon
    label: string
    slug: StorefrontCategorySlug
}

interface StorefrontCategoryNavItem {
    description: string
    icon: LucideIcon
    label: string
    slug: StorefrontCategorySlug | null
}

type SearchParamsLike = URLSearchParams | { toString(): string } | null | undefined

const STOREFRONT_PATHS = ["/", "/retail", "/wholesale"] as const
const STOREFRONT_CATEGORY_ROUTE_PATTERN = /^\/(retail|wholesale)\/category\/([^/?#]+)$/i

export const storefrontCategories: StorefrontCategory[] = [
    {
        slug: "fresh_produce",
        label: "Fresh Produce",
        description: "Vegetables, fruits, dairy, and daily fresh picks.",
        icon: Sprout,
    },
    {
        slug: "tubers",
        label: "Tubers & Flours",
        description: "Yam, cassava, semo, garri, and staple flour essentials.",
        icon: Wheat,
    },
    {
        slug: "grains",
        label: "Grains & Cereals",
        description: "Rice, beans, maize, oats, and pantry staples.",
        icon: Wheat,
    },
    {
        slug: "oils",
        label: "Oils & Essentials",
        description: "Cooking oils, fats, and everyday kitchen basics.",
        icon: Droplets,
    },
    {
        slug: "spices",
        label: "Spices & Condiments",
        description: "Pepper, curry, thyme, seasonings, and local condiments.",
        icon: CookingPot,
    },
    {
        slug: "proteins",
        label: "Meat & Frozen",
        description: "Fresh proteins, seafood, and cold-chain items.",
        icon: Beef,
    },
    {
        slug: "packaged",
        label: "Packaged Foods",
        description: "Noodles, cereals, snacks, drinks, and shelf-stable goods.",
        icon: Package,
    },
    {
        slug: "specialty",
        label: "Specialty Picks",
        description: "Traditional foods, premium items, and curated collections.",
        icon: Sparkles,
    },
]

export const storefrontNavigationCategories: StorefrontCategoryNavItem[] = [
    {
        slug: null,
        label: "All Products",
        description: "Browse every category available on this page.",
        icon: Home,
    },
    ...storefrontCategories,
]

export function isStorefrontPath(pathname: string | null | undefined): pathname is (typeof STOREFRONT_PATHS)[number] {
    return STOREFRONT_PATHS.includes((pathname ?? "/retail") as (typeof STOREFRONT_PATHS)[number])
        || STOREFRONT_CATEGORY_ROUTE_PATTERN.test(pathname ?? "")
}

export function isStorefrontCategorySlug(value: string | null | undefined): value is StorefrontCategorySlug {
    return storefrontCategories.some((category) => category.slug === value)
}

export function getStorefrontSalesType(pathname: string | null | undefined): "retail" | "wholesale" {
    return pathname?.startsWith("/wholesale") ? "wholesale" : "retail"
}

export function getStorefrontCategoryFromPath(pathname: string | null | undefined) {
    const match = pathname?.match(STOREFRONT_CATEGORY_ROUTE_PATTERN)
    const category = match?.[2]?.toLowerCase()

    return isStorefrontCategorySlug(category) ? category : null
}

export function getActiveStorefrontCategory(pathname: string | null | undefined, searchParams?: SearchParamsLike) {
    const routeCategory = getStorefrontCategoryFromPath(pathname)

    if (routeCategory) {
        return routeCategory
    }

    const params = new URLSearchParams(searchParams?.toString() ?? "")
    const queryCategory = params.get("category")?.trim().toLowerCase()

    return isStorefrontCategorySlug(queryCategory) ? queryCategory : null
}

export function buildStorefrontCategoryPath(salesType: "retail" | "wholesale", category: StorefrontCategorySlug) {
    return `/${salesType}/category/${category}`
}

export function getStorefrontBasePath(pathname: string | null | undefined) {
    const currentCategoryPath = getStorefrontCategoryFromPath(pathname)

    if (currentCategoryPath) {
        return pathname as string
    }

    if (pathname === "/wholesale") {
        return "/wholesale"
    }

    if (pathname === "/" || pathname === "/retail") {
        return pathname
    }

    return "/retail"
}

export function createStorefrontHref({
    pathname,
    searchParams,
    patch,
    hash,
}: {
    pathname: string | null | undefined
    searchParams?: SearchParamsLike
    patch: Record<string, string | null | undefined>
    hash?: string
}) {
    const params = new URLSearchParams(searchParams?.toString() ?? "")
    const routeCategory = getStorefrontCategoryFromPath(pathname)
    const currentCategory = routeCategory ?? getActiveStorefrontCategory(pathname, searchParams)
    const baseSalesType = getStorefrontSalesType(pathname)
    let nextPathname = getStorefrontBasePath(pathname)

    for (const [key, rawValue] of Object.entries(patch)) {
        if (key === "category") {
            continue
        }

        const value = rawValue?.trim()

        if (!value || value === "all") {
            params.delete(key)
            continue
        }

        params.set(key, value)
    }

    const rawNextCategory = patch.category?.trim().toLowerCase()
    const nextCategory =
        rawNextCategory === undefined
            ? currentCategory
            : isStorefrontCategorySlug(rawNextCategory)
                ? rawNextCategory
                : null

    if (nextCategory) {
        nextPathname = buildStorefrontCategoryPath(baseSalesType, nextCategory)
        params.delete("category")
    } else if (routeCategory) {
        nextPathname = baseSalesType === "wholesale" ? "/wholesale" : "/retail"
    } else {
        params.delete("category")
    }

    const query = params.toString()
    return `${nextPathname}${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`
}

export function getStorefrontCategoryLabel(slug: string | null | undefined) {
    if (!slug) {
        return "All Products"
    }

    return storefrontCategories.find((category) => category.slug === slug)?.label
        ?? slug
            .split("_")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ")
}

export function getStorefrontCategoryDescription(slug: string | null | undefined) {
    if (!slug) {
        return "Browse every available product currently listed."
    }

    return storefrontCategories.find((category) => category.slug === slug)?.description
        ?? "Browse products in this category."
}
