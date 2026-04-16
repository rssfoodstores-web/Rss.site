"use server"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import cloudinary from "@/lib/cloudinary"

interface CloudinaryUploadResult {
    secure_url: string
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

export async function registerAgent(formData: FormData) {
    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: "Not authenticated. Please sign in first." }
    }

    const fullName = formData.get("fullName") as string
    const phone = formData.get("phone") as string
    const address = formData.get("address") as string // New field

    // Bank Details
    const bankDetails = {
        bankName: formData.get("bankName") as string,
        accountNumber: formData.get("accountNumber") as string,
        accountName: formData.get("accountName") as string
    }

    // Guarantor Details
    const guarantor1 = {
        name: formData.get("guarantor1Name") as string,
        phone: formData.get("guarantor1Phone") as string,
        address: formData.get("guarantor1Address") as string // Added address for better verification
    }

    const guarantor2 = {
        name: formData.get("guarantor2Name") as string,
        phone: formData.get("guarantor2Phone") as string,
        address: formData.get("guarantor2Address") as string
    }

    const guarantors = { guarantor1, guarantor2 }

    let id_card_url = ""

    const file = formData.get("idCard") as File | null
    if (file && file.size > 0) {
        try {
            const arrayBuffer = await file.arrayBuffer()
            const buffer = Buffer.from(arrayBuffer)

            // Upload to Cloudinary
            const result = await new Promise<CloudinaryUploadResult>((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    { folder: `rssa/agents/${user.id}/id_card` },
                    (error, result) => {
                        if (error || !result?.secure_url) {
                            reject(error ?? new Error("Upload failed"))
                            return
                        }

                        resolve({
                            secure_url: result.secure_url,
                        })
                    }
                )
                uploadStream.end(buffer)
            })

            id_card_url = result.secure_url

        } catch (uploadError) {
            console.error("Error uploading ID Card:", uploadError)
            return { error: "Failed to upload ID Card" }
        }
    }

    // 1. Update Profile (Phone, Address, potentially Full Name if allowed)
    // We only update what's missing or if we treat this as source of truth
    const { error: profileError } = await supabase.from("profiles").update({
        full_name: fullName,
        phone: phone,
        address: address
    }).eq("id", user.id)

    if (profileError) {
        console.error("Agent profile sync error:", profileError)
        return { error: "Failed to update your account profile: " + profileError.message }
    }

    if (fullName.trim()) {
        const { error: metadataError } = await supabase.auth.updateUser({
            data: { full_name: fullName.trim() },
        })

        if (metadataError) {
            console.error("Agent auth metadata sync error:", metadataError)
        }
    }

    // 2. Insert into agent_profiles
    const { error: agentError } = await supabase
        .from("agent_profiles")
        .upsert({
            id: user.id,
            status: "pending",
            bank_details: bankDetails,
            guarantors: guarantors,
            id_card_url: id_card_url,
            updated_at: new Date().toISOString(),
        })

    if (agentError) {
        console.error("Agent profile error:", agentError)
        return { error: "Failed to save agent information: " + agentError.message }
    }

    // 3. Assign 'agent' role
    const { error: roleError } = await supabase.from("user_roles").upsert({
        user_id: user.id,
        role: "agent"
    }, {
        onConflict: "user_id,role",
        ignoreDuplicates: true,
    })

    if (roleError) {
        return { error: "Failed to assign the agent role: " + roleError.message }
    }

    revalidatePath("/account")
    return { success: true }
}
