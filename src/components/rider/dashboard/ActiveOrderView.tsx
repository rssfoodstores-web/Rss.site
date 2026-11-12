"use client"

import { useId, useRef, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Check, MapPin, Navigation, Store } from "lucide-react"
import { toast } from "sonner"
import { releaseStalePickup, reportDeliveryIssue, verifyDelivery } from "@/app/actions/riderActions"
import { OrderCall, OrderChatButton } from "@/components/messages/OrderChatPanel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { buildRiderNavigationUrl } from "@/lib/directions"
import { formatKobo } from "@/lib/money"
import { formatOrderStatus } from "@/lib/orders"
import { deliveryNumber, type RiderDelivery } from "@/lib/riderDeliveries"
import { cn } from "@/lib/utils"

export const riderPrimaryButton = "min-h-11 bg-[#F58220] text-gray-950 hover:bg-orange-400"

export function DeliveryHeading({ id, title, payout }: { id: string; title: string; payout: number | null }) {
    return <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div><p className="text-xs text-muted-foreground">Order #{deliveryNumber(id)}</p>
            <h2 className="text-xl font-semibold tracking-tight">{title}</h2></div>
        {payout !== null && <div><p className="font-semibold tabular-nums">{formatKobo(payout)}</p>
            <p className="text-xs text-muted-foreground">Rider payout</p></div>}
    </header>
}

export function DeliverySteps({ current }: { current: number }) {
    return <ol className="grid grid-cols-3 gap-1.5 text-xs font-medium sm:gap-2 sm:text-sm" aria-label="Delivery steps">
        {["Accept", "Pick up", "Deliver"].map((label, index) => <li key={label} aria-current={index === current ? "step" : undefined}
            className={cn("flex min-w-0 items-center gap-1.5 rounded-lg bg-muted px-1.5 py-2 text-muted-foreground sm:px-2",
                index === current && "bg-orange-100 text-orange-950 dark:bg-orange-950 dark:text-orange-100",
                index < current && "bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100")}>
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-background text-xs" aria-hidden="true">
                {index < current ? <Check className="size-3.5" /> : index + 1}
            </span>
            {index < current && <span className="sr-only">Completed: </span>}{label}
        </li>)}
    </ol>
}

export function DeliveryStops({ pickup, dropoff, activeStop, children }: {
    pickup: { name: string; address: string | null }
    dropoff: { name: string; address: string | null }
    activeStop?: "pickup" | "dropoff"
    children?: ReactNode
}) {
    return <section className="min-w-0 space-y-3" aria-label="Pickup and drop-off">
        {([{ key: "pickup", place: pickup, icon: Store, label: "Pick up from" },
            { key: "dropoff", place: dropoff, icon: MapPin, label: "Deliver to" }] as const).map(({ key, place, icon: Icon, label }) => (
            <div key={key} className="flex min-w-0 items-start gap-2.5">
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground",
                    activeStop === key && "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200")}>
                    <Icon className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p>
                    <p className="break-words text-sm font-semibold">{place.name}</p>
                    {place.address && <p className="break-words text-sm text-muted-foreground">{place.address}</p>}</div>
            </div>
        ))}
        {children}
    </section>
}

const nextBox = "min-w-0 space-y-2 rounded-xl bg-orange-50 p-3.5 dark:bg-orange-950/45 sm:p-4"
type Issue = "failed" | "reschedule" | "return_to_merchant"

export function ActiveOrderView({ delivery, onCompleted }: { delivery: RiderDelivery; onCompleted: () => void }) {
    const [arrived, setArrived] = useState(false)
    const [enterCode, setEnterCode] = useState(false)
    const [code, setCode] = useState("")
    const [issue, setIssue] = useState<Issue>("failed")
    const [reason, setReason] = useState("")
    const [schedule, setSchedule] = useState("")
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState("")
    const [confirmRelease, setConfirmRelease] = useState(false)
    const actionLock = useRef(false)
    const codeId = useId()
    const router = useRouter()
    const pickup = delivery.status === "ready_for_pickup"
    const returning = delivery.status === "return_in_transit"
    const enRoute = delivery.status === "out_for_delivery"
    const destination = pickup || returning ? delivery.pickup : delivery.dropoff
    const navigationUrl = destination.coordinates ? buildRiderNavigationUrl(destination.coordinates) :
        destination.address ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination.address)}&travelmode=driving` : null
    const heading = pickup ? arrived ? "Waiting for pickup verification" : "Go to the pickup" : formatOrderStatus(delivery.status)

    async function act(action: () => Promise<{ success: boolean; message?: string }>, success: string, onSuccess?: () => void) {
        if (actionLock.current) return
        actionLock.current = true
        setBusy(true)
        setError("")
        try {
            const result = await action()
            if (!result.success) {
                const message = result.message || "Couldn’t update the delivery. Try again."
                setError(message)
                toast.error(message)
                return
            }
            setConfirmRelease(false)
            onSuccess?.()
            toast.success(success)
            router.refresh()
        } catch {
            setError("Couldn’t update the delivery. Try again.")
            toast.error("Couldn’t update the delivery. Try again.")
        } finally {
            actionLock.current = false
            setBusy(false)
        }
    }

    return <section className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5" aria-label="Selected delivery">
        <DeliveryHeading id={delivery.id} title={heading} payout={delivery.payout} />
        <DeliverySteps current={pickup ? 1 : 2} />
        <div className="grid min-w-0 gap-4 md:grid-cols-2 md:items-start">
            <DeliveryStops pickup={delivery.pickup} dropoff={delivery.dropoff} activeStop={pickup || returning ? "pickup" : "dropoff"}>
                {(pickup || enRoute || returning) && <div className="flex flex-wrap gap-2">
                    {navigationUrl && <Button variant="outline" className="min-h-11" asChild>
                        <a href={navigationUrl} target="_blank" rel="noreferrer"><Navigation className="size-4" /> Directions</a>
                    </Button>}
                    <OrderCall phone={destination.phone} label={pickup || returning ? "store" : "customer"}
                        buttonLabel={pickup || returning ? "Call store" : "Call customer"} />
                </div>}
                {enRoute && delivery.backupPhones.length > 0 && <details className="text-sm">
                    <summary className="cursor-pointer py-1.5 font-medium">Backup delivery contacts</summary>
                    <div className="mt-2 flex flex-wrap gap-2">{delivery.backupPhones.map((phone, index) =>
                        <OrderCall key={phone} phone={phone} label={`backup contact ${index + 1}`} />)}</div>
                </details>}
            </DeliveryStops>
            <section className={nextBox} aria-label="Next action">
                <p className="text-xs font-semibold text-orange-900 dark:text-orange-200">Next step</p>
                {pickup && !arrived && <>
                    <h3 className="font-semibold">Head to {delivery.pickup.name}</h3>
                    <p className="text-sm text-muted-foreground">Tap below when you arrive.</p>
                    <Button className={riderPrimaryButton} onClick={() => setArrived(true)}>I’m at the store</Button>
                </>}
                {pickup && arrived && <>
                    <h3 className="font-semibold">Show your pickup code</h3>
                    {delivery.pickupCode ? <p className="font-mono text-3xl font-bold tracking-[0.16em]">{delivery.pickupCode}</p> :
                        <p role="status" className="text-sm text-muted-foreground">Pickup code unavailable. Refresh or contact your agent.</p>}
                    <p className="text-sm text-muted-foreground">Collect the order after the merchant verifies the code.</p>
                    <Button variant="outline" className="min-h-11" onClick={() => router.refresh()}>Check pickup status</Button>
                </>}
                {enRoute && !enterCode && <>
                    <h3 className="font-semibold">Deliver to {delivery.dropoff.name}</h3>
                    <p className="text-sm text-muted-foreground">Ask for the delivery code when you hand over the order.</p>
                    <Button className={riderPrimaryButton} onClick={() => setEnterCode(true)}>Enter delivery code</Button>
                </>}
                {enRoute && enterCode && <form className="space-y-2" onSubmit={(event) => {
                    event.preventDefault()
                    if (code.length === 4) void act(() => verifyDelivery(delivery.id, code), "Delivery completed.", onCompleted)
                }}>
                    <label htmlFor={codeId} className="block text-sm font-medium">Customer’s 4-digit code</label>
                    <div className="flex flex-wrap items-center gap-2">
                        <Input id={codeId} autoFocus autoComplete="off" inputMode="numeric" className="h-11 w-24 bg-background text-base tracking-widest"
                            value={code} disabled={busy} onChange={(event) => { setCode(event.target.value.replace(/\D/g, "").slice(0, 4)); setError("") }} />
                        <Button className={riderPrimaryButton} type="submit" disabled={busy || code.length !== 4}>
                            {busy ? "Checking…" : "Complete delivery"}
                        </Button>
                    </div>
                </form>}
                {returning && <><h3 className="font-semibold">Return the order to {delivery.pickup.name}</h3>
                    <p className="text-sm text-muted-foreground">Contact the agent to coordinate the return.</p></>}
                {!pickup && !enRoute && !returning && <><h3 className="font-semibold">{heading}</h3>
                    <p className="text-sm text-muted-foreground">Contact the agent to confirm the next step.</p></>}
                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            </section>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
            <div className="min-w-0">
                <p className="break-words text-sm font-semibold">{delivery.agent?.name ?? "Order team"}</p>
                {delivery.agent && <p className="text-xs text-muted-foreground">Coordinating agent</p>}
            </div>
            <div className="flex flex-wrap gap-2">
                <OrderCall phone={delivery.agent?.phone} label={delivery.agent?.name ?? "agent"} buttonLabel="Call agent" />
                <OrderChatButton orderId={delivery.id} />
            </div>
        </div>
        {delivery.items.length > 0 && <details className="border-t pt-2 text-sm">
            <summary className="cursor-pointer py-2 font-medium">Order items</summary>
            <ul className="space-y-1">{delivery.items.map((item) => <li key={item.id}>{item.quantity} × {item.name}</li>)}</ul>
        </details>}
        {(pickup || enRoute) && <details className="border-t pt-2 text-sm">
            <summary className="cursor-pointer py-2 font-medium">Problem with this delivery?</summary>
            {pickup ? <div className="space-y-2">
                <p className="text-muted-foreground">Release this pickup if you can’t collect it. It will go back to the queue.</p>
                {confirmRelease ? <div className="flex flex-wrap gap-2">
                    <Button variant="destructive" disabled={busy} onClick={() => void act(() => releaseStalePickup(delivery.id), "Pickup released.")}>Confirm release</Button>
                    <Button variant="ghost" disabled={busy} onClick={() => setConfirmRelease(false)}>Keep pickup</Button>
                </div> : <Button variant="outline" onClick={() => setConfirmRelease(true)}>Release pickup</Button>}
            </div> : <form className="grid max-w-md gap-2" onSubmit={(event) => {
                event.preventDefault()
                if (!reason.trim() || (issue === "reschedule" && !schedule)) return
                void act(() => reportDeliveryIssue(delivery.id, issue, reason, issue === "reschedule" ? `${schedule}+01:00` : null), "Delivery issue recorded.")
            }}>
                <label className="grid gap-1">Update
                    <select className="min-h-11 rounded-lg border bg-background px-2" disabled={busy} value={issue}
                        onChange={(event) => setIssue(event.target.value as Issue)}>
                        <option value="failed">Report failed delivery</option><option value="reschedule">Reschedule</option>
                        <option value="return_to_merchant">Return to merchant</option>
                    </select>
                </label>
                {issue === "reschedule" && <label className="grid gap-1">New delivery time (Lagos)
                    <Input type="datetime-local" required disabled={busy} value={schedule} onChange={(event) => setSchedule(event.target.value)} />
                </label>}
                <label className="grid gap-1">Reason
                    <Input required maxLength={500} disabled={busy} value={reason} onChange={(event) => setReason(event.target.value)} />
                </label>
                <Button type="submit" variant="outline" className="justify-self-start" disabled={busy || !reason.trim()}>Save update</Button>
            </form>}
        </details>}
    </section>
}
