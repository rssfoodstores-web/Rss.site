import "server-only"

import { unstable_noStore as noStore } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import type { AdPlacement, AdMediaType, LiveAdCampaign } from "@/lib/adCampaigns"

export async function getLiveAdsForPlacement(
    placement: AdPlacement,
    limit = 3
): Promise<LiveAdCampaign[]> {
    noStore()

    const supabase = await createClient()
    const { data, error } = await supabase
        .from("ads")
        .select("id, title, body, media_url, media_type, placement, click_url, cta_label, campaign_starts_at, campaign_ends_at")
        .eq("placement", placement)
        .eq("is_active", true)
        .order("sort_order", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(12)

    if (error) {
        console.error(`Unable to load ads for placement ${placement}:`, error)
        return []
    }

    const now = Date.now()

    return (data ?? [])
        .filter((row) => {
            const startsAt = row.campaign_starts_at ? new Date(row.campaign_starts_at).getTime() : null
            const endsAt = row.campaign_ends_at ? new Date(row.campaign_ends_at).getTime() : null

            return (startsAt === null || startsAt <= now) && (endsAt === null || endsAt >= now)
        })
        .slice(0, limit)
        .map((row) => ({
        id: row.id,
        title: row.title,
        body: row.body ?? null,
        mediaUrl: row.media_url,
        mediaType: row.media_type as AdMediaType,
        placement: row.placement as AdPlacement,
        clickUrl: row.click_url,
        ctaLabel: row.cta_label,
    }))
}
