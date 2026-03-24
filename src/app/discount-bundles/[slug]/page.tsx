import { notFound } from "next/navigation"
import { DiscountBundleDetailClient } from "./DiscountBundleDetailClient"
import { getDiscountBundleDetail } from "../data"

export const dynamic = "force-dynamic"

export default async function DiscountBundleDetailPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const data = await getDiscountBundleDetail(slug)

    if (!data) {
        notFound()
    }

    return <DiscountBundleDetailClient bundle={data.bundle} relatedBundles={data.relatedBundles} />
}
