import { DiscountBundlesPageClient } from "./DiscountBundlesPageClient"
import { getDiscountBundlesPageData } from "./data"
import { AdPlacementSection } from "@/components/ads/AdPlacementSection"

export const dynamic = "force-dynamic"

export default async function DiscountBundlesPage() {
    const data = await getDiscountBundlesPageData()

    return (
        <div className="flex flex-col gap-6">
            <AdPlacementSection
                placement="discount_bundles_inline"
                title="Bundle campaigns"
                description="Sponsored placements can promote featured bundles, offers, or landing pages."
            />
            <DiscountBundlesPageClient bundles={data.bundles} pageContent={data.pageContent} />
        </div>
    )
}
