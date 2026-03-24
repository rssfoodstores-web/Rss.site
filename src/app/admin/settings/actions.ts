"use server"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import type { Json } from "@/types/database.types"

async function getSupabase() {
    const cookieStore = await cookies()
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                        // Managed by Middleware
                    }
                },
            },
        }
    )
}

async function checkAdmin() {
    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect("/login")

    const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["admin", "supa_admin"])
        .single()

    if (!roleData) {
        throw new Error("Unauthorized: Admin access required")
    }

    return user
}

export async function getSettings() {
    await checkAdmin()
    const supabase = await getSupabase()

    const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .neq("key", "referral_commission_bps")
        .neq("key", "reward_system_settings")
        .neq("key", "contact_page_content")
        .neq("key", "support_ai_settings")
        .order("key")

    if (error) throw new Error(error.message)
    return data
}

export async function updateSetting(key: string, value: Json) {
    await checkAdmin()
    const supabase = await getSupabase()

    // Validate based on key if necessary
    // e.g. ensure numerical values for points

    const { error } = await supabase
        .from("app_settings")
        .update({ value })
        .eq("key", key)

    if (error) throw new Error(error.message)

    revalidatePath("/admin/settings")
    return { success: true }
}
