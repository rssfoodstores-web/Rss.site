import type { Database } from "@/types/database.types"

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"]

export function createEmptyProfileRow(userId: string, fullName?: string | null): ProfileRow {
    const normalizedName = fullName?.trim()

    return {
        address: null,
        avatar_url: null,
        company_name: null,
        full_name: normalizedName && normalizedName.length > 0 ? normalizedName : "Customer",
        house_number: null,
        id: userId,
        location: null,
        location_last_verified_at: null,
        location_locked: false,
        location_update_requested_at: null,
        phone: null,
        points_balance: 0,
        referral_code: null,
        referred_by: null,
        state: null,
        street_address: null,
        update_requested: false,
        updated_at: null,
        zip_code: null,
    }
}
