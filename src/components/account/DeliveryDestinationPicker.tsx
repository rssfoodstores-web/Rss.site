"use client"

import Link from "next/link"
import { NIGERIAN_STATES } from "@/lib/constants/nigerianStates"
import { useEffect, useState } from "react"
import { ChevronDown, LocateFixed, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useDeliveryDestination } from "@/context/DeliveryDestinationContext"
import { useUser } from "@/context/UserContext"
import { findDeliveryLocation, getCurrentDeliveryCoordinates, type ShoppingDestination } from "@/lib/deliveryAddresses"

const PROMPT_KEY = "rss-delivery-prompt-seen"

export function DeliveryDestinationPicker({ firstVisit = false, onDestinationChange }: { firstVisit?: boolean; onDestinationChange?: () => void }) {
    const { user, isLoading } = useUser()
    const { addresses, addressError, loadingAddresses, retryAddresses, selectedAddress, destination, selectDestination, selectionReady } = useDeliveryDestination()
    const [open, setOpen] = useState(false)
    const [dismissed, setDismissed] = useState(false)
    const [locating, setLocating] = useState(false)
    const [captured, setCaptured] = useState<Extract<ShoppingDestination, { kind: "gps" }> | null>(null)
    const [error, setError] = useState("")

    useEffect(() => {
        if (!firstVisit || !selectionReady || isLoading || loadingAddresses || destination || dismissed) return
        const timer = window.setTimeout(() => {
            try { if (sessionStorage.getItem(PROMPT_KEY)) return } catch { /* The prompt remains dismissible. */ }
            setOpen(true)
        }, 350)
        return () => window.clearTimeout(timer)
    }, [destination, dismissed, firstVisit, isLoading, loadingAddresses, selectionReady])

    function close() {
        try { sessionStorage.setItem(PROMPT_KEY, "1") } catch { /* Optional browser persistence. */ }
        setDismissed(true)
        setCaptured(null)
        setError("")
        setOpen(false)
    }

    async function locate() {
        setLocating(true)
        setError("")
        try {
            const location = await getCurrentDeliveryCoordinates()
            const details = await findDeliveryLocation(location)
            setCaptured({ kind: "gps", location, details, state: details?.state })
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : "Location unavailable.")
        } finally {
            setLocating(false)
        }
    }

    function choose(value: ShoppingDestination) {
        selectDestination(value)
        onDestinationChange?.()
        close()
    }

    const label = selectedAddress?.label ?? (destination?.kind === "gps" ? destination.details?.area || destination.state || "Current location" : null)

    return (
        <>
            <button type="button" onClick={() => setOpen(true)} aria-label={label ? `Deliver to ${label}, change delivery location` : "Choose delivery location"}
                className={`flex min-h-11 max-w-full items-center gap-3 rounded-xl px-3 py-1.5 text-left transition-colors motion-reduce:transition-none ${label ? "bg-muted/50 hover:bg-muted" : "bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/45"}`}>
                <MapPin className="size-4 shrink-0 text-[#a94a10] dark:text-orange-300" aria-hidden="true" />
                <span className="min-w-0">
                    <span className="block text-xs text-muted-foreground">Deliver to</span>
                    <span className="block truncate text-sm font-semibold">{label || "Choose delivery location"}</span>
                </span>
                <ChevronDown className="ml-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
            <Dialog open={open} onOpenChange={(value) => { if (!value && !locating) close() }}>
                <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-2xl motion-reduce:animate-none">
                    <DialogHeader>
                        <DialogTitle>{captured ? "Is this where we should deliver?" : "Where should we deliver?"}</DialogTitle>
                        <DialogDescription>{captured ? "Use this destination to see nearby stores." : "See stores near you and get delivery estimates before you shop."}</DialogDescription>
                    </DialogHeader>
                    {captured ? (
                        <>
                            <div className="rounded-xl bg-muted/65 p-4">
                                <p className="font-medium">{captured.details?.address || "Current GPS location"}</p>
                                {captured.details?.address && <p className="mt-1 text-xs font-medium text-muted-foreground" translate="no">Google Maps</p>}
                                <p className="mt-1 text-sm text-muted-foreground">{captured.details?.address
                                    ? "You can add a flat number, gate or landmark at checkout."
                                    : "GPS captured. You can enter street and landmark details at checkout."}</p>
                            </div>
                            {!captured.details?.state && <label className="grid gap-1 text-sm font-medium">
                                Delivery state
                                <select className="min-h-11 rounded-lg border bg-background px-3" value={captured.state ?? ""}
                                    onChange={(event) => setCaptured({ ...captured, state: event.target.value })}>
                                    <option value="">Choose your state</option>
                                    {NIGERIAN_STATES.map((state) => <option key={state}>{state}</option>)}
                                </select>
                            </label>}
                            <Button type="button" disabled={!captured.state} className="h-11 motion-safe:transition-transform motion-safe:active:scale-[0.98]"
                                onClick={() => choose(captured)}>Confirm location</Button>
                            <Button type="button" variant="ghost" onClick={() => setCaptured(null)}>Choose a different location</Button>
                        </>
                    ) : (
                        <>
                            <Button type="button" onClick={() => void locate()} disabled={locating} className="h-11 motion-safe:transition-transform motion-safe:active:scale-[0.98]">
                                <LocateFixed className="mr-1 size-4" aria-hidden="true" />
                                {locating ? "Finding your location…" : "Use my current location"}
                            </Button>
                            {error && <p role="alert" className="text-sm text-red-600 dark:text-red-300">{error}</p>}
                            {loadingAddresses && <p className="text-sm text-muted-foreground">Loading delivery addresses…</p>}
                            {addressError && <Button variant="outline" onClick={retryAddresses}>Retry loading delivery addresses</Button>}
                            {addresses.map((address) => (
                                <button key={address.id} type="button" disabled={locating}
                                    className="rounded-xl border p-3 text-left hover:bg-muted focus-visible:outline-ring"
                                    onClick={() => choose({ kind: "address", id: address.id })}>
                                    <span className="block font-semibold">{address.label}</span>
                                    <span className="block text-sm text-muted-foreground">{address.address}</span>
                                </button>
                            ))}
                            {user && <Button variant="outline" asChild><Link href="/account/address" onClick={close}>Manage delivery addresses</Link></Button>}
                            <Button variant="ghost" onClick={close} disabled={locating}>{destination ? "Keep current destination" : "Browse first"}</Button>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </>
    )
}
