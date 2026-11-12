"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { Check, Package, Truck, UserRound } from "lucide-react"
import { OrderCall, OrderChatButton, OrderChatPanel } from "@/components/messages/OrderChatPanel"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { formatKobo } from "@/lib/money"
import { formatOrderStatus } from "@/lib/orders"
import { cn } from "@/lib/utils"
import { reportCustomerOrder } from "./reportActions"

type Contact = { full_name: string | null; phone: string | null; avatar_url: string | null }
export interface CustomerDelivery {
    id: string
    status: string | null
    total: number
    address: string | null
    agent: Contact | null
    rider: Contact | null
    code: string | null
    items: { quantity: number; name: string }[]
}

const stages = ["Preparing", "On the way", "Delivered"]
const shortId = (id: string) => id.slice(0, 8).toUpperCase()

function Progress({ status }: { status: string | null }) {
    const stage = status === "completed" || status === "delivered" ? 2 :
        status === "out_for_delivery" ? 1 : ["awaiting_agent_acceptance", "awaiting_merchant_confirmation", "processing", "ready_for_pickup"].includes(status ?? "") ? 0 : null
    if (stage === null) return <p className="text-sm font-medium text-muted-foreground">{formatOrderStatus(status)}</p>
    return <ol aria-label="Delivery progress" className="grid grid-cols-3 gap-2">
        {stages.map((label, index) => <li key={label} aria-current={index === stage ? "step" : undefined}
            className={cn("border-t-[3px] pt-1 text-xs sm:text-sm", index <= stage ? "border-orange-500" : "border-border",
                index === stage ? "font-semibold text-orange-900 dark:text-orange-200" : "text-muted-foreground")}>
            {index < stage && <span className="sr-only">Completed: </span>}{label}
        </li>)}
    </ol>
}

export function CustomerOrderWorkspace({ deliveries, title, hasEmail }: { deliveries: CustomerDelivery[]; title: string; hasEmail: boolean }) {
    const [riderId, setRiderId] = useState<string | null>(null)
    const [reportOpen, setReportOpen] = useState(false)
    const [pending, setPending] = useState(false)
    const [error, setError] = useState("")
    const [report, setReport] = useState<{ reference: string; escalated: boolean } | null>(null)
    const sending = useRef(false)
    const first = deliveries[0]
    const riderDelivery = deliveries.find(({ id }) => id === riderId)
    const rider = riderDelivery?.rider
    const agents = deliveries.filter(({ agent }) => agent)
    const sameAgent = agents.length > 0 && agents.every(({ agent }) =>
        agent?.full_name === agents[0].agent?.full_name && agent?.phone === agents[0].agent?.phone)
    const lead = agents[0]
    const orderOptions = agents.map(({ id }) => ({ id, name: `Delivery ${deliveries.findIndex((delivery) => delivery.id === id) + 1}` }))

    async function submitReport(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (sending.current) return
        const form = new FormData(event.currentTarget)
        sending.current = true
        setPending(true)
        setError("")
        try {
            const result = await reportCustomerOrder(String(form.get("delivery") ?? first.id),
                `${form.get("issue")}: ${form.get("details")}`, String(form.get("email") ?? ""))
            if (result.reference) {
                setReport({ reference: result.reference, escalated: result.escalated })
                setReportOpen(false)
            } else setError(result.error ?? "Couldn’t send the report. Try again.")
        } catch {
            setError("Couldn’t send the report. Try again.")
        } finally {
            sending.current = false
            setPending(false)
        }
    }

    return <OrderChatPanel workspace="customer" initialOrderId={lead?.id ?? first.id} orders={orderOptions}>
        <article className="min-w-0 overflow-hidden rounded-2xl border bg-card">
            <header className="space-y-1 bg-orange-50 p-4 dark:bg-orange-950/40 sm:p-5">
                <p className="break-words text-sm text-muted-foreground">Order #{shortId(first.id)}{first.address && ` · ${first.address}`}</p>
                <h2 className="text-2xl font-bold tracking-tight" aria-live="polite">{title}</h2>
                {deliveries.length > 1 && <p className="text-sm text-muted-foreground">Your items are arriving in {deliveries.length} deliveries.</p>}
            </header>
            <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                <section className="min-w-0 space-y-3" aria-label="Delivery progress">
                    <h3 className="font-semibold">Delivery progress</h3>
                    <div className="divide-y">
                        {deliveries.map((delivery, index) => <section key={delivery.id} className="space-y-2 py-3 first:pt-0">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                <h4 className="flex items-center gap-1.5 font-semibold"><Package className="size-4" aria-hidden="true" />{deliveries.length > 1 ? `Delivery ${index + 1} of ${deliveries.length}` : "Delivery"}</h4>
                                <span>{formatKobo(delivery.total)}</span>
                            </div>
                            <p className="break-words text-sm text-muted-foreground">{delivery.items.map(({ name, quantity }) => `${quantity} × ${name}`).join(", ")}</p>
                            <Progress status={delivery.status} />
                            {delivery.rider && !["completed", "delivered", "cancelled", "refunded", "returned_to_merchant"].includes(delivery.status ?? "") && <div className="space-y-1">
                                <p className="text-sm font-medium"><Truck className="mr-1 inline size-4" aria-hidden="true" />{delivery.rider.full_name || "Your rider"}</p>
                                <div className="flex flex-wrap gap-2">
                                    <Button variant="outline" className="min-h-10" onClick={() => setRiderId(delivery.id)}>Rider profile</Button>
                                    <OrderCall phone={delivery.rider.phone} label={delivery.rider.full_name || "rider"} buttonLabel="Call rider" />
                                </div>
                            </div>}
                            {delivery.code && <p className="rounded-lg bg-muted p-2.5 text-sm">Delivery code <strong className="ml-2 tracking-widest">{delivery.code}</strong><span className="block text-muted-foreground">Share it when your items arrive.</span></p>}
                            <Link href={`/account/orders/${delivery.id}`} className="inline-block text-sm text-muted-foreground underline underline-offset-4">
                                {delivery.status === "pending" ? "Payment and order details" : "View delivery details"}
                            </Link>
                        </section>)}
                    </div>
                </section>
                <aside className="space-y-3 border-t pt-4 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0" aria-label="Order support">
                    {agents.length ? (sameAgent ? [lead] : agents).map((delivery) => <div key={delivery.id} className="space-y-2">
                        <div className="flex items-center gap-2">
                            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-orange-100 text-orange-900"><UserRound className="size-4" aria-hidden="true" /></span>
                            <div><p className="font-semibold">{delivery.agent?.full_name || "Your order agent"}</p>
                                <p className="text-xs text-muted-foreground">{sameAgent ? "Your order agent" : orderOptions.find(({ id }) => id === delivery.id)?.name}</p></div>
                        </div>
                        <div className="flex flex-wrap gap-2"><OrderChatButton customer orderId={delivery.id} />
                            <OrderCall phone={delivery.agent?.phone} label={delivery.agent?.full_name || "agent"} buttonLabel="Call agent" /></div>
                    </div>) : <p className="text-sm text-muted-foreground">Your agent’s contact details will appear after assignment.</p>}
                    <Button variant="ghost" className="min-h-11 px-0 underline underline-offset-4"
                        onClick={() => { setError(""); setReportOpen(true) }}>Report a problem</Button>
                    {report && <div role="status" className="flex gap-2 rounded-lg bg-muted p-2.5 text-sm">
                        <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                        <span>{report.escalated ? "Sent for support review." : "Saved in the support inbox."} Reference #{report.reference}.</span>
                    </div>}
                </aside>
            </div>
        </article>
        <Dialog open={Boolean(rider)} onOpenChange={(open) => { if (!open) setRiderId(null) }}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>{rider?.full_name || "Assigned rider"}</DialogTitle>
                    <DialogDescription>Rider for delivery #{shortId(riderDelivery?.id ?? first.id)}</DialogDescription>
                </DialogHeader>
                {rider?.avatar_url && <div className="size-16 rounded-full bg-cover bg-center" role="img" aria-label="Rider profile photo"
                    style={/^https:\/\//.test(rider.avatar_url) ? { backgroundImage: `url(${JSON.stringify(rider.avatar_url)})` } : undefined} />}
                <div><OrderCall phone={rider?.phone} label={rider?.full_name || "rider"} buttonLabel="Call rider" /></div>
            </DialogContent>
        </Dialog>
        <Dialog open={reportOpen} onOpenChange={(open) => { if (!pending) setReportOpen(open) }}>
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
                <DialogHeader><DialogTitle>Report a problem</DialogTitle>
                    <DialogDescription>Send the order details to RSS Support for review.</DialogDescription></DialogHeader>
                <form onSubmit={submitReport} className="grid gap-3">
                    {deliveries.length > 1 && <label className="grid gap-1 text-sm">Delivery
                        <select name="delivery" className="min-h-11 rounded-lg border bg-background px-2">
                            {deliveries.map(({ id }, index) => <option value={id} key={id}>Delivery {index + 1}</option>)}
                        </select>
                    </label>}
                    <label className="grid gap-1 text-sm">Issue
                        <select name="issue" className="min-h-11 rounded-lg border bg-background px-2">
                            <option>Delivery is late</option><option>Missing or damaged items</option><option>Other</option>
                        </select>
                    </label>
                    {!hasEmail && <label className="grid gap-1 text-sm">Reply email
                        <input type="email" name="email" required maxLength={254} className="min-h-11 rounded-lg border bg-background px-2 text-base" />
                    </label>}
                    <label className="grid gap-1 text-sm">What happened?
                        <textarea name="details" required minLength={2} maxLength={1950} rows={3} className="rounded-lg border bg-background p-2 text-base" />
                    </label>
                    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                    <Button disabled={pending} className="min-h-11 bg-[#F58220] text-gray-950 hover:bg-orange-400">{pending ? "Sending…" : "Send to support"}</Button>
                </form>
            </DialogContent>
        </Dialog>
    </OrderChatPanel>
}
