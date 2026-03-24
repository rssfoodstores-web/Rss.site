"use client"

import { createProductImageUploadSignature } from "@/app/actions/cloudinaryActions"

interface CloudinaryUploadResponse {
    secure_url?: string
    error?: {
        message?: string
    }
}

export async function uploadProductImage(file: File) {
    const signedUpload = await createProductImageUploadSignature(file.name)

    const formData = new FormData()
    formData.append("file", file)
    formData.append("api_key", signedUpload.apiKey)
    formData.append("timestamp", String(signedUpload.timestamp))
    formData.append("signature", signedUpload.signature)
    formData.append("folder", signedUpload.folder)
    formData.append("public_id", signedUpload.publicId)

    const response = await fetch(
        `https://api.cloudinary.com/v1_1/${signedUpload.cloudName}/image/upload`,
        {
            method: "POST",
            body: formData,
        }
    )

    const payload = await response.json() as CloudinaryUploadResponse

    if (!response.ok || !payload.secure_url) {
        throw new Error(payload.error?.message ?? "Image upload failed.")
    }

    return payload.secure_url
}
