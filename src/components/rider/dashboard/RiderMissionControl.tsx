"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Bell, MapPin, Package } from "lucide-react"
import { getToken } from "firebase/messaging"
import { toast } from "sonner"
import { acceptOrder, getRiderDeliveryOffers, saveFCMToken, updateRiderLocation } from "@/app/actions/riderActions"
import { ActiveOrderView, DeliveryHeading, DeliverySteps, DeliveryStops, riderPrimaryButton } from "@/components/rider/dashboard/ActiveOrderView"
import { OrderChatPanel } from "@/components/messages/OrderChatPanel"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import type { Coordinates } from "@/lib/directions"
import { messaging } from "@/lib/firebase/config"
import { formatKobo } from "@/lib/money"
import { formatOrderStatus } from "@/lib/orders"
import { deliveryNumber, needsHandoff, type RiderDelivery, type RiderDeliveryHistory, type RiderDeliveryOffer } from "@/lib/riderDeliveries"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

interface RiderMissionControlProps {
    riderId: string
    deliveries: RiderDelivery[]
    history: RiderDeliveryHistory[]
    assignmentsUnavailable: boolean
    historyUnavailable: boolean
}

const historyDate = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeZone: "Africa/Lagos" })

export function RiderMissionControl({ riderId, deliveries, history, assignmentsUnavailable, historyUnavailable }: RiderMissionControlProps) {
    const router = useRouter()
    const [supabase] = useState(() => createClient())
    const [online, setOnline] = useState(true)
    const [locationRevision, setLocationRevision] = useState(0)
    const [queueRevision, setQueueRevision] = useState(0)
    const [queue, setQueue] = useState<{ offers: RiderDeliveryOffer[]; error: string | null; loading: boolean }>({
        offers: [], error: null, loading: true,
    })
    const [selection, setSelection] = useState<string | null>(null)
    const [completedId, setCompletedId] = useState<string | null>(null)
    const [dismissed, setDismissed] = useState<string[]>([])
    const [accepting, setAccepting] = useState(false)
    const [refreshing, startTransition] = useTransition()
    const claimLock = useRef(false)
    const [notificationsBusy, setNotificationsBusy] = useState(false)
    const [notificationsEnabled, setNotificationsEnabled] = useState(false)
    const locationRef = useRef<Coordinates | null>(null)
    const lastLocationUpdate = useRef(0)
    const blockingDelivery = deliveries.find((order) => needsHandoff(order.status))
    const active = deliveries.find((order) => order.id === selection) ?? blockingDelivery ?? deliveries[0]
    const canBrowse = online && !blockingDelivery && !assignmentsUnavailable
    const visibleOffers = canBrowse ? queue.offers.filter((offer) => !dismissed.includes(offer.id)) : []
    const offer = visibleOffers.find((entry) => entry.id === selection) ?? visibleOffers[0]
    const selectedDelivery = active && (active.id === selection || !offer || Boolean(blockingDelivery)) ? active : undefined
    const completed = history.find((entry) => entry.id === completedId)

    useEffect(() => {
        if (!online) return
        let disposed = false
        if (!navigator.geolocation) {
            setQueue({ offers: [], loading: false, error: "This device can’t share its location." })
            return
        }
        const watchId = navigator.geolocation.watchPosition((position) => {
            if (disposed) return
            const { latitude: lat, longitude: lng } = position.coords
            const firstFix = locationRef.current === null
            locationRef.current = { lat, lng }
            if (firstFix) setQueueRevision((version) => version + 1)
            if (Date.now() - lastLocationUpdate.current >= 30000) {
                lastLocationUpdate.current = Date.now()
                void updateRiderLocation(lat, lng).catch(() => {})
            }
        }, () => {
            if (disposed) return
            locationRef.current = null
            setQueue({ offers: [], loading: false, error: "Allow location access to find nearby deliveries." })
        }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 })
        return () => {
            disposed = true
            locationRef.current = null
            navigator.geolocation.clearWatch(watchId)
        }
    }, [online, locationRevision])

    useEffect(() => {
        if (!canBrowse) return
        let disposed = false
        let request = 0
        let timeout: number | undefined
        async function load() {
            const coordinates = locationRef.current
            if (!coordinates) return
            const version = ++request
            try {
                const result = await getRiderDeliveryOffers(coordinates.lat, coordinates.lng)
                if (!disposed && version === request && locationRef.current) {
                    setQueue({ offers: result.offers as RiderDeliveryOffer[], loading: false, error: result.error })
                }
            } catch {
                if (!disposed && version === request && locationRef.current) {
                    setQueue({ offers: [], loading: false, error: "Delivery requests couldn’t load. Try again." })
                }
            }
        }
        function schedule() {
            window.clearTimeout(timeout)
            timeout = window.setTimeout(() => { void load() }, 250)
        }
        void load()
        const channel = supabase.channel(`rider-offers:${riderId}`).on("postgres_changes",
            { event: "*", schema: "public", table: "orders", filter: "status=eq.ready_for_pickup" }, schedule)
            .subscribe((status: string) => { if (status === "SUBSCRIBED") schedule() })
        const interval = window.setInterval(() => { if (!document.hidden) void load() }, 30000)
        window.addEventListener("focus", schedule)
        return () => {
            disposed = true
            window.clearInterval(interval)
            window.clearTimeout(timeout)
            window.removeEventListener("focus", schedule)
            void supabase.removeChannel(channel)
        }
    }, [canBrowse, queueRevision, riderId, supabase])

    useEffect(() => {
        if (!blockingDelivery) return
        const refresh = () => { if (!document.hidden) router.refresh() }
        window.addEventListener("focus", refresh)
        const interval = window.setInterval(refresh, 30000)
        return () => {
            window.removeEventListener("focus", refresh)
            window.clearInterval(interval)
        }
    }, [blockingDelivery, router])

    function retry() {
        setQueue((current) => ({ ...current, error: null, loading: true }))
        if (locationRef.current) setQueueRevision((version) => version + 1)
        else setLocationRevision((version) => version + 1)
    }

    async function accept(id: string) {
        if (claimLock.current || !canBrowse || refreshing) return
        claimLock.current = true
        setAccepting(true)
        try {
            const result = await acceptOrder(id, riderId)
            if (result.success) {
                setSelection(id)
                setCompletedId(null)
                setQueue((current) => ({ ...current, offers: current.offers.filter((entry) => entry.id !== id) }))
                toast.success("Delivery accepted.")
            } else {
                toast.error(result.message ?? "This delivery couldn’t be accepted.")
            }
            startTransition(() => router.refresh())
            setQueueRevision((version) => version + 1)
        } catch {
            toast.error("This delivery couldn’t be accepted. Try again.")
            startTransition(() => router.refresh())
        } finally {
            claimLock.current = false
            setAccepting(false)
        }
    }

    async function enableNotifications() {
        if (!messaging || typeof Notification === "undefined") {
            toast.error("Delivery notifications are unavailable on this device.")
            return
        }
        setNotificationsBusy(true)
        try {
            if (await Notification.requestPermission() !== "granted") {
                toast.error("Allow notifications in your browser to receive alerts.")
                return
            }
            const token = await getToken(messaging, { vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY })
            if (!token || !(await saveFCMToken(token)).success) throw new Error("Token unavailable")
            setNotificationsEnabled(true)
            toast.success("Delivery notifications enabled.")
        } catch {
            toast.error("Couldn’t enable notifications. Try again.")
        } finally {
            setNotificationsBusy(false)
        }
    }

    return <OrderChatPanel workspace="rider" initialOrderId={selectedDelivery?.id ?? ""}
        orders={selectedDelivery ? [{ id: selectedDelivery.id, name: deliveryNumber(selectedDelivery.id) }] : []}>
        <div className="min-w-0 space-y-4">
            <header className="flex flex-wrap items-center justify-between gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Deliveries</h1>
                <label className="flex min-h-11 items-center gap-2 rounded-xl border bg-card px-3 text-sm font-medium">
                    {online ? "On duty" : "Off duty"}
                    <Switch aria-label="Receive nearby delivery requests" checked={online} onCheckedChange={(value) => {
                        setOnline(value)
                        if (value) setQueue({ offers: [], error: null, loading: true })
                    }} />
                </label>
            </header>
            {assignmentsUnavailable && <p role="alert" className="rounded-xl border bg-card p-3 text-sm text-destructive">
                Assignments couldn’t load. <button className="underline underline-offset-2" onClick={() => router.refresh()}>Refresh deliveries</button>
            </p>}
            {(deliveries.length > 1 || (deliveries.length > 0 && visibleOffers.length > 0) || visibleOffers.length > 1) &&
                <nav className="flex flex-wrap gap-2" aria-label="Switch deliveries">
                    {deliveries.map((order) => <Button key={order.id} variant="outline" onClick={() => setSelection(order.id)}
                        aria-pressed={selectedDelivery?.id === order.id}
                        className={cn("min-h-11", selectedDelivery?.id === order.id && "border-orange-400 bg-orange-50 dark:bg-orange-950")}>
                        #{deliveryNumber(order.id)} · {formatOrderStatus(order.status)}
                    </Button>)}
                    {visibleOffers.map((entry) => <Button key={entry.id} variant="outline" onClick={() => setSelection(entry.id)}
                        aria-pressed={!selectedDelivery && offer?.id === entry.id}
                        className={cn("min-h-11", !selectedDelivery && offer?.id === entry.id && "border-orange-400 bg-orange-50 dark:bg-orange-950")}>
                        #{deliveryNumber(entry.id)} · Request
                    </Button>)}
                </nav>}
            {selectedDelivery ? <ActiveOrderView key={selectedDelivery.id} delivery={selectedDelivery}
                onCompleted={() => { setSelection(null); setCompletedId(selectedDelivery.id) }} />
                : offer ? <section className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5" aria-label="Delivery request">
                    <DeliveryHeading id={offer.id} title="New delivery request" payout={offer.rider_payout_kobo} />
                    <DeliverySteps current={0} />
                    <div className="grid gap-4 md:grid-cols-2 md:items-start">
                        <DeliveryStops pickup={{ name: offer.merchant_name || "Merchant", address: offer.merchant_address }}
                            dropoff={{ name: "Customer", address: "Delivery address shared after acceptance" }} />
                        <div className="space-y-2 rounded-xl bg-orange-50 p-4 dark:bg-orange-950/45">
                            <p className="text-xs font-semibold text-orange-900 dark:text-orange-200">Next step</p>
                            <h3 className="font-semibold">Can you take this delivery?</h3>
                            {offer.rider_payout_kobo === null && <p className="text-sm text-muted-foreground">Payout details are unavailable.</p>}
                            <div className="flex flex-wrap gap-2">
                                <Button className={cn(riderPrimaryButton, "flex-1 md:flex-none")} disabled={accepting || refreshing} onClick={() => void accept(offer.id)}>
                                    {accepting ? "Accepting…" : "Accept delivery"}
                                </Button>
                                <Button variant="outline" className="min-h-11" disabled={accepting || refreshing}
                                    onClick={() => setDismissed((ids) => [...ids, offer.id])}>Decline</Button>
                            </div>
                        </div>
                    </div>
                </section>
                : completed
                    ? <section className="space-y-3 rounded-2xl border bg-card p-4 sm:p-5" aria-label="Completed delivery">
                        <DeliveryHeading id={completed.id} title="Delivery complete" payout={completed.payout} />
                        <DeliverySteps current={3} />
                        <p className="text-sm text-muted-foreground">You can find this order under Past deliveries.</p>
                    </section>
                : !assignmentsUnavailable && <section className="space-y-2 rounded-2xl border bg-card p-5" aria-label="Delivery requests">
                    <div className="flex items-start gap-2">
                        {queue.error && online ? <MapPin className="mt-0.5 size-5 shrink-0 text-orange-700 dark:text-orange-200" />
                            : <Package className="mt-0.5 size-5 shrink-0 text-muted-foreground" />}
                        <div>
                            <h2 className="font-semibold">{!online ? "You’re off duty" : queue.loading ? "Finding nearby deliveries…" :
                                queue.error ? "Can’t load delivery requests" : "No nearby requests right now"}</h2>
                            {online && queue.error && <p role="alert" className="text-sm text-muted-foreground">{queue.error}</p>}
                        </div>
                    </div>
                    {online && !queue.loading && <Button variant="outline" className="min-h-11" onClick={retry}>Refresh requests</Button>}
                </section>}

            <details className="rounded-2xl border bg-card px-4 sm:px-5">
                <summary className="min-h-11 cursor-pointer py-3 font-semibold">Past deliveries</summary>
                {historyUnavailable ? <p role="alert" className="pb-4 text-sm text-muted-foreground">Past deliveries couldn’t load.</p>
                    : history.length ? <ul className="divide-y pb-2">
                        {history.map((entry) => <li key={entry.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5 text-sm">
                            <div><p className="font-medium">#{deliveryNumber(entry.id)} · {entry.merchantName}</p>
                                {entry.date && <p className="text-xs text-muted-foreground">{historyDate.format(new Date(entry.date))}</p>}</div>
                            {entry.payout !== null && <span className="font-medium tabular-nums">{formatKobo(entry.payout)}</span>}
                        </li>)}
                    </ul> : <p className="pb-4 text-sm text-muted-foreground">No completed deliveries yet.</p>}
            </details>
            <Button variant="ghost" size="sm" className="min-h-10" disabled={notificationsBusy || notificationsEnabled} onClick={() => void enableNotifications()}>
                <Bell className="size-4" /> {notificationsEnabled ? "Notifications enabled" : notificationsBusy ? "Enabling…" : "Enable delivery notifications"}
            </Button>
        </div>
    </OrderChatPanel>
}
