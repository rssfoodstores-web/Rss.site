import { DiscountBundlesPageClient } from "./DiscountBundlesPageClient"
import { getDiscountBundlesPageData } from "./data"

export const dynamic = "force-dynamic"

export default async function DiscountBundlesPage() {
    const data = await getDiscountBundlesPageData()

    return <DiscountBundlesPageClient bundles={data.bundles} pageContent={data.pageContent} />
}
