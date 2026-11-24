"use client"

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { eventTicketAction } from '@/app/promotions/module-actions'
import { Button } from '@/components/ui/button'

type TicketState = { signedIn: boolean; active: boolean; name?: string; email?: string; ticket: null | { id: string; issuedAt: string; usedAt: string | null } }

export function EventTicket({ campaignId, campaignName }: { campaignId: string; campaignName: string }) {
    const [state,setState] = useState<TicketState | null>(null)
    const [error,setError] = useState('')
    const [busy,setBusy] = useState(false)
    const refresh = useCallback(async () => {
        try { setState(await eventTicketAction(campaignId,false) as TicketState); setError('') }
        catch(error) { setError(error instanceof Error ? error.message : 'Could not load your ticket.') }
    },[campaignId])
    useEffect(() => {
        void refresh()
        const timer=window.setInterval(()=>{if(!document.hidden)void refresh()},15000)
        window.addEventListener('focus',refresh)
        return ()=>{window.clearInterval(timer);window.removeEventListener('focus',refresh)}
    },[refresh])
    async function claim() {
        setBusy(true)
        try { setState(await eventTicketAction(campaignId,true) as TicketState);setError('') }
        catch(error) { setError(error instanceof Error ? error.message : 'Could not claim your ticket.') }
        finally {setBusy(false)}
    }
    const ticket=state?.ticket
    return <section className="mx-auto max-w-2xl space-y-5">
        <div className="overflow-hidden rounded-3xl border border-orange-200 bg-gradient-to-br from-orange-50 via-white to-amber-50 p-6 text-center text-slate-950 shadow-sm sm:p-10">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-orange-700">RSS Foods · In-person raffle</p>
            <div aria-hidden="true" className="relative mx-auto my-7 flex h-28 w-44 items-stretch overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-xl shadow-orange-200/70">
                <span className="grid flex-1 place-items-center border-r-2 border-dashed border-orange-200 px-4 text-left"><span><strong className="block text-2xl leading-none">RAFFLE</strong><small className="mt-2 block text-[10px] font-semibold uppercase tracking-[.18em] text-orange-100">Official entry ticket</small></span></span>
                <span className="grid w-14 place-items-center bg-orange-700/25 text-2xl font-black">★</span>
                <span className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-orange-50" />
                <span className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-amber-50" />
            </div>
            <h2 className="text-3xl font-bold sm:text-4xl">Your {campaignName} Ticket</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-600">Claim your free ticket, meet the RSS team, and show it to join the raffle draw in person.</p>
            <div className="mt-6" aria-live="polite">
                {!state ? <p>Loading your ticket…</p> : ticket ? <div className="space-y-4 rounded-2xl border-2 border-dashed border-orange-300 bg-white p-5 text-left">
                    <span className={`inline-block rounded-full px-3 py-1 text-sm font-bold ${ticket.usedAt?'bg-slate-100 text-slate-700':'bg-orange-100 text-orange-800'}`}>{ticket.usedAt?'Used · Entry recorded':'Ready for draw · Not used'}</span>
                    <p className="font-bold">{state.name}</p><p className="break-all text-sm text-slate-600">{state.email}</p>
                    <p className="text-xs uppercase tracking-wider text-slate-500">Ticket reference</p><p className="break-all font-mono text-sm">{ticket.id}</p>
                    <p className="text-sm">{ticket.usedAt?'The RSS team has recorded your raffle entry. This ticket cannot be used again.':'Show this ticket and your signed-in email to RSS staff. They will check it before admitting your entry.'}</p>
                    {ticket.usedAt&&<p className="text-xs text-slate-500">Recorded {new Date(ticket.usedAt).toLocaleString()}</p>}
                </div> : !state.signedIn ? <Button asChild className="min-h-12 bg-orange-500 px-6 text-white hover:bg-orange-600"><Link href={`/login?next=${encodeURIComponent(`/promotions/${campaignId}`)}`}>Sign in to get your ticket</Link></Button> : state.active ? <Button disabled={busy} onClick={()=>void claim()} className="min-h-12 bg-orange-500 px-8 text-white hover:bg-orange-600">{busy?'Getting your ticket…':'Get my free ticket'}</Button> : <p>Ticket claims are currently closed.</p>}
            </div>
            <p className="mt-5 text-xs text-slate-500">One ticket per account · One in-person raffle entry · No payment required</p>
        </div>
        {error&&<div role="alert" className="rounded-xl border p-4 text-sm"><p>{error}</p><Button variant="outline" onClick={()=>void refresh()}>Try again</Button></div>}
        <div className="grid gap-3 text-sm sm:grid-cols-3">{['1. Get your ticket','2. Meet the RSS team','3. Show it to enter'].map(step=><p key={step} className="rounded-xl border bg-card p-4 font-medium">{step}</p>)}</div>
    </section>
}
