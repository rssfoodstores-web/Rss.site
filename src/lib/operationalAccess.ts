import type { SupabaseClient } from "@supabase/supabase-js"

export type OperationalRole = "agent" | "merchant" | "rider"

export async function getOperationalApprovalStatus(
    supabase: SupabaseClient,
    role: OperationalRole,
    userId: string
): Promise<string | null> {
    switch (role) {
        case "agent": {
            const { data } = await supabase
                .from("agent_profiles")
                .select("status")
                .eq("id", userId)
                .maybeSingle()

            return data?.status ?? null
        }
        case "merchant": {
            const { data } = await supabase
                .from("merchants")
                .select("status")
                .eq("id", userId)
                .maybeSingle()

            return data?.status ?? null
        }
        case "rider": {
            const { data } = await supabase
                .from("rider_profiles")
                .select("status")
                .eq("id", userId)
                .maybeSingle()

            return data?.status ?? null
        }
    }
}
