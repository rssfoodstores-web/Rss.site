"use client"

import Link from "next/link"
import { useState } from "react"
import { MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useDeliveryDestination } from "@/context/DeliveryDestinationContext"
import { getCurrentDeliveryCoordinates } from "@/lib/deliveryAddresses"

export function DeliveryDestinationPicker({ shopping = false, nearby = true }: { shopping?: boolean; nearby?: boolean }) {
    const { addresses, addressError, loadingAddresses, retryAddresses, selectedAddress, destination, selectDestination } = useDeliveryDestination()
    const [open, setOpen] = useState(false)
    const [locating, setLocating] = useState(false)
    const [error, setError] = useState("")

    async function locate() {
        setLocating(true)
        setError("")
        try {
            const location = await getCurrentDeliveryCoordinates()
            selectDestination({ kind: "gps", location })
            setOpen(false)
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : "Location unavailable.")
        } finally {
            setLocating(false)
        }
    }

    const label = selectedAddress?.label ?? (destination?.kind === "gps" ? "Current location" : null)

    return (
        <div className="flex flex-wrap items-center gap-3 py-2">
            <Button type="button" variant="outline" onClick={() => setOpen(true)}>
                <MapPin className="mr-2 size-4" />
                {label ? `Deliver to ${label}` : "Choose delivery location"}
            </Button>
            {shopping && <p className="text-sm text-gray-600 dark:text-gray-300">
                {label ? (nearby ? "Showing nearby products first for this delivery location." : "Your selected delivery location is used at checkout.") : "Set a delivery location to see nearby products first."}
            </p>}
            <Dialog open={open} onOpenChange={(value) => { if (!locating) setOpen(value) }}>
                <DialogContent className="max-h-[85dvh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Where should we deliver?</DialogTitle>
                        <DialogDescription>Choose a delivery address or use your current location.</DialogDescription>
                    </DialogHeader>
                    {loadingAddresses && <p className="text-sm">Loading delivery addresses…</p>}
                    {addressError && <Button variant="outline" onClick={retryAddresses}>Retry loading delivery addresses</Button>}
                    {addresses.map((address) => (
                        <button key={address.id} type="button" disabled={locating}
                            className="rounded-md border p-3 text-left hover:bg-muted"
                            onClick={() => { selectDestination({ kind: "address", id: address.id }); setOpen(false) }}>
                            <span className="block font-semibold">{address.label}</span>
                            <span className="block text-sm text-muted-foreground">{address.address}</span>
                        </button>
                    ))}
                    <Button type="button" onClick={locate} disabled={locating}>{locating ? "Finding your location…" : "Use my current location"}</Button>
                    <Button variant="outline" asChild><Link href="/account/address">Manage delivery addresses</Link></Button>
                    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
                </DialogContent>
            </Dialog>
        </div>
    )
}
