"use server"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import cloudinary from "@/lib/cloudinary"

export type RiderDocumentField =
    | "passport_photo"
    | "id_card_front"
    | "id_card_back"
    | "bike_license"
    | "bike_insurance"
    | "bike_roadworthiness"
    | "guarantor_form"
    | "guarantor_id"

const RIDER_DOCUMENT_FIELDS = new Set<RiderDocumentField>([
    "passport_photo",
    "id_card_front",
    "id_card_back",
    "bike_license",
    "bike_insurance",
    "bike_roadworthiness",
    "guarantor_form",
    "guarantor_id",
])

const ALLOWED_DOCUMENT_EXTENSION = /\.(pdf|jpe?g|png)$/i

async function getAuthenticatedUserId() {
    const cookieStore = await cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll: () => cookieStore.getAll(),
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
                    } catch {
                        // Server Component context
                    }
                },
            },
        }
    )
    const { data: { user } } = await supabase.auth.getUser()
    return user?.id ?? null
}

function sanitizeFileName(fileName: string) {
    return fileName
        .replace(/\.[^/.]+$/, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40) || "document"
}

async function createApplicationDocumentUploadSignature(folder: string, fileName: string) {
    if (!ALLOWED_DOCUMENT_EXTENSION.test(fileName)) {
        throw new Error("Choose a PDF, JPG, or PNG document.")
    }

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
    const apiKey = process.env.CLOUDINARY_API_KEY
    const apiSecret = process.env.CLOUDINARY_API_SECRET
    if (!cloudName || !apiKey || !apiSecret) {
        throw new Error("Document uploads are temporarily unavailable. Please try again later.")
    }

    const publicId = `document-${Date.now()}-${crypto.randomUUID()}-${sanitizeFileName(fileName)}`
    const timestamp = Math.floor(Date.now() / 1000)
    const signature = cloudinary.utils.api_sign_request({ folder, public_id: publicId, timestamp }, apiSecret)

    return { apiKey, cloudName, folder, publicId, signature, timestamp }
}

export async function createAgentIdUploadSignature(fileName: string) {
    const userId = await getAuthenticatedUserId()
    if (!userId) throw new Error("Sign in again to upload your ID document.")
    return createApplicationDocumentUploadSignature(`rssa/agents/${userId}/id_card`, fileName)
}

export async function createRiderDocumentUploadSignature(field: RiderDocumentField, fileName: string) {
    const userId = await getAuthenticatedUserId()
    if (!userId) throw new Error("Sign in again to upload your documents.")
    if (!RIDER_DOCUMENT_FIELDS.has(field)) throw new Error("This document type is not supported.")
    return createApplicationDocumentUploadSignature(`rssa/riders/${userId}/${field}`, fileName)
}

