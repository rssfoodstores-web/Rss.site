import { AdPlacementSection } from "@/components/ads/AdPlacementSection"
import { FeatureHighlights } from "@/components/home/FeatureHighlights"
import { HeroSection } from "@/components/home/HeroSection"
import { ProductGrid } from "@/components/home/ProductGrid"
import {
    getStorefrontCategoryLabel,
    type StorefrontCategorySlug,
} from "@/lib/categories"

interface StorefrontCategoryPageProps {
    category: StorefrontCategorySlug
    salesType: "retail" | "wholesale"
}

export function StorefrontCategoryPage({
    category,
    salesType,
}: StorefrontCategoryPageProps) {
    const categoryLabel = getStorefrontCategoryLabel(category)
    const placement = salesType === "wholesale" ? "wholesale_inline" : "retail_inline"
    const audienceLabel = salesType === "wholesale" ? "trade buyers" : "everyday shoppers"

    return (
        <div className="flex flex-col gap-6">
            <HeroSection />
            <FeatureHighlights />
            <AdPlacementSection
                placement={placement}
                title={`${categoryLabel} campaigns`}
                description={`Sponsored offers and placements curated for ${audienceLabel} browsing ${categoryLabel.toLowerCase()}.`}
            />
            <ProductGrid
                forcedCategory={category}
                salesType={salesType}
                title={categoryLabel}
            />
        </div>
    )
}
