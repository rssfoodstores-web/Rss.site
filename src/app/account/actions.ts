"use server"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import type { Database } from "@/types/database.types"

type MerchantKycValue = string | null | Record<string, string>
type CloudinaryUploadResult = { secure_url: string }

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

    const getOptionalText = (field: string) => {
        const value = formData.get(field)

        if (typeof value !== "string") {
            return null
        }

        const trimmed = value.trim()
        return trimmed.length > 0 ? trimmed : null
    }

    const hasField = (field: string) => formData.has(field)

    const explicitFullName = getOptionalText("fullName")
    const firstName = getOptionalText("first_name")
    const lastName = getOptionalText("last_name")
    const combinedFullName = [firstName, lastName]
        .filter((value): value is string => Boolean(value))
        .join(" ")
        .trim()
    const fullName = explicitFullName ?? (combinedFullName || null)

    const addressFromSingleField = hasField("address") ? getOptionalText("address") : undefined
    const phone = hasField("phone") ? getOptionalText("phone") : undefined
    const companyName = hasField("company_name") ? getOptionalText("company_name") : undefined
    const zipCode = hasField("zip_code") ? getOptionalText("zip_code") : undefined
    const state = hasField("state") ? getOptionalText("state") : undefined
    const streetAddress = hasField("street_address") ? getOptionalText("street_address") : undefined
    const houseNumber = hasField("house_number") ? getOptionalText("house_number") : undefined

    let address = addressFromSingleField

    if (address === undefined && (
        hasField("house_number")
        || hasField("street_address")
        || hasField("state")
        || hasField("zip_code")
    )) {
        const lineOne = [houseNumber, streetAddress]
            .filter((value): value is string => Boolean(value))
            .join(" ")
            .trim()
        const lineTwo = [state, zipCode]
            .filter((value): value is string => Boolean(value))
            .join(" ")
            .trim()
        const combined = [lineOne, lineTwo]
            .filter((value) => value.length > 0)
            .join(", ")
            .trim()

        address = combined.length > 0 ? combined : null
    }

    const latitude = getOptionalText("latitude")
    const longitude = getOptionalText("longitude")
    const location = latitude && longitude
        ? `POINT(${longitude} ${latitude})`
        : undefined

    const updates: Database["public"]["Tables"]["profiles"]["Update"] = {
        updated_at: new Date().toISOString(),
    }

    if (fullName !== null) {
        updates.full_name = fullName
    }

    if (phone !== undefined) {
        updates.phone = phone
    }

    if (companyName !== undefined) {
        updates.company_name = companyName
    }

    if (zipCode !== undefined) {
        updates.zip_code = zipCode
    }

    if (state !== undefined) {
        updates.state = state
    }

    if (streetAddress !== undefined) {
        updates.street_address = streetAddress
    }

    if (houseNumber !== undefined) {
        updates.house_number = houseNumber
    }

    if (address !== undefined) {
        updates.address = address
    }

    if (location !== undefined) {
        updates.location = location
    }

    const { data: updatedProfile, error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id)
        .select("id")
        .maybeSingle()

    if (error) {
        return { error: error.message }
    }

    if (!updatedProfile) {
        return { error: "Profile not found for the authenticated user." }
    }

    if (fullName) {
        const { error: metadataError } = await supabase.auth.updateUser({
            data: { full_name: fullName },
        })

        if (metadataError) {
            console.error("Failed to sync auth user metadata after profile update:", metadataError)
        }
    }

    revalidatePath("/account")
    revalidatePath("/account/profile")
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
    const business_phone = formData.get("business_phone") as string
    const business_address = formData.get("business_address") as string
    const merchant_type = formData.get("merchant_type") as "business" | "individual"
    const getFormText = (field: string) => {
        const value = formData.get(field)
        return typeof value === "string" ? value : null
    }

    // KYC Data Extraction
    const kyc_data: Record<string, MerchantKycValue> = {}

    if (merchant_type === "business") {
        kyc_data.incorporation_date = getFormText("incorporation_date")
        kyc_data.rc_number = getFormText("rc_number")
        kyc_data.tin = getFormText("tin")
        // No bank account details in this form yet based on plan, but could be added
    } else {
        kyc_data.next_of_kin_name = getFormText("next_of_kin_name")
        kyc_data.next_of_kin_phone = getFormText("next_of_kin_phone")
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
                const result = await new Promise<CloudinaryUploadResult>((resolve, reject) => {
                    const uploadStream = cloudinary.uploader.upload_stream(
                        { folder: `rssa/merchants/${user.id}/${field}` },
                        (error, result) => {
                            if (error) {
                                reject(error)
                                return
                            }

                            if (!result?.secure_url) {
                                reject(new Error("Cloudinary upload did not return a secure URL"))
                                return
                            }

                            resolve({ secure_url: result.secure_url })
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
    if (owner_name || business_phone || business_address) {
        const { error: profileError } = await supabase.from("profiles").update({
            full_name: owner_name || undefined,
            phone: business_phone || undefined,
            address: business_address || undefined,
        }).eq("id", user.id)

        if (profileError) {
            return { error: `Unable to update your profile before merchant submission: ${profileError.message}` }
        }
    }

    if (owner_name?.trim()) {
        const { error: metadataError } = await supabase.auth.updateUser({
            data: { full_name: owner_name.trim() },
        })

        if (metadataError) {
            console.error("Merchant auth metadata sync error:", metadataError)
        }
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
            kyc_data: {
                ...kyc_data,
                business_email,
                owner_email: getFormText("owner_email"),
            },
            updated_at: new Date().toISOString(),
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

