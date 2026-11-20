"use client"

import { type ReactNode } from 'react'
import type { PromotionPlacement as Placement } from '@/lib/promotionMedia'
import { useLivePromotions } from '@/hooks/useLivePromotions'
import { PromotionAsset } from './PromotionAsset'

export function PromotionPlacement({ placement, fallback = null }: { placement: Placement; fallback?: ReactNode }) {
    const campaigns = useLivePromotions()
    const entries = campaigns.flatMap(campaign => campaign.media.filter(asset => asset.placements.includes(placement))
        .map(asset => ({ asset, campaign })))
    if (!entries.length) return fallback
    return <section aria-label="Promotions" className="w-full min-w-0 space-y-3">
        {entries.map(({ asset, campaign }) => <PromotionAsset key={`${campaign.id}-${asset.id}`} asset={asset} compact={placement === 'site_banner'} href={`/promotions/${campaign.id}`} />)}
    </section>
}
