"use client"

import { useState } from "react"
import { deleteDeliveryAddress } from "@/app/actions/deliveryAddresses"
import { DeliveryAddressForm } from "@/components/account/DeliveryAddressForm"
import { ProfileSidebar } from "@/components/account/ProfileSidebar"
import { Button } from "@/components/ui/button"
import { useDeliveryDestination } from "@/context/DeliveryDestinationContext"
import type { DeliveryAddress } from "@/lib/deliveryAddresses"

export default function AddressPage() {
    const { addresses, addressError, loadingAddresses, retryAddresses, selectDestination, selectedAddress, updateAddresses } = useDeliveryDestination()
    const [editing, setEditing] = useState<DeliveryAddress | "new" | null>(null)
    const [removing, setRemoving] = useState<string | null>(null)
    const [error, setError] = useState("")

    async function remove(address: DeliveryAddress) {
        if (!window.confirm(`Delete ${address.label} from your delivery addresses?`)) return
        setRemoving(address.id)
        setError("")
        try {
            const result = await deleteDeliveryAddress(address.id)
            if (result.error) setError(result.error)
            else updateAddresses((current) => current.filter(({ id }) => id !== address.id))
        } catch {
            setError("Could not delete this delivery address. Try again.")
        } finally {
            setRemoving(null)
        }
    }

    return (
        <div className="container mx-auto flex flex-col gap-6 px-4 py-8 lg:flex-row">
            <aside className="shrink-0 lg:w-80"><ProfileSidebar /></aside>
            <main className="w-full max-w-2xl space-y-4">
                <h1 className="text-2xl font-bold">Delivery Addresses</h1>
                <p className="text-sm text-muted-foreground">Manage the places you shop for and receive orders.</p>
                {loadingAddresses && <p>Loading delivery addresses…</p>}
                {addressError && <Button variant="outline" onClick={retryAddresses}>Retry loading delivery addresses</Button>}
                {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
                {editing ? (
                    <section className="space-y-4 rounded-xl border p-4">
                        <div className="flex items-center justify-between gap-2">
                            <h2 className="font-semibold">{editing === "new" ? "Add delivery address" : "Edit delivery address"}</h2>
                            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                        </div>
                        <DeliveryAddressForm initial={editing === "new" ? undefined : editing} onSaved={(address) => {
                            if (!selectedAddress) selectDestination({ kind: "address", id: address.id })
                            setEditing(null)
                        }} />
                    </section>
                ) : (
                    <>
                        <Button onClick={() => setEditing("new")} disabled={loadingAddresses || addressError}>Add delivery address</Button>
                        {!loadingAddresses && !addressError && addresses.length === 0 && <p className="text-sm">You have no saved delivery addresses yet.</p>}
                        {addresses.map((address) => (
                            <section key={address.id} className="space-y-2 rounded-xl border p-4">
                                <h2 className="font-semibold">{address.label}</h2>
                                <p className="break-words text-sm text-muted-foreground">{address.address}</p>
                                <div className="flex flex-wrap gap-2">
                                    <Button variant="outline" size="sm" disabled={Boolean(removing)} onClick={() => setEditing(address)}>Edit</Button>
                                    <Button variant="ghost" size="sm" disabled={Boolean(removing)} onClick={() => void remove(address)}>
                                        {removing === address.id ? "Deleting…" : "Delete"}
                                    </Button>
                                    {selectedAddress?.id === address.id ? <span className="self-center text-sm">Selected</span> : (
                                        <Button variant="outline" size="sm" disabled={Boolean(removing)} onClick={() => selectDestination({ kind: "address", id: address.id })}>Deliver here</Button>
                                    )}
                                </div>
                            </section>
                        ))}
                    </>
                )}
            </main>
        </div>
    )
}
