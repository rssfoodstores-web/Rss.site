"use server"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"

// Initialize Supabase Server Client
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
                        // Server Component context
                    }
                },
            },
        }
    )
}

export async function updateProfile(formData: FormData) {
    // Legacy action, keeping for compatibility if needed, but primary logic moves to detailed
    return updateProfileDetailed(formData)
}

export async function updateProfileDetailed(formData: FormData) {
    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: "Not authenticated" }
    }

    const first_name = formData.get("first_name") as string
    const last_name = formData.get("last_name") as string
    const full_name = `${first_name} ${last_name}`.trim()

    const phone = formData.get("phone") as string
    const company_name = formData.get("company_name") as string
    const zip_code = formData.get("zip_code") as string
    const state = formData.get("state") as string
    const street_address = formData.get("street_address") as string
    const house_number = formData.get("house_number") as string

    // Construct full address for legacy support
    const address = `${house_number} ${street_address}, ${state} ${zip_code}`.trim()

    // Handle Location (lat, long)
    const lat = formData.get("latitude")
    const long = formData.get("longitude")
    let location = null

    if (lat && long) {
        // PostGIS format: POINT(long lat)
        location = `POINT(${long} ${lat})`
    }

    const { error } = await supabase
        .from("profiles")
        .update({
            full_name,
            phone,
            company_name,
            zip_code,
            state,
            street_address,
            house_number,
            address, // Sync to legacy column
            ...(location && { location }) // Only update if provided
        })
        .eq("id", user.id)

    if (error) {
        return { error: error.message }
    }

    revalidatePath("/account")
    return { success: true }
}


export async function assignRole(role: "customer" | "merchant" | "rider" | "admin" | "agent" | "supa_admin" | "sub_admin") {
    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: "Not authenticated" }
    }

    // Check if role already exists
    const { data: existingRole } = await supabase
        .from("user_roles")
        .select("*")
        .eq("user_id", user.id)
        .eq("role", role)
        .single()

    if (existingRole) {
        return { error: "Role already assigned" }
    }

    const { error } = await supabase
        .from("user_roles")
        .insert({
            user_id: user.id,
            role: role
        })

    if (error) {
        return { error: error.message }
    }

    revalidatePath("/account")
    return { success: true }
}

export async function updateAvatar(url: string) {
    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: "Not authenticated" }
    }

    const { error } = await supabase
        .from("profiles")
        .update({
            avatar_url: url,
            updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)

    if (error) {
        return { error: error.message }
    }

    revalidatePath("/account")
    return { success: true }
}

import cloudinary from "@/lib/cloudinary"

export async function registerMerchant(formData: FormData) {
    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: "Not authenticated" }
    }

    const store_name = formData.get("store_name") as string
    const business_email = formData.get("business_email") as string
    const owner_name = formData.get("owner_name") as string
    const owner_email = formData.get("owner_email") as string
    const business_phone = formData.get("business_phone") as string
    const business_address = formData.get("business_address") as string
    const merchant_type = formData.get("merchant_type") as "business" | "individual"

    // KYC Data Extraction
    const kyc_data: Record<string, any> = {}

    if (merchant_type === "business") {
        kyc_data.incorporation_date = formData.get("incorporation_date")
        kyc_data.rc_number = formData.get("rc_number") // Optional
        kyc_data.tin = formData.get("tin")
        // No bank account details in this form yet based on plan, but could be added
    } else {
        kyc_data.next_of_kin_name = formData.get("next_of_kin_name")
        kyc_data.next_of_kin_phone = formData.get("next_of_kin_phone")
    }

    // Handle File Uploads
    const documents: Record<string, string> = {}
    const fileFields = [
        "cac_certificate", "cac_form_1_1", "director_id", // Business
        "valid_id", "utility_bill", // Individual
        "food_handler_certificate", "kitchen_photo" // Common
    ]

    for (const field of fileFields) {
        const file = formData.get(field) as File | null
        if (file && file.size > 0) {
            try {
                const arrayBuffer = await file.arrayBuffer()
                const buffer = Buffer.from(arrayBuffer)

                // Upload to Cloudinary
                const result = await new Promise<any>((resolve, reject) => {
                    const uploadStream = cloudinary.uploader.upload_stream(
                        { folder: `rssa/merchants/${user.id}/${field}` },
                        (error, result) => {
                            if (error) reject(error)
                            else resolve(result)
                        }
                    )
                    uploadStream.end(buffer)
                })

                documents[field] = result.secure_url
            } catch (uploadError) {
                console.error(`Error uploading ${field}:`, uploadError)
                return { error: `Failed to upload ${field.replace('_', ' ')}` }
            }
        }
    }

    kyc_data.documents = documents

    // Default values
    const category = "Other"
    const store_description = `Business Email: ${business_email}`

    // 1. Update profile name and phone if provided
    if (owner_name || business_phone) {
        await supabase.from("profiles").update({
            full_name: owner_name || undefined,
            phone: business_phone || undefined
        }).eq("id", user.id)
    }

    // 2. Insert/Update merchants table
    const { error: merchantError } = await supabase
        .from("merchants")
        .upsert({
            id: user.id,
            store_name,
            category,
            store_description,
            business_address,
            status: 'pending', // Pending approval
            merchant_type,
            kyc_data
        })

    if (merchantError) {
        return { error: merchantError.message }
    }

    // 3. Assign 'merchant' role 
    // Note: In real flows, role assignment might wait for KYC approval. 
    // Here we assign it immediately or maybe 'applicant' role? 
    // Sticking to 'merchant' for now but status is 'pending'.
    const { error: roleError } = await supabase
        .from("user_roles")
        .upsert({
            user_id: user.id,
            role: 'merchant'
        }, {
            onConflict: "user_id,role",
            ignoreDuplicates: true,
        })

    if (roleError) {
        return { error: `Merchant role assignment failed: ${roleError.message}` }
    }

    revalidatePath("/account")
    return { success: true }
}

