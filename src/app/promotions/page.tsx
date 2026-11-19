import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { PromotionCampaign } from '@/lib/promotionMedia'
import { PromotionAsset } from '@/components/promotions/PromotionAsset'

export default async function PromotionsPage() {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('live_promotion_campaigns')
    const campaigns = (data ?? []) as PromotionCampaign[]
    return <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <h1 className="text-3xl font-bold">Promotions</h1>
        {error ? <p role="alert">Promotions could not load. Please try again.</p> : campaigns.length === 0 ? <p>Check back soon for new promotions.</p> :
            <div className="grid gap-6 md:grid-cols-2">{campaigns.map(campaign => <article key={campaign.id} className="space-y-3 rounded-2xl border p-4">
                {campaign.media[0] && <PromotionAsset asset={campaign.media[0]} href={`/promotions/${campaign.id}`} />}
                <h2 className="text-xl font-semibold">{campaign.name}</h2><p className="whitespace-pre-wrap text-muted-foreground">{campaign.description}</p>
                <Link href={`/promotions/${campaign.id}`} className="inline-flex min-h-11 items-center rounded-lg bg-orange-500 px-4 font-semibold text-gray-950">View promotion</Link>
            </article>)}</div>}
    </main>
}
