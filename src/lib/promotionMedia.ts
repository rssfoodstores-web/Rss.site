export const promotionPlacements = {
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

// Custom media has no script, network connection, form, navigation or same-origin access.
export function promotionMediaDocument(html: string) {
    const policy = "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src https: data:; font-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'"
    return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${policy}"><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body{margin:0;min-height:100%;font-family:Arial,sans-serif}*{box-sizing:border-box}img{max-width:100%}</style></head><body>${html}</body></html>`
}
