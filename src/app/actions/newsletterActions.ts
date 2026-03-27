"use server"

import { createClient } from "@/lib/supabase/server"

interface SubscribeResult {
    created: boolean
    success: boolean
}

function normalizeEmail(value: unknown) {
    const normalized = typeof value === "string" ? value.trim().toLowerCase() : ""

    if (!normalized) {
        throw new Error("Email address is required.")
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!emailPattern.test(normalized)) {
        throw new Error("Enter a valid email address.")
    }

    return normalized
}

export async function subscribeToNewsletter(input: { email: string; source?: string }): Promise<SubscribeResult> {
    const supabase = await createClient()
    const email = normalizeEmail(input.email)
    const source = typeof input.source === "string" && input.source.trim() ? input.source.trim() : "footer"

    const { error } = await supabase
        .from("newsletter_subscriptions")
        .insert({
            email,
            source,
        })

    if (!error) {
        return { created: true, success: true }
    }

    const duplicateSubscription = error.code === "23505"

    if (duplicateSubscription) {
        return { created: false, success: true }
    }

    if (error.code === "42P01") {
        throw new Error("Newsletter subscriptions are not configured yet. Apply the latest migration first.")
    }

    throw new Error(error.message)
}
