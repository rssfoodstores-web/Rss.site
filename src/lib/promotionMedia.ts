export const promotionPlacements = {
    site_banner: 'All pages · site-wide banner',
    home_hero: 'Homepage hero',
    product_inline: 'Between products',
    customer_overview: 'Customer overview notice',
    retail_banner: 'Retail page banner',
    wholesale_banner: 'Wholesale page banner',
} as const
export type PromotionPlacement = keyof typeof promotionPlacements
export type PromotionMedia = {
    id: string
    name: string
    type: 'image' | 'video' | 'html'
    url: string
    html: string
    alt: string
    clickable: boolean
    linkType?: 'promotion' | 'custom'
    linkUrl?: string
    placements: PromotionPlacement[]
}
export type PromotionCampaign = {
    id: string
    name: string
    description: string
    status: 'draft' | 'running' | 'paused' | 'stopped'
    starts_at: string | null
    ends_at: string | null
    media: PromotionMedia[]
    revision: number
}

export function promotionMediaUrl(value: string) {
    if (value.startsWith('/') && !value.startsWith('//') && !/[\\\s]/.test(value)) return true
    try { return new URL(value).protocol === 'https:' } catch { return false }
}

export function promotionLinkUrl(value: string) {
    if (!value || /[\\\s\u0000-\u001f\u007f]/.test(value)) return false
    if (value.startsWith('/')) return !value.startsWith('//')
    try {
        const url = new URL(value)
        return url.protocol === 'https:' && !url.username && !url.password
    } catch { return false }
}

export function promotionMediaHref(asset: PromotionMedia, promotionHref?: string) {
    if (!asset.clickable) return null
    const href = asset.linkType === 'custom' ? asset.linkUrl : promotionHref
    return href && promotionLinkUrl(href) ? href : null
}

// Custom media has no script, network connection, form, navigation or same-origin access.
export function promotionMediaDocument(html: string) {
    const policy = "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src https: data:; font-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'"
    return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${policy}"><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body{margin:0;min-height:100%;font-family:Arial,sans-serif}*{box-sizing:border-box}img{max-width:100%}</style></head><body>${html}</body></html>`
}
