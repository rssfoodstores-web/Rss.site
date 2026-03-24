import type { SupabaseClient } from "@supabase/supabase-js"

export interface MerchantProductPostingAccess {
    locationLocked: boolean
    locationPresent: boolean
    locationReady: boolean
    locationEditingUnlocked: boolean
    updateRequested: boolean
    addressLabel: string | null
    statusMessage: string
}

export async function getMerchantProductPostingAccess(
    supabase: SupabaseClient,
    userId: string
): Promise<MerchantProductPostingAccess> {
    const [{ data: profile, error: profileError }, { data: merchant, error: merchantError }] = await Promise.all([
        supabase
            .from("profiles")
            .select("location_locked, update_requested, location, address, location_update_requested_at")
            .eq("id", userId)
            .maybeSingle(),
        supabase
            .from("merchants")
            .select("location, business_address")
            .eq("id", userId)
            .maybeSingle(),
    ])

    if (profileError) {
        throw profileError
    }

    if (merchantError) {
        throw merchantError
    }

    const locationLocked = Boolean(profile?.location_locked)
    const updateRequested = Boolean(profile?.update_requested)
    const locationPresent = Boolean(profile?.location) || Boolean(merchant?.location)
    const locationReady = locationLocked && locationPresent
    const locationEditingUnlocked = !locationLocked && locationPresent && !updateRequested
    const addressLabel = merchant?.business_address ?? profile?.address ?? null

    return {
        locationLocked,
        locationPresent,
        locationReady,
        locationEditingUnlocked,
        updateRequested,
        addressLabel,
        statusMessage: updateRequested
            ? "Location update request pending admin approval."
            : locationReady
                ? "Store location verified. Product posting is enabled."
                : locationEditingUnlocked
                    ? "Location edit access approved. Save your new store location to re-enable product posting."
                    : locationPresent
                        ? "Finish store location verification before posting products."
                        : "Add and verify your store location before posting products.",
    }
}

export async function assertMerchantCanPostProducts(supabase: SupabaseClient, userId: string) {
    const access = await getMerchantProductPostingAccess(supabase, userId)

    if (!access.locationReady) {
        throw new Error("Verify your store location before posting products.")
    }

    return access
}
