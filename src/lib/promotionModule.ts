export type ModuleDesign = { html: string; css: string; js: string }
export type ModuleRules = {
    newAccountsOnly: boolean
    verifiedEmail: boolean
    minWalletKobo: number
    minCompletedOrders: number
    minSpendKobo: number
    purchaseSince: string | null
    productIds: string[]
}
export type ModulePrize = { id: string; label: string; quantity: number; weight: number; fulfillment: 'manual' | 'none' }
export type ModulePackage = {
    version: 1
    name: string
    description: string
    customer: ModuleDesign
    admin: ModuleDesign
    rules: ModuleRules
    prizes: ModulePrize[]
    settings: Record<string, string | number | boolean>
}
export type ModuleState = {
    signedIn: boolean
    active: boolean
    eligible: boolean
    reasons: string[]
    ticket: 'available' | 'used' | null
    prize: { id: string; label: string; fulfillment: 'manual' | 'none'; claimStatus: 'won' | 'requested' | 'fulfilled' | 'not_required'; reference: string } | null
    settings: ModulePackage['settings']
}

function record(value: unknown, allowed: string[], label: string): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`)
    const row = value as Record<string, unknown>
    const unsupported = Object.keys(row).filter(key => !allowed.includes(key))
    if (unsupported.length) throw new Error(`${label}: unsupported field ${unsupported[0]}. Use the dashboard instructions for version 1.`)
    return row
}
function text(value: unknown, label: string, max = 100, required = true): string {
    if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new Error(`Check ${label}. Maximum ${max} characters.`)
    return value
}
function integer(value: unknown, label: string, min = 0, max = 1000000000): number {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${label} must be a whole number between ${min} and ${max}.`)
    return value
}
export function parseModuleSettings(value: unknown): ModulePackage['settings'] {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length > 30) throw new Error('Settings must contain at most 30 named values.')
    const output: ModulePackage['settings'] = {}
    for (const [key, item] of Object.entries(value)) {
        if (!/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(key) || ['__proto__','constructor','prototype'].includes(key)) throw new Error('Settings contain an invalid name.')
        if (typeof item === 'string' && item.length <= 2000 || typeof item === 'boolean' || typeof item === 'number' && Number.isFinite(item)) output[key] = item
        else throw new Error(`Setting ${key} must be text, a number or true/false.`)
    }
    return output
}
export function parseModulePackage(raw: string): ModulePackage {
    if (raw.length > 300000) throw new Error('Keep the package within 300,000 characters.')
    let parsed: unknown
    try { parsed = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'')) }
    catch { throw new Error('Paste the complete JSON package returned by ChatGPT.') }
    const row = record(parsed,['version','name','description','customer','admin','rules','prizes','settings'],'Package')
    if (row.version !== 1) throw new Error('This importer supports package version 1.')
    const design = (value: unknown, label: string): ModuleDesign => {
        const data = record(value,['html','css','js'],label)
        return { html: text(data.html,`${label} HTML`,60000), css: text(data.css,`${label} CSS`,30000,false), js: text(data.js,`${label} JavaScript`,30000,false) }
    }
    const r = record(row.rules,['newAccountsOnly','verifiedEmail','minWalletKobo','minCompletedOrders','minSpendKobo','purchaseSince','productIds'],'Rules')
    if (typeof r.newAccountsOnly !== 'boolean' || typeof r.verifiedEmail !== 'boolean') throw new Error('Account rules must use true or false.')
    if (r.purchaseSince !== null && (typeof r.purchaseSince !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(r.purchaseSince) || !Number.isFinite(Date.parse(r.purchaseSince)))) throw new Error('purchaseSince must be null or an ISO date with a timezone.')
    if (typeof r.purchaseSince === 'string' && !/(Z|[+-]\d{2}:\d{2})$/.test(r.purchaseSince)) throw new Error('purchaseSince needs a timezone.')
    if (!Array.isArray(r.productIds) || r.productIds.length > 50 || r.productIds.some(id => typeof id !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))) throw new Error('productIds must be an array of up to 50 product UUIDs.')
    if (!Array.isArray(row.prizes) || row.prizes.length < 1 || row.prizes.length > 20) throw new Error('Add between 1 and 20 prizes.')
    const prizes = row.prizes.map((value): ModulePrize => {
        const p = record(value,['id','label','quantity','weight','fulfillment'],'Prize')
        const id = text(p.id,'prize ID',50)
        if (!/^[a-z0-9_-]+$/.test(id) || !['manual','none'].includes(String(p.fulfillment))) throw new Error('Use simple prize IDs and manual or none fulfillment.')
        return { id, label: text(p.label,'prize label',150), quantity: integer(p.quantity,'Prize quantity',1,100000), weight: integer(p.weight,'Prize weight',1,10000), fulfillment: p.fulfillment as ModulePrize['fulfillment'] }
    })
    if (new Set(prizes.map(p => p.id)).size !== prizes.length) throw new Error('Each prize needs a unique ID.')
    return { version: 1, name: text(row.name,'module name'), description: text(row.description,'module description',2000),
        customer: design(row.customer,'Customer page'), admin: design(row.admin,'Admin panel'),
        rules: { newAccountsOnly: r.newAccountsOnly, verifiedEmail: r.verifiedEmail,
            minWalletKobo: integer(r.minWalletKobo,'Wallet minimum'), minCompletedOrders: integer(r.minCompletedOrders,'Completed order minimum',0,10000), minSpendKobo: integer(r.minSpendKobo,'Purchase minimum'),
            purchaseSince: r.purchaseSince as string | null, productIds: r.productIds as string[] },
        prizes, settings: parseModuleSettings(row.settings) }
}
export function moduleRuleDescriptions(rules: ModuleRules) {
    const rulesText = ['Sign in to participate.', 'One ticket per account. Each ticket works once.']
    if (rules.newAccountsOnly) rulesText.push('Account must be created after this module was first published.')
    if (rules.verifiedEmail) rulesText.push('Email must be verified. Email/password and Google accounts can qualify.')
    if (rules.minWalletKobo) rulesText.push(`Available customer wallet balance must be at least ₦${(rules.minWalletKobo/100).toLocaleString('en-NG')}.`)
    if (rules.minCompletedOrders) rulesText.push(`Complete at least ${rules.minCompletedOrders} purchases.`)
    if (rules.minSpendKobo) rulesText.push(`Spend at least ₦${(rules.minSpendKobo/100).toLocaleString('en-NG')} on completed purchases, excluding delivery.`)
    if (rules.purchaseSince) rulesText.push(`Qualifying purchases must be created on or after ${rules.purchaseSince}.`)
    if (rules.productIds.length) rulesText.push('Completed purchases must include at least one of the selected products.')
    rulesText.push('Eligibility is checked before ticket use. Existing results remain available after the campaign ends.')
    return rulesText
}

export const moduleInstructions = `Create one valid JSON RSS promotion package, version 1. Return JSON only, without markdown or explanations. Ask me for the promotion concept, eligibility and prizes. Use this exact structure:
{"version":1,"name":"Welcome spin","description":"Explain the campaign","customer":{"html":"HTML fragment (no script tags)","css":"Responsive CSS","js":"JavaScript"},"admin":{"html":"Admin dashboard fragment","css":"Responsive CSS","js":"JavaScript"},"rules":{"newAccountsOnly":true,"verifiedEmail":true,"minWalletKobo":0,"minCompletedOrders":0,"minSpendKobo":0,"purchaseSince":null,"productIds":[]},"prizes":[{"id":"welcome-pack","label":"Welcome pack","quantity":20,"weight":100,"fulfillment":"manual"}],"settings":{"heading":"Welcome rewards"}}
All fields are required. Allowed rules are exactly the keys above. Do not invent new backend capabilities. Sign-in and one ticket per account, used once, are built in. newAccountsOnly uses module first-published time. verifiedEmail accepts ANY verified email provider. Wallet checks available customer balance without charging it. Spend uses paid, completed/delivered purchases, item subtotal less points discounts, excluding delivery. Purchase conditions use purchases since purchaseSince when provided. productIds is empty or product UUIDs; at least one must appear in a qualifying purchase. minCompletedOrders counts purchases, grouping split merchant deliveries from one checkout. Tickets are issued when an eligible signed-in customer opens the module. Eligibility is checked again when entering. No daily or repeated-entry modes in version 1.
Prize fulfillment is manual (RSS team fulfills claims) or none (a non-winning outcome). Never promise automatic wallet credit, cash transfers, redeemable checkout vouchers or shipping. Manual vouchers require staff fulfillment. Use demo rewards if testing. Weight controls relative chances among prizes still in stock; exhausted prizes leave the draw. Close entries when all stock is gone. Results and claims are stored by RSS, never by your JavaScript. Prizes and eligibility rules become locked after the first ticket is issued. Visual design, settings and admin code can still change.
Customer JS uses window.RSS.getState(), window.RSS.enter(), window.RSS.claim(). All return Promises. getState returns {signedIn,active,eligible,reasons:string[],ticket:"available"|"used"|null,prize:null|{id,label,fulfillment,claimStatus:"won"|"requested"|"fulfilled"|"not_required",reference},settings}. enter returns the same state, with a server-selected prize; call it once after a deliberate click and animate THAT result. Repeating enter returns the saved result, without another draw. claim requests manual fulfillment, once. Use a regular link to /login?next=... through RSS.navigate("login") for signed-out visitors; RSS.navigate("profile") opens account details for email help. Methods reject with Error.message; display it accessibly. Never send campaign IDs, user IDs, prize IDs, balances or outcomes to these methods. They are fixed by the host.
Admin JS uses RSS.getSummary() -> {tickets,used,claimed,fulfilled,prizes:[{id,label,quantity,weight,remaining,fulfillment}],entries:[{reference,customer,label,claimStatus,createdAt}],rules,settings,locked}. Display readable rules, stock, claims and activity. RSS.updateSettings(object) updates only display settings (text, numbers, booleans; at most 30 values). RSS.fulfill(reference) marks a requested manual claim fulfilled. The host asks for confirmation before fulfillment. Do not call customer enter/claim from the admin panel. Preview mode is simulated and must be labelled. Never auto-fulfill on page load.
Each design has its own sandboxed document. No external JS, libraries, fetch, imports, cookies, forms or storage. Inline HTML, CSS and JavaScript only. Images may use HTTPS URLs. Use textContent for all returned data, never innerHTML with customer or settings data. Scope styles, support 320px/mobile and desktop, use accessible labels, avoid fixed heights/widths that clip content, and use RSS orange #F58220. Show loading states, disable entry during requests, and always show an already-used ticket's recorded result. No secrets in the package. CSS/HTML must be self-contained. Include a mini admin dashboard tailored to this campaign. Quantities/weights/rules are explained in the host review and can be changed by replacing the package before the first ticket.`
