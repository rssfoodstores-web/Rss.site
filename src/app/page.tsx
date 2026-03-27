import { HeroSection } from "@/components/home/HeroSection"
import { FeatureHighlights } from "@/components/home/FeatureHighlights"
import { ProductGrid } from "@/components/home/ProductGrid"

export default function Home() {
  return (
    <div className="flex flex-col gap-6">
      <HeroSection />
      <FeatureHighlights />
      <ProductGrid />
    </div>
  )
}
