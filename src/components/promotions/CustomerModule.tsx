"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { customerModuleAction } from '@/app/promotions/module-actions'
import { moduleRuleDescriptions, type ModulePackage, type ModuleState } from '@/lib/promotionModule'
import { ModuleFrame } from './ModuleFrame'
import { Button } from '@/components/ui/button'
import { EventTicket } from './EventTicket'

export function CustomerModule({ campaignId, module }: { campaignId: string; module: Omit<ModulePackage,'admin'> }) {
    if (module.settings.eventTickets === true) return <EventTicket campaignId={campaignId} />
    return <StandardModule campaignId={campaignId} module={module} />
}

function StandardModule({ campaignId, module }: { campaignId: string; module: Omit<ModulePackage,'admin'> }) {
    const router = useRouter()
    const [state, setState] = useState<ModuleState | null>(null)
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)
    const revision = useRef(0)
    const request = useCallback(async (method: string, args?: unknown) => {
        if (method === 'navigate') {
            if (args === 'login') router.push(`/login?next=${encodeURIComponent(`/promotions/${campaignId}`)}`)
            else if (args === 'profile') router.push('/account/profile')
            else throw new Error('This destination is unavailable.')
            return null
        }
        const current = ++revision.current
        const result = await customerModuleAction(campaignId,method)
        if (current === revision.current) { setState(result); setError('') }
        return result
    }, [campaignId,router])
    useEffect(() => { void request('getState').catch(error => setError(error instanceof Error ? error.message : 'Could not load your ticket.')) }, [request])
    async function claim() {
        setBusy(true)
        try { await request('claim') } catch (error) { setError(error instanceof Error ? error.message : 'Could not submit the claim.') }
        finally { setBusy(false) }
    }
    return <div className="space-y-5">
        <ModuleFrame title={module.name} design={module.customer} onRequest={request} />
        {error && <p className="rounded-lg border p-3 text-sm text-destructive" role="alert">{error}</p>}
        {state?.prize && <section className="space-y-2 rounded-xl border bg-card p-4" aria-live="polite">
            <h2 className="font-semibold">Your saved result</h2><p>{state.prize.label}</p>
            <p className="break-all text-xs text-muted-foreground">Reference {state.prize.reference}</p>
            <p className="text-sm text-muted-foreground">{state.prize.claimStatus === 'requested' ? 'Claim submitted. The RSS team will arrange fulfillment.' : state.prize.claimStatus === 'fulfilled' ? 'The RSS team has marked this reward as fulfilled.' : state.prize.claimStatus === 'not_required' ? 'This result does not require a claim.' : 'Request your prize here. The RSS team fulfills this reward manually.'}</p>
            {state.prize.claimStatus === 'won' && <Button disabled={busy} onClick={() => void claim()}>Request prize claim</Button>}
        </section>}
        <details className="rounded-xl border p-4"><summary className="cursor-pointer font-semibold">Promotion rules</summary>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">{moduleRuleDescriptions(module.rules).map(rule => <li key={rule}>{rule}</li>)}
                <li>Prize chances use the weights of prizes still in stock. Entries close once all stock is allocated.</li>
                <li>Rewards are fulfilled manually by the RSS team. A claim records your request.</li>
            </ul>
        </details>
    </div>
}
