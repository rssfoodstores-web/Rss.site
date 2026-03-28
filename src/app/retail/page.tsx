import { HeroSection } from "@/components/home/HeroSection"
import { FeatureHighlights } from "@/components/home/FeatureHighlights"
import { ProductGrid } from "@/components/home/ProductGrid"
import { AdPlacementSection } from "@/components/ads/AdPlacementSection"

export default function RetailPage() {
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
