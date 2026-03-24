import { HeroSection } from "@/components/home/HeroSection"
import { FeatureHighlights } from "@/components/home/FeatureHighlights"
import { CategoryGrid } from "@/components/home/CategoryGrid"
import { ProductGrid } from "@/components/home/ProductGrid"

export default function RetailPage() {
    return (
        <div className="flex flex-col gap-6">
            <HeroSection />
            <FeatureHighlights />
            <CategoryGrid />
            <ProductGrid salesType="retail" title="Popular Retail Products" />
        </div>
    )
}
