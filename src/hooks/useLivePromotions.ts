"use client"

import { useEffect, useState } from 'react'
import { createPublicStorefrontClient } from '@/lib/supabase/client'
import type { PromotionCampaign } from '@/lib/promotionMedia'

export function useLivePromotions() {
    const [campaigns, setCampaigns] = useState<PromotionCampaign[]>([])
    useEffect(() => {
        const supabase = createPublicStorefrontClient()
        let active = true
        let sequence = 0
        const refresh = async () => {
            const request = ++sequence
            const { data, error } = await supabase.rpc('live_promotion_campaigns')
            if (active && request === sequence && !error) setCampaigns((data ?? []) as PromotionCampaign[])
        }
        const visible = () => { if (!document.hidden) void refresh() }
        void refresh()
        const timer = window.setInterval(visible, 20000)
        window.addEventListener('focus', visible)
        document.addEventListener('visibilitychange', visible)
        return () => {
            active = false
            window.clearInterval(timer)
            window.removeEventListener('focus', visible)
            document.removeEventListener('visibilitychange', visible)
        }
    }, [])
    return campaigns
}
