/* eslint-disable @next/next/no-img-element */
import type { PromotionMedia } from '@/lib/promotionMedia'
import { promotionMediaDocument, promotionMediaHref } from '@/lib/promotionMedia'

export function PromotionAsset({ asset, href, compact = false }: { asset: PromotionMedia; href?: string; compact?: boolean }) {
    const destination = promotionMediaHref(asset, href)
    const linked = Boolean(destination)
    const media = asset.type === 'html'
        ? <iframe title={asset.alt || asset.name} sandbox="" referrerPolicy="no-referrer"
            srcDoc={promotionMediaDocument(asset.html)} className={compact ? 'h-32 w-full border-0 sm:h-28' : 'h-56 w-full border-0 sm:h-64'} style={linked ? { pointerEvents: 'none' } : undefined} />
        : asset.type === 'video'
            ? <video src={asset.url} aria-label={asset.alt} controls={!linked} autoPlay={linked} muted playsInline loop={linked}
                preload="metadata" className="max-h-80 w-full object-contain" style={linked ? { pointerEvents: 'none' } : undefined} />
            : <img src={asset.url} alt={asset.alt} loading="lazy" className="max-h-80 w-full object-contain" />
    return destination
        ? <a href={destination} aria-label={asset.alt || asset.name} className="block overflow-hidden rounded-2xl bg-orange-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500 dark:bg-zinc-900">{media}</a>
        : <div className="overflow-hidden rounded-2xl bg-orange-50 dark:bg-zinc-900">{media}</div>
}
