"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { listDeliveryAddresses } from "@/app/actions/deliveryAddresses"
import { useUser } from "@/context/UserContext"
import { isDeliveryPoint, type DeliveryAddress, type ShoppingDestination } from "@/lib/deliveryAddresses"

interface DeliveryDestinationContextValue {
    addresses: DeliveryAddress[]
    addressError: boolean
    loadingAddresses: boolean
    destination: ShoppingDestination | null
    selectedAddress: DeliveryAddress | null
    selectDestination: (value: ShoppingDestination) => void
    updateAddresses: (value: (previous: DeliveryAddress[]) => DeliveryAddress[]) => void
    retryAddresses: () => void
}

const DeliveryDestinationContext = createContext<DeliveryDestinationContextValue | null>(null)

export function DeliveryDestinationProvider({ children }: { children: ReactNode }) {
    const { user } = useUser()
    const userId = user?.id
    const storageKey = userId ? `rss-delivery-destination:${userId}` : "rss-delivery-destination:guest"
    const [selection, setSelection] = useState<{ key: string; value: ShoppingDestination | null } | null>(null)
    const [addressState, setAddressState] = useState<{ userId: string; addresses: DeliveryAddress[]; error: boolean } | null>(null)
    const [retry, setRetry] = useState(0)

    useEffect(() => {
        let value: ShoppingDestination | null = null
        try {
            const stored = JSON.parse(sessionStorage.getItem(storageKey) ?? (userId ? localStorage.getItem(storageKey) ?? sessionStorage.getItem("rss-delivery-destination:guest") : null) ?? "null")
            if (userId && stored?.kind === "gps" && isDeliveryPoint(stored.location)) {
                sessionStorage.setItem(storageKey, JSON.stringify(stored))
            }
            if (userId) sessionStorage.removeItem("rss-delivery-destination:guest")
            if (stored?.kind === "gps" && isDeliveryPoint(stored.location)) value = stored
            if (stored?.kind === "address" && typeof stored.id === "string") value = stored
        } catch {
            // Shopping still works when browser storage is unavailable.
        }
        const frame = window.requestAnimationFrame(() => setSelection({ key: storageKey, value }))
        return () => window.cancelAnimationFrame(frame)
    }, [storageKey, userId])

    useEffect(() => {
        if (!userId) return
        let active = true
        listDeliveryAddresses().then(
            (addresses) => { if (active) setAddressState({ userId, addresses, error: false }) },
            () => { if (active) setAddressState({ userId, addresses: [], error: true }) },
        )
        return () => { active = false }
    }, [retry, userId])

    const addresses = addressState?.userId === userId ? addressState?.addresses ?? [] : []
    const value = selection?.key === storageKey ? selection.value : null
    const selectedAddress = value?.kind === "address"
        ? addresses.find(({ id }) => id === value.id) ?? addresses[0] ?? null
        : value?.kind === "gps" ? null : addresses[0] ?? null
    const destination = selectedAddress ? { kind: "address" as const, id: selectedAddress.id } : value?.kind === "gps" ? value : null

    return (
        <DeliveryDestinationContext.Provider value={{
            addresses,
            addressError: addressState?.userId === userId && Boolean(addressState?.error),
            loadingAddresses: Boolean(userId && addressState?.userId !== userId),
            destination,
            selectedAddress,
            selectDestination: (value) => {
                setSelection({ key: storageKey, value })
                try {
                    sessionStorage.setItem(storageKey, JSON.stringify(value))
                    if (userId && value.kind === "address") localStorage.setItem(storageKey, JSON.stringify(value))
                } catch { /* Optional browser persistence. */ }
            },
            updateAddresses: (update) => {
                if (userId) setAddressState((state) => ({
                    userId,
                    addresses: update(state?.userId === userId ? state.addresses : []),
                    error: false,
                }))
            },
            retryAddresses: () => setRetry((count) => count + 1),
        }}>
            {children}
        </DeliveryDestinationContext.Provider>
    )
}

export function useDeliveryDestination() {
    const context = useContext(DeliveryDestinationContext)
    if (!context) throw new Error("Delivery destination provider is missing.")
    return context
}
