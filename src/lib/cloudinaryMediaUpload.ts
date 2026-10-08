"use client"

interface SignedUploadPayload {
    apiKey: string
    cloudName: string
    folder: string
    publicId: string
    signature: string
    timestamp: number
}

interface CloudinaryUploadResponse {
    public_id?: string
    resource_type?: "image" | "video" | "raw"
    secure_url?: string
    error?: {
        message?: string
    }
}

export interface UploadedCloudinaryAsset {
    publicId: string
    resourceType: "image" | "video" | "raw"
    secureUrl: string
}

export async function uploadSignedCloudinaryAsset<ResourceType extends "image" | "video" | "auto">(
    file: File,
    getSignature: (fileName: string, resourceType: ResourceType) => Promise<SignedUploadPayload>,
    resourceType: ResourceType
): Promise<UploadedCloudinaryAsset> {
    const signedUpload = await getSignature(file.name, resourceType)

    const formData = new FormData()
    formData.append("file", file)
    formData.append("api_key", signedUpload.apiKey)
    formData.append("timestamp", String(signedUpload.timestamp))
    formData.append("signature", signedUpload.signature)
    formData.append("folder", signedUpload.folder)
    formData.append("public_id", signedUpload.publicId)

    const response = await fetch(
        `https://api.cloudinary.com/v1_1/${signedUpload.cloudName}/${resourceType}/upload`,
        {
            method: "POST",
            body: formData,
        }
    )

    const payload = await response.json() as CloudinaryUploadResponse

    if (!response.ok || !payload.secure_url || !payload.public_id || !payload.resource_type) {
        throw new Error(payload.error?.message ?? "Media upload failed.")
    }

    return {
        publicId: payload.public_id,
        resourceType: payload.resource_type,
        secureUrl: payload.secure_url,
    }
}

