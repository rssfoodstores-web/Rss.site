"use client"

import { useEffect, useState, type ReactNode } from 'react'
import { createPublicStorefrontClient } from '@/lib/supabase/client'
import type { PromotionCampaign, PromotionPlacement as Placement } from '@/lib/promotionMedia'
import { PromotionAsset } from './PromotionAsset'

export function PromotionPlacement({ placement, fallback = null }: { placement: Placement; fallback?: ReactNode }) {
    const [campaigns, setCampaigns] = useState<PromotionCampaign[]>([])
    useEffect(() => {
        const supabase = createPublicStorefrontClient()
        let active = true
        const refresh = async () => {
            const { data, error } = await supabase.rpc('live_promotion_campaigns')
            if (active && !error) setCampaigns((data ?? []) as PromotionCampaign[])
        }
        void refresh()
        const timer = window.setInterval(() => { if (!document.hidden) void refresh() }, 20000)
        window.addEventListener('focus', refresh)
        return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', refresh) }
    }, [])
    const entries = campaigns.flatMap(campaign => campaign.media.filter(asset => asset.placements.includes(placement))
        .map(asset => ({ asset, campaign }))).slice(0, 3)
    if (!entries.length) return fallback
    return <section aria-label="Promotions" className="w-full min-w-0 space-y-3">
        {entries.map(({ asset, campaign }) => <PromotionAsset key={`${campaign.id}-${asset.id}`} asset={asset} href={`/promotions/${campaign.id}`} />)}
    </section>
}
