"use server"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import type { RiderDocumentField } from "@/app/actions/applicationDocumentActions"

interface RiderGuarantor {
    form_url?: string
    id_url?: string
    name: string
    phone: string
}

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
    const guarantors: RiderGuarantor = { name: guarantor_name, phone: guarantor_phone }

    const fileFields: RiderDocumentField[] = [
        "passport_photo",
        "id_card_front",
        "id_card_back",
        "bike_license",
        "bike_insurance",
        "bike_roadworthiness",
        "guarantor_form",
        "guarantor_id"
    ]

    let submittedDocuments: Record<string, { publicId?: string; secureUrl?: string }> = {}
    try {
        const rawDocuments = formData.get("rider_documents")
        if (typeof rawDocuments === "string") {
            const parsed: unknown = JSON.parse(rawDocuments)
            if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
                return { error: "The uploaded document details could not be read. Please upload them again." }
            }
            submittedDocuments = parsed as Record<string, { publicId?: string; secureUrl?: string }>
        }
    } catch {
        return { error: "The uploaded document details could not be read. Please upload them again." }
    }

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
    const uploadedUrls: Record<string, string> = {}
    for (const [field, document] of Object.entries(submittedDocuments)) {
        if (
            !fileFields.includes(field as RiderDocumentField)
            || !document
            || typeof document.publicId !== "string"
            || typeof document.secureUrl !== "string"
        ) {
            return { error: "One of the uploaded documents is invalid. Please upload it again." }
        }

        let uploadedUrl: URL
        try {
            uploadedUrl = new URL(document.secureUrl)
        } catch {
            return { error: "One of the uploaded documents has an invalid link. Please upload it again." }
        }

        const expectedFolder = `rssa/riders/${user.id}/${field}/`
        if (
            !cloudName
            || uploadedUrl.protocol !== "https:"
            || uploadedUrl.hostname !== "res.cloudinary.com"
            || !uploadedUrl.pathname.includes(`/${cloudName}/`)
            || !document.publicId.startsWith(expectedFolder)
            || !uploadedUrl.pathname.includes(document.publicId)
        ) {
            return { error: "One of the uploaded documents could not be verified. Please upload it again." }
        }

        uploadedUrls[field] = document.secureUrl
    }

    const requiredDocumentFields: RiderDocumentField[] = [
        "passport_photo",
        "id_card_front",
        "bike_license",
        "bike_insurance",
        "bike_roadworthiness",
        "guarantor_form",
        "guarantor_id",
    ]
    const missingDocument = requiredDocumentFields.find((field) => !uploadedUrls[field])
    if (missingDocument) {
        return { error: `Please upload ${missingDocument.replaceAll("_", " ")} before submitting.` }
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
    const { error: profileError } = await supabase.from("profiles").update({
        full_name,
        phone,
        address
    }).eq("id", user.id)

    if (profileError) {
        console.error("Rider profile sync error:", profileError)
        return { error: "Failed to update your account profile: " + profileError.message }
    }

    if (full_name.trim()) {
        const { error: metadataError } = await supabase.auth.updateUser({
            data: { full_name: full_name.trim() },
        })

        if (metadataError) {
            console.error("Rider auth metadata sync error:", metadataError)
        }
    }

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

