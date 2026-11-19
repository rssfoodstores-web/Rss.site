import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { PromotionCampaign } from '@/lib/promotionMedia'
import { PromotionAsset } from '@/components/promotions/PromotionAsset'

export default async function PromotionPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('live_promotion_campaigns')
    if (error) return <main className="mx-auto max-w-4xl p-6"><p role="alert">This promotion could not load. Please try again.</p></main>
    const campaign = ((data ?? []) as PromotionCampaign[]).find(row => row.id === id)
    if (!campaign) notFound()
    return <main className="mx-auto max-w-4xl space-y-5 px-4 py-8">
        <Link href="/promotions" className="inline-flex min-h-11 items-center text-orange-600">← All promotions</Link>
        <h1 className="text-3xl font-bold">{campaign.name}</h1>
        {campaign.media[0] && <PromotionAsset asset={campaign.media[0]} />}
        <p className="whitespace-pre-wrap text-muted-foreground">{campaign.description}</p>
        <Link href="/retail" className="inline-flex min-h-11 items-center rounded-lg bg-orange-500 px-5 font-semibold text-gray-950">Browse products</Link>
    </main>
}
