import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { HeroSection } from "@/components/home/HeroSection"
import { ProductGrid } from "@/components/home/ProductGrid"
import { AdPlacementSection } from "@/components/ads/AdPlacementSection"
import { isStorefrontCategorySlug } from "@/lib/categories"
import {
    buildSeoMetadata,
    buildStorefrontCategoryPath,
} from "@/lib/seo"

interface WholesalePageProps {
    searchParams: Promise<Record<string, string | string[] | undefined>>
}

function getFirstSearchParam(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0]?.trim() ?? "" : value?.trim() ?? ""
}

export async function generateMetadata({
    searchParams,
}: WholesalePageProps): Promise<Metadata> {
    const resolvedSearchParams = await searchParams
    const searchQuery = getFirstSearchParam(resolvedSearchParams.q)
    const state = getFirstSearchParam(resolvedSearchParams.state)
    const sort = getFirstSearchParam(resolvedSearchParams.sort)

    return buildSeoMetadata({
        canonicalPath: "/wholesale",
        description: "Explore wholesale food listings, bulk grocery offers, and trade-ready pantry essentials on RSS Foods.",
        index: !(searchQuery || state || sort),
        keywords: ["wholesale food Nigeria", "bulk groceries", "trade pantry supplies", "RSS Foods wholesale"],
        path: "/wholesale",
        title: "RSS Wholesale",
    })
}

export default async function WholesalePage({
    searchParams,
}: WholesalePageProps) {
    const resolvedSearchParams = await searchParams
    const category = getFirstSearchParam(resolvedSearchParams.category).toLowerCase()
    const searchQuery = getFirstSearchParam(resolvedSearchParams.q)
    const state = getFirstSearchParam(resolvedSearchParams.state)
    const sort = getFirstSearchParam(resolvedSearchParams.sort)

    if (isStorefrontCategorySlug(category) && !searchQuery && !state && !sort) {
        redirect(buildStorefrontCategoryPath("wholesale", category))
    }

    return (
        <div className="flex flex-col gap-6">
            <HeroSection />
            <ProductGrid salesType="wholesale" title="Wholesale Deals" />
            <AdPlacementSection
                placement="wholesale_inline"
                title="Wholesale campaigns"
                description="Sponsored offers and trade campaigns for bulk buyers."
            />
        </div>
    )
}
