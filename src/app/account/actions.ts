"use server"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import type { Database } from "@/types/database.types"

type MerchantKycValue = string | null | Record<string, string>
type MerchantDocumentField =
    | "cac_certificate"
    | "cac_form_1_1"
    | "director_id"
    | "valid_id"
    | "utility_bill"
    | "food_handler_certificate"
    | "kitchen_photo"

const MERCHANT_DOCUMENT_FIELDS = new Set<MerchantDocumentField>([
    "cac_certificate",
    "cac_form_1_1",
    "director_id",
    "valid_id",
    "utility_bill",
    "food_handler_certificate",
    "kitchen_photo",
])

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

function sanitizeMerchantDocumentName(fileName: string) {
    return fileName
        .replace(/\.[^/.]+$/, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40) || "document"
}

export async function createMerchantDocumentUploadSignature(field: MerchantDocumentField, fileName: string) {
    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error("Sign in again to upload your documents.")
    if (!MERCHANT_DOCUMENT_FIELDS.has(field)) throw new Error("This document type is not supported.")

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
    const apiKey = process.env.CLOUDINARY_API_KEY
    const apiSecret = process.env.CLOUDINARY_API_SECRET

    if (!cloudName || !apiKey || !apiSecret) {
        throw new Error("Document uploads are temporarily unavailable. Please contact support.")
    }

    const folder = `rssa/merchants/${user.id}/${field}`
    const publicId = `merchant-${Date.now()}-${crypto.randomUUID()}-${sanitizeMerchantDocumentName(fileName)}`
    const timestamp = Math.floor(Date.now() / 1000)
    const signature = cloudinary.utils.api_sign_request({ folder, public_id: publicId, timestamp }, apiSecret)

    return { apiKey, cloudName, folder, publicId, signature, timestamp }
}

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
    const merchant_type = formData.get("merchant_type")
    if (merchant_type !== "business" && merchant_type !== "individual") {
        return { error: "Choose whether you are registering a business or an individual store." }
    }
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

    const submittedDocuments = getFormText("merchant_documents")
    let uploadedDocuments: Record<string, { publicId: string; secureUrl: string }> = {}

    try {
        const parsedDocuments: unknown = submittedDocuments ? JSON.parse(submittedDocuments) : {}
        if (!parsedDocuments || typeof parsedDocuments !== "object" || Array.isArray(parsedDocuments)) {
            return { error: "The uploaded document details could not be read. Please try again." }
        }
        uploadedDocuments = parsedDocuments as Record<string, { publicId: string; secureUrl: string }>
    } catch {
        return { error: "The uploaded document details could not be read. Please try again." }
    }

    const documents: Record<string, string> = {}
    for (const [field, document] of Object.entries(uploadedDocuments)) {
        if (
            !MERCHANT_DOCUMENT_FIELDS.has(field as MerchantDocumentField)
            || !document
            || typeof document.publicId !== "string"
            || typeof document.secureUrl !== "string"
            || !document.publicId
            || !document.secureUrl
        ) {
            return { error: "One of the uploaded documents is invalid. Please upload it again." }
        }

        const expectedFolder = `rssa/merchants/${user.id}/${field}/`
        let uploadedUrl: URL
        try {
            uploadedUrl = new URL(document.secureUrl)
        } catch {
            return { error: "One of the uploaded documents has an invalid link. Please upload it again." }
        }

        const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
        if (!cloudName || uploadedUrl.protocol !== "https:" || uploadedUrl.hostname !== "res.cloudinary.com" || !uploadedUrl.pathname.includes(`/${cloudName}/`)) {
            return { error: "One of the uploaded documents could not be verified. Please upload it again." }
        }

        if (!document.publicId.startsWith(expectedFolder)) {
            return { error: "One of the uploaded documents does not belong to this application. Please upload it again." }
        }

        if (!uploadedUrl.pathname.includes(document.publicId)) {
            return { error: "One of the uploaded documents could not be matched to your application. Please upload it again." }
        }

        documents[field] = document.secureUrl
    }

    const requiredDocumentFields = merchant_type === "business"
        ? ["cac_certificate", "cac_form_1_1", "director_id", "kitchen_photo"]
        : ["valid_id", "utility_bill", "kitchen_photo"]
    const missingDocument = requiredDocumentFields.find((field) => !documents[field])
    if (missingDocument) {
        return { error: `Please upload ${missingDocument.replaceAll("_", " ")} before submitting.` }
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

