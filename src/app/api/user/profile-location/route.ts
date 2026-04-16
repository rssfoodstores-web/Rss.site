import { NextResponse } from "next/server"
import { getDeliverySettings } from "@/app/actions/settingsActions"
import { parseCoordinates } from "@/lib/directions"
import { createClient } from "@/lib/supabase/server"

interface ProfileLocationRow {
    address: string | null
    house_number: string | null
    location: unknown
    phone: string | null
    state: string | null
    street_address: string | null
    zip_code: string | null
}

function buildAddressLabel(profile: ProfileLocationRow | null) {
    if (!profile) {
        return ""
    }

    const detailedAddress = [
        profile.house_number?.trim(),
        profile.street_address?.trim(),
        profile.state?.trim(),
        profile.zip_code?.trim(),
    ]
        .filter(Boolean)
        .join(", ")

    return detailedAddress || profile.address?.trim() || ""
}

function buildPhoneNumbers(phone: string | null) {
    const trimmedPhone = phone?.trim()
    const numbers = trimmedPhone ? [trimmedPhone] : []

    while (numbers.length < 3) {
        numbers.push("")
    }

    return numbers
}

export async function GET() {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    }

    const [settings, profileResult] = await Promise.all([
        getDeliverySettings(),
        supabase
            .from("profiles")
            .select("address, house_number, location, phone, state, street_address, zip_code")
            .eq("id", user.id)
            .maybeSingle(),
    ])

    if (profileResult.error) {
        return NextResponse.json({ error: profileResult.error.message }, { status: 500 })
    }

    const profile = (profileResult.data ?? null) as ProfileLocationRow | null
    const location = parseCoordinates(profile?.location ?? null)

    return NextResponse.json({
        address: buildAddressLabel(profile),
        location,
        phone_numbers: buildPhoneNumbers(profile?.phone ?? null),
        settings,
    })
}
