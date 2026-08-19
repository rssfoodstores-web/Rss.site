import { NextResponse } from "next/server"
import { isValidE164PhoneNumber, normalizePhoneNumber } from "@/lib/phone"
import { createAdminClient } from "@/lib/supabase/admin"

interface PhoneRegisterInput {
    fullName?: string
    password?: string
    phone?: string
    referralCode?: string
}

interface PhoneRegisterResult {
    error?: string
    success?: true
    user?: {
        id: string
        phone: string
    }
}

function json(result: PhoneRegisterResult, status = 200) {
    return NextResponse.json(result, { status })
}

async function cleanupCreatedAuthUser(userId: string) {
    let adminSupabase: ReturnType<typeof createAdminClient>

    try {
        adminSupabase = createAdminClient()
    } catch {
        return
    }

    await adminSupabase.from("user_roles").delete().eq("user_id", userId)
    await adminSupabase.from("profiles").delete().eq("id", userId)
    await adminSupabase.auth.admin.deleteUser(userId)
}

export async function POST(request: Request) {
    let input: PhoneRegisterInput

    try {
        input = await request.json() as PhoneRegisterInput
    } catch {
        return json({ error: "Invalid registration request." }, 400)
    }

    const fullName = (input.fullName ?? "").trim()
    const password = (input.password ?? "").trim()
    const phone = normalizePhoneNumber(input.phone ?? "")
    const referralCode = (input.referralCode ?? "").trim().toUpperCase()

    if (!fullName) {
        return json({ error: "Enter your full name." }, 400)
    }

    if (!isValidE164PhoneNumber(phone)) {
        return json({ error: "Enter a valid phone number." }, 400)
    }

    if (password.length < 6) {
        return json({ error: "Password must be at least 6 characters." }, 400)
    }

    let adminSupabase: ReturnType<typeof createAdminClient>

    try {
        adminSupabase = createAdminClient()
    } catch (error) {
        return json({
            error: error instanceof Error ? error.message : "Supabase admin credentials are not configured.",
        }, 500)
    }

    const { data: created, error: createError } = await adminSupabase.auth.admin.createUser({
        password,
        phone,
        phone_confirm: true,
        user_metadata: {
            full_name: fullName,
            referred_by_code: referralCode || undefined,
        },
    })

    if (createError || !created.user) {
        return json({
            error: createError?.message ?? "Supabase did not return the created user.",
        }, 400)
    }

    const userId = created.user.id
    const { error: profileError } = await adminSupabase
        .from("profiles")
        .upsert(
            {
                full_name: fullName,
                id: userId,
                phone,
                updated_at: new Date().toISOString(),
            },
            {
                onConflict: "id",
            }
        )

    if (profileError) {
        await cleanupCreatedAuthUser(userId)
        return json({ error: profileError.message }, 400)
    }

    const { error: roleError } = await adminSupabase
        .from("user_roles")
        .insert({
            role: "customer",
            user_id: userId,
        })

    if (roleError) {
        await cleanupCreatedAuthUser(userId)
        return json({ error: roleError.message }, 400)
    }

    return json({
        success: true,
        user: {
            id: userId,
            phone,
        },
    }, 201)
}
