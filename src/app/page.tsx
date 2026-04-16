import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { HeroSection } from "@/components/home/HeroSection"
import { FeatureHighlights } from "@/components/home/FeatureHighlights"
import { ProductGrid } from "@/components/home/ProductGrid"
import { AdPlacementSection } from "@/components/ads/AdPlacementSection"
import { StructuredData } from "@/components/seo/StructuredData"
import { isStorefrontCategorySlug } from "@/lib/categories"
import {
  buildSeoMetadata,
  buildStorefrontCategoryPath,
  createOrganizationJsonLd,
  createWebSiteJsonLd,
} from "@/lib/seo"

interface StorefrontPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function getFirstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0]?.trim() ?? "" : value?.trim() ?? ""
}

export async function generateMetadata({
  searchParams,
}: StorefrontPageProps): Promise<Metadata> {
  const resolvedSearchParams = await searchParams
  const searchQuery = getFirstSearchParam(resolvedSearchParams.q)
  const state = getFirstSearchParam(resolvedSearchParams.state)

  return buildSeoMetadata({
    canonicalPath: "/",
    description: "Shop fresh groceries, grains, staples, and pantry essentials on RSS Foods with fast delivery across Nigeria.",
    index: !(searchQuery || state),
    keywords: ["groceries Nigeria", "online food marketplace", "fresh groceries", "RSS Foods"],
    path: "/",
    title: "Fresh Groceries Delivered",
  })
}

export default async function Home({
  searchParams,
}: StorefrontPageProps) {
  const resolvedSearchParams = await searchParams
  const category = getFirstSearchParam(resolvedSearchParams.category).toLowerCase()
  const searchQuery = getFirstSearchParam(resolvedSearchParams.q)
  const state = getFirstSearchParam(resolvedSearchParams.state)

  if (isStorefrontCategorySlug(category) && !searchQuery && !state) {
    redirect(buildStorefrontCategoryPath("retail", category))
  }

  return (
    <div className="flex flex-col gap-6">
      <StructuredData data={[createOrganizationJsonLd(), createWebSiteJsonLd()]} />
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
