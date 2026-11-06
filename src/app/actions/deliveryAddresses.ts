"use server"

import { isDeliveryPoint, type DeliveryAddress } from "@/lib/deliveryAddresses"
import { createClient } from "@/lib/supabase/server"

async function getAddressClient() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Sign in to manage delivery addresses.")
    return { supabase, userId: user.id }
}

export async function listDeliveryAddresses(): Promise<DeliveryAddress[]> {
    const { supabase, userId } = await getAddressClient()
    const { data, error } = await supabase.from("delivery_addresses")
        .select("id,label,address,location")
        .eq("customer_id", userId)
        .order("created_at")
        .order("id")
    if (error) throw new Error("Could not load your delivery addresses.")
    const { parseCoordinates } = await import("@/lib/directions")
    return (data ?? []).flatMap(({ id, label, address, location }) => {
        const point = parseCoordinates(location)
        return point ? [{ id, label, address, ...point }] : []
    })
}

export async function saveDeliveryAddress(input: Omit<DeliveryAddress, "id"> & { id?: string }) {
    const { supabase, userId } = await getAddressClient()
    const label = input.label?.trim()
    const address = input.address?.trim()
    if (!label || label.length > 60 || !address || address.length > 500 || !isDeliveryPoint(input)) {
        return { error: "Enter a name, a complete delivery address, and a map pin." }
    }
    const values = { label, address, location: `POINT(${input.lng} ${input.lat})` }
    const query = input.id
        ? supabase.from("delivery_addresses").update(values).eq("id", input.id).eq("customer_id", userId)
        : supabase.from("delivery_addresses").insert({ ...values, customer_id: userId })
    const { data, error } = await query.select("id").single()
    if (error || !data) return { error: "Could not save the delivery address. Please try again." }
    return { address: { id: data.id as string, label, address, lat: input.lat, lng: input.lng } }
}

export async function deleteDeliveryAddress(id: string) {
    const { supabase, userId } = await getAddressClient()
    const { error } = await supabase.from("delivery_addresses").delete().eq("id", id).eq("customer_id", userId)
    return error ? { error: "Could not delete the delivery address. Please try again." } : {}
}

export interface MerchantDeliveryQuote {
    merchant_id: string
    store_name: string
    items: { product_id: string; quantity: number; price: number }[]
    fee: number
    subtotal: number
}

export async function quoteDeliveryAddress(addressId: string, items: { product_id: string; quantity: number }[]) {
    const { supabase } = await getAddressClient()
    const { data, error } = await supabase.rpc("delivery_checkout_plan", { p_address_id: addressId, p_items: items })
    if (error || !data?.length) {
        return {
            fee: 0, subtotal: 0, groups: [],
            error: error?.code === "P0001" ? error.message : "Delivery could not be priced for these items.",
        }
    }
    const groups = data as MerchantDeliveryQuote[]
    return {
        groups,
        fee: groups.reduce((sum, group) => sum + group.fee, 0),
        subtotal: groups.reduce((sum, group) => sum + group.subtotal, 0),
    }
}
