import { redirect } from "next/navigation"
import { VerifyLocationClient } from "@/components/merchant/VerifyLocationClient"
import { createClient } from "@/lib/supabase/server"

export default async function VerifyLocationPage() {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect("/login")
    }

    const [{ data: profile, error: profileError }, { data: merchant, error: merchantError }] = await Promise.all([
        supabase
            .from("profiles")
            .select("location_locked, update_requested, location, state, street_address, house_number, zip_code, address")
            .eq("id", user.id)
            .maybeSingle(),
        supabase
            .from("merchants")
            .select("business_address")
            .eq("id", user.id)
            .maybeSingle(),
    ])

    if (profileError) {
        throw new Error(profileError.message)
    }

    if (merchantError) {
        throw new Error(merchantError.message)
    }

    const currentAddressLabel = merchant?.business_address
        ?? profile?.address
        ?? [profile?.house_number, profile?.street_address, profile?.state, profile?.zip_code].filter(Boolean).join(", ")
        ?? null

    return (
        <VerifyLocationClient
            initialState={{
                isLocked: Boolean(profile?.location_locked),
                updateRequested: Boolean(profile?.update_requested),
                hasExistingLocation: Boolean(profile?.location) || Boolean(profile?.street_address) || Boolean(profile?.house_number) || Boolean(currentAddressLabel),
                state: profile?.state ?? "",
                city: "",
                street: profile?.street_address ?? "",
                houseNumber: profile?.house_number ?? "",
                zipCode: profile?.zip_code ?? "",
                currentAddressLabel: currentAddressLabel || null,
            }}
        />
    )
}
