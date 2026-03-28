import { HeroSection } from "@/components/home/HeroSection"
import { FeatureHighlights } from "@/components/home/FeatureHighlights"
import { ProductGrid } from "@/components/home/ProductGrid"
import { AdPlacementSection } from "@/components/ads/AdPlacementSection"

export default function Home() {
  return (
    <div className="flex flex-col gap-6">
      <HeroSection />
      <FeatureHighlights />
      <AdPlacementSection
        placement="home_inline"
        title="Featured campaigns"
        description="Sponsored campaigns running across the storefront right now."
      />
      <ProductGrid />
    </div>
  )
}
