import { HeroSection } from "@/components/home/HeroSection"
import { FeatureHighlights } from "@/components/home/FeatureHighlights"
import { ProductGrid } from "@/components/home/ProductGrid"
import { AdPlacementSection } from "@/components/ads/AdPlacementSection"

export default function WholesalePage() {
    return (
        <div className="flex flex-col gap-6">
            <HeroSection />
            <FeatureHighlights />
            <AdPlacementSection
                placement="wholesale_inline"
                title="Wholesale campaigns"
                description="Sponsored offers and trade campaigns for bulk buyers."
            />
            <ProductGrid salesType="wholesale" title="Wholesale Deals" />
        </div>
    )
}
