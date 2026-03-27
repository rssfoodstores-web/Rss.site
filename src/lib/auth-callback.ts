import type { SupabaseClient } from "@supabase/supabase-js"
import { resolvePostAuthPath } from "@/lib/auth-redirects"

export async function applyReferralCodeIfNeeded(
    supabase: SupabaseClient,
    referralCode: string | null
) {
    if (!referralCode) {
        return
    }

    try {
        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
            return
        }

        const { data: profile } = await supabase
            .from("profiles")
            .select("referred_by")
            .eq("id", user.id)
            .single()

        if (!profile || profile.referred_by) {
            return
        }

        const { data: referrer } = await supabase
            .from("profiles")
            .select("id")
            .eq("referral_code", referralCode)
            .maybeSingle()

        if (referrer && referrer.id !== user.id) {
            await supabase
                .from("profiles")
                .update({ referred_by: referrer.id })
                .eq("id", user.id)
                .is("referred_by", null)
        }
    } catch (referralError) {
        console.error("Failed to apply referral code in auth callback:", referralError)
    }
}

export async function resolveAuthenticatedDestination(
    supabase: SupabaseClient,
    next: string | null | undefined
) {
    let destination = next ?? "/"

    try {
        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (user) {
            destination = await resolvePostAuthPath(supabase, user.id, next)
        }
    } catch (destinationError) {
        console.error("Failed to resolve post-auth destination:", destinationError)
    }

    return destination
}

export function isPkceCodeVerifierMissingError(error: { message?: string | null; name?: string | null } | null | undefined) {
    const message = error?.message ?? ""
    const name = error?.name ?? ""

    return name === "AuthPKCECodeVerifierMissingError"
        || message.toLowerCase().includes("pkce code verifier not found")
}
