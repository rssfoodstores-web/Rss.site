import type { SupabaseClient } from "@supabase/supabase-js"

export function getSafeNextPath(nextPath: string | null | undefined) {
    if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
        return null
    }

    return nextPath
}

export async function resolvePostAuthPath(
    supabase: SupabaseClient,
    userId: string,
    explicitNextPath?: string | null
) {
    const nextPath = getSafeNextPath(explicitNextPath)

    if (nextPath && nextPath !== "/") {
        return nextPath
    }

    const [{ data: roles }, { data: merchant }, { data: agent }, { data: rider }] = await Promise.all([
        supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", userId),
        supabase
            .from("merchants")
            .select("id")
            .eq("id", userId)
            .maybeSingle(),
        supabase
            .from("agent_profiles")
            .select("id")
            .eq("id", userId)
            .maybeSingle(),
        supabase
            .from("rider_profiles")
            .select("id")
            .eq("id", userId)
            .maybeSingle(),
    ])

    const roleNames = new Set((roles ?? []).map((roleRow: { role: string }) => roleRow.role))

    if (roleNames.has("merchant") || merchant) {
        return "/merchant"
    }

    if (roleNames.has("agent") || agent) {
        return "/agent"
    }

    if (roleNames.has("rider") || rider) {
        return "/rider"
    }

    return nextPath ?? "/"
}
