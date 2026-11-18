/* eslint-disable @next/next/no-img-element */
import type { PromotionMedia } from '@/lib/promotionMedia'
import { promotionMediaDocument } from '@/lib/promotionMedia'

export function PromotionAsset({ asset, href }: { asset: PromotionMedia; href?: string }) {
    const linked = asset.clickable && Boolean(href)
    const media = asset.type === 'html'
        ? <iframe title={asset.alt || asset.name} sandbox="" referrerPolicy="no-referrer"
            srcDoc={promotionMediaDocument(asset.html)} className="h-56 w-full border-0 sm:h-64" style={linked ? { pointerEvents: 'none' } : undefined} />
        : asset.type === 'video'
            ? <video src={asset.url} aria-label={asset.alt} controls={!linked} autoPlay={linked} muted playsInline loop={linked}
                preload="metadata" className="max-h-80 w-full object-contain" />
            : <img src={asset.url} alt={asset.alt} loading="lazy" className="max-h-80 w-full object-contain" />
    return linked
        ? <a href={href} aria-label={asset.alt || asset.name} className="block overflow-hidden rounded-2xl bg-orange-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500 dark:bg-zinc-900">{media}</a>
        : <div className="overflow-hidden rounded-2xl bg-orange-50 dark:bg-zinc-900">{media}</div>
}
