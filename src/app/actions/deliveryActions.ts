"use server"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import cloudinary from "@/lib/cloudinary"

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

export async function submitDeliveryApplication(formData: FormData) {
    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: "Not authenticated. Please sign in first." }
    }

    const full_name = formData.get("full_name") as string
    const phone = formData.get("phone") as string
    const address = formData.get("address") as string

    // Bike Details
    const bike_particulars: Record<string, string> = {}

    // Guarantor Details
    const guarantor_name = formData.get("guarantor_name") as string
    const guarantor_phone = formData.get("guarantor_phone") as string
    const guarantors: Record<string, any> = { name: guarantor_name, phone: guarantor_phone }

    // File Uploads
    const fileFields = [
        "passport_photo",
        "id_card_front",
        "id_card_back",
        "bike_license",
        "bike_insurance",
        "bike_roadworthiness",
        "guarantor_form",
        "guarantor_id"
    ]

    const uploadedUrls: Record<string, string> = {}

    for (const field of fileFields) {
        const file = formData.get(field) as File | null
        if (file && file.size > 0) {
            try {
                const arrayBuffer = await file.arrayBuffer()
                const buffer = Buffer.from(arrayBuffer)

                // Upload to Cloudinary
                const result = await new Promise<any>((resolve, reject) => {
                    const uploadStream = cloudinary.uploader.upload_stream(
                        { folder: `rssa/riders/${user.id}/${field}` },
                        (error, result) => {
                            if (error) reject(error)
                            else resolve(result)
                        }
                    )
                    uploadStream.end(buffer)
                })

                uploadedUrls[field] = result.secure_url
            } catch (uploadError) {
                console.error(`Error uploading ${field}:`, uploadError)
                return { error: `Failed to upload ${field.replace('_', ' ')}` }
            }
        }
    }

    // Map uploads to schema structure
    bike_particulars.license_url = uploadedUrls.bike_license
    bike_particulars.insurance_url = uploadedUrls.bike_insurance
    bike_particulars.roadworthiness_url = uploadedUrls.bike_roadworthiness

    guarantors.form_url = uploadedUrls.guarantor_form
    guarantors.id_url = uploadedUrls.guarantor_id

    const id_card_url = uploadedUrls.id_card_front // Using front as primary for now
    const passport_photo_url = uploadedUrls.passport_photo

    // 1. Update Profile (Phone, Address)
    await supabase.from("profiles").update({
        full_name,
        phone,
        address
    }).eq("id", user.id)

    // 2. Insert into rider_profiles
    const { error: riderError } = await supabase
        .from("rider_profiles")
        .upsert({
            id: user.id,
            status: "pending",
            bike_particulars,
            guarantors,
            id_card_url,
            passport_photo_url
        })

    if (riderError) {
        console.error("Rider profile error:", riderError)
        return { error: "Failed to save rider information: " + riderError.message }
    }

    // 3. Assign rider role (pending approval implies they have the role but limited access)
    const { error: roleError } = await supabase.from("user_roles").upsert({
        user_id: user.id,
        role: "rider"
    }, {
        onConflict: "user_id,role",
        ignoreDuplicates: true,
    })

    if (roleError) {
        return { error: "Failed to assign the rider role: " + roleError.message }
    }

    revalidatePath("/account")
    return { success: true }
}
