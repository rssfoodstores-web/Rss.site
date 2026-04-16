import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { HeroSection } from "@/components/home/HeroSection"
import { FeatureHighlights } from "@/components/home/FeatureHighlights"
import { ProductGrid } from "@/components/home/ProductGrid"
import { AdPlacementSection } from "@/components/ads/AdPlacementSection"
import { isStorefrontCategorySlug } from "@/lib/categories"
import {
    buildSeoMetadata,
    buildStorefrontCategoryPath,
} from "@/lib/seo"

interface RetailPageProps {
    searchParams: Promise<Record<string, string | string[] | undefined>>
}

function getFirstSearchParam(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0]?.trim() ?? "" : value?.trim() ?? ""
}

export async function generateMetadata({
    searchParams,
}: RetailPageProps): Promise<Metadata> {
    const resolvedSearchParams = await searchParams
    const searchQuery = getFirstSearchParam(resolvedSearchParams.q)
    const state = getFirstSearchParam(resolvedSearchParams.state)

    return buildSeoMetadata({
        canonicalPath: "/retail",
        description: "Browse retail groceries, pantry staples, packaged foods, and fresh essentials from RSS Foods.",
        index: !(searchQuery || state),
        keywords: ["retail groceries", "buy food online Nigeria", "pantry staples", "RSS Foods retail"],
        path: "/retail",
        title: "RSS Retail",
    })
}

export default async function RetailPage({
    searchParams,
}: RetailPageProps) {
    const resolvedSearchParams = await searchParams
    const category = getFirstSearchParam(resolvedSearchParams.category).toLowerCase()
    const searchQuery = getFirstSearchParam(resolvedSearchParams.q)
    const state = getFirstSearchParam(resolvedSearchParams.state)

    if (isStorefrontCategorySlug(category) && !searchQuery && !state) {
        redirect(buildStorefrontCategoryPath("retail", category))
    }

    return (
        <div className="flex flex-col gap-6">
            <HeroSection />
            <FeatureHighlights />
            <AdPlacementSection
                placement="retail_inline"
                title="Retail campaigns"
                description="Sponsored promotions tuned for everyday shoppers."
            />
            <ProductGrid salesType="retail" title="Popular Retail Products" />
        </div>
    )
}
