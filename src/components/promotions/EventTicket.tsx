"use client"

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { eventTicketAction } from '@/app/promotions/module-actions'
import { Button } from '@/components/ui/button'

type TicketState = { signedIn: boolean; active: boolean; name?: string; email?: string; ticket: null | { id: string; issuedAt: string; usedAt: string | null } }

export function EventTicket({ campaignId }: { campaignId: string }) {
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
        <div className="overflow-hidden rounded-3xl border border-orange-200 bg-gradient-to-br from-orange-50 via-white to-amber-50 p-6 text-center text-slate-950 sm:p-10">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-orange-700">RSS Foods · In-person event</p>
            <div aria-hidden="true" className="relative mx-auto my-6 h-32 w-32 rounded-full border-8 border-amber-200 shadow-lg" style={{background:'conic-gradient(#f58220 0deg 60deg,#ffcc70 60deg 120deg,#fff0cc 120deg 180deg,#f58220 180deg 240deg,#ffcc70 240deg 300deg,#fff0cc 300deg)'}}><span className="absolute inset-9 grid place-items-center rounded-full bg-white text-2xl">★</span></div>
            <h2 className="text-3xl font-bold sm:text-4xl">Your ticket to Spin the Wheel</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-600">Get your free ticket here. Meet the RSS team, show your ticket, and take your spin in person.</p>
            <div className="mt-6" aria-live="polite">
                {!state ? <p>Loading your ticket…</p> : ticket ? <div className="space-y-4 rounded-2xl border-2 border-dashed border-orange-300 bg-white p-5 text-left">
                    <span className={`inline-block rounded-full px-3 py-1 text-sm font-bold ${ticket.usedAt?'bg-slate-100 text-slate-700':'bg-orange-100 text-orange-800'}`}>{ticket.usedAt?'Used · Spin recorded':'Ready to spin · Not used'}</span>
                    <p className="font-bold">{state.name}</p><p className="break-all text-sm text-slate-600">{state.email}</p>
                    <p className="text-xs uppercase tracking-wider text-slate-500">Ticket reference</p><p className="break-all font-mono text-sm">{ticket.id}</p>
                    <p className="text-sm">{ticket.usedAt?'The RSS team has recorded your spin. This ticket cannot be used again.':'Show this ticket and your signed-in email to RSS staff. They will check it before your spin.'}</p>
                    {ticket.usedAt&&<p className="text-xs text-slate-500">Recorded {new Date(ticket.usedAt).toLocaleString()}</p>}
                </div> : !state.signedIn ? <Button asChild className="min-h-12 bg-orange-500 px-6 text-white hover:bg-orange-600"><Link href={`/login?next=${encodeURIComponent(`/promotions/${campaignId}`)}`}>Sign in to get your ticket</Link></Button> : state.active ? <Button disabled={busy} onClick={()=>void claim()} className="min-h-12 bg-orange-500 px-8 text-white hover:bg-orange-600">{busy?'Getting your ticket…':'Get my free ticket'}</Button> : <p>Ticket claims are currently closed.</p>}
            </div>
            <p className="mt-5 text-xs text-slate-500">One ticket per account · One in-person spin · No payment required</p>
        </div>
        {error&&<div role="alert" className="rounded-xl border p-4 text-sm"><p>{error}</p><Button variant="outline" onClick={()=>void refresh()}>Try again</Button></div>}
        <div className="grid gap-3 text-sm sm:grid-cols-3">{['1. Get your ticket','2. Meet the RSS team','3. Show it and spin'].map(step=><p key={step} className="rounded-xl border bg-card p-4 font-medium">{step}</p>)}</div>
    </section>
}
