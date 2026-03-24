"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

interface MerchantLocationPolicy {
    request_cooldown_enabled: boolean
    request_cooldown_hours: number
}

const DEFAULT_MERCHANT_LOCATION_POLICY: MerchantLocationPolicy = {
    request_cooldown_enabled: true,
    request_cooldown_hours: 168,
}

function normalizeMerchantLocationPolicy(value: unknown): MerchantLocationPolicy {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return DEFAULT_MERCHANT_LOCATION_POLICY
    }

    const record = value as Record<string, unknown>
    const requestCooldownEnabled = typeof record.request_cooldown_enabled === "boolean"
        ? record.request_cooldown_enabled
        : DEFAULT_MERCHANT_LOCATION_POLICY.request_cooldown_enabled
    const requestCooldownHours = Number(record.request_cooldown_hours)

    return {
        request_cooldown_enabled: requestCooldownEnabled,
        request_cooldown_hours: Number.isFinite(requestCooldownHours) && requestCooldownHours >= 0
            ? requestCooldownHours
            : DEFAULT_MERCHANT_LOCATION_POLICY.request_cooldown_hours,
    }
}

export async function verifyMerchantLocation(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: "Not authenticated" }
    }

    const state = formData.get("state") as string
    const city = formData.get("city") as string // Note: profiles table might not have explicit city column, mapping to address or custom?
    // Looking at schema: state, zip_code, street_address, house_number exist. City might need to go into address or a new column.
    // For now I'll append city to the legacy address field or just rely on state/street.
    // User asked for "city states etc". 
    // I will append City to the 'address' string for legacy, and maybe street_address.

    const street_address = formData.get("street_address") as string
    const house_number = formData.get("house_number") as string
    const zip_code = formData.get("zip_code") as string

    // Construct simplified address for display if needed
    const address = `${house_number} ${street_address}, ${city}, ${state} ${zip_code}`.trim()

    const lat = formData.get("latitude")
    const long = formData.get("longitude")
    let location = null

    if (lat && long) {
        location = `POINT(${long} ${lat})`
    } else {
        return { error: "Geolocation is required. Please enable location services." }
    }

    const { data: profile, error: profileLookupError } = await supabase
        .from("profiles")
        .select("location_locked, location")
        .eq("id", user.id)
        .maybeSingle()

    if (profileLookupError) {
        return { error: profileLookupError.message }
    }

    if (profile?.location_locked && profile.location) {
        return { error: "Your store location is locked. Request edit access before changing it again." }
    }

    const [{ error: profileError }, { error: merchantError }] = await Promise.all([
        supabase
            .from("profiles")
            .update({
                state,
                street_address,
                house_number,
                zip_code,
                address,
                location,
                location_locked: true,
                update_requested: false,
                location_last_verified_at: new Date().toISOString(),
            })
            .eq("id", user.id),
        supabase
            .from("merchants")
            .update({
                business_address: address,
                location,
            })
            .eq("id", user.id),
    ])

    if (profileError || merchantError) {
        return { error: profileError?.message ?? merchantError?.message ?? "Unable to save merchant location." }
    }

    revalidatePath("/merchant/verify-location")
    revalidatePath("/merchant")
    revalidatePath("/merchant/products")
    return { success: true }
}

export async function requestLocationUpdate() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: "Unauthorized" }
    }

    const [{ data: profile, error: profileError }, { data: policySetting, error: policyError }] = await Promise.all([
        supabase
            .from("profiles")
            .select("location_locked, update_requested, location_update_requested_at")
            .eq("id", user.id)
            .maybeSingle(),
        supabase
            .from("app_settings")
            .select("value")
            .eq("key", "merchant_location_policy")
            .maybeSingle(),
    ])

    if (profileError || policyError) {
        console.error("Request update preload error:", profileError ?? policyError)
        return { error: profileError?.message ?? policyError?.message ?? "Unable to check location request policy." }
    }

    if (!profile?.location_locked) {
        return { error: "Location edit access is already available. Save your new store location now." }
    }

    if (profile.update_requested) {
        return { error: "Your last location update request is still pending admin review." }
    }

    const policy = normalizeMerchantLocationPolicy(policySetting?.value)
    const lastRequestedAt = profile.location_update_requested_at ? new Date(profile.location_update_requested_at) : null

    if (policy.request_cooldown_enabled && lastRequestedAt && Number.isFinite(policy.request_cooldown_hours) && policy.request_cooldown_hours > 0) {
        const nextAllowedAt = new Date(lastRequestedAt.getTime() + (policy.request_cooldown_hours * 60 * 60 * 1000))

        if (Date.now() < nextAllowedAt.getTime()) {
            return {
                error: `You can request another location change after ${nextAllowedAt.toLocaleString()}.`,
            }
        }
    }

    const { error } = await supabase
        .from("profiles")
        .update({
            update_requested: true,
            location_update_requested_at: new Date().toISOString(),
        })
        .eq("id", user.id)

    if (error) {
        console.error("Request update error:", error)
        return { error: "Failed to submit request" }
    }

    revalidatePath("/merchant/verify-location", "page")
    revalidatePath("/merchant/products", "page")
    return { success: true }
}
