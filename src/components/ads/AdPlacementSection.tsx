import { getLiveAdsForPlacement } from "@/lib/adsData"
import type { AdPlacement } from "@/lib/adCampaigns"
import { AdPlacementSectionClient } from "./AdPlacementSectionClient"

interface AdPlacementSectionProps {
    placement: AdPlacement
    title?: string
    description?: string
    limit?: number
}

export async function AdPlacementSection({
    placement,
    title,
    description,
    limit = 3,
}: AdPlacementSectionProps) {
    const campaigns = await getLiveAdsForPlacement(placement, limit)

    if (campaigns.length === 0) {
        return null
    }

    return (
        <AdPlacementSectionClient
            campaigns={campaigns}
            placement={placement}
            title={title}
            description={description}
        />
    )
}
