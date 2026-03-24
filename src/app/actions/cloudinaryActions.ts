"use server"

import cloudinary from "@/lib/cloudinary"

function buildUploadPublicId(fileName: string) {
    const sanitizedName = fileName
        .replace(/\.[^/.]+$/, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48) || "product"

    return `rssa1-product-${Date.now()}-${sanitizedName}`
}

export async function createProductImageUploadSignature(fileName: string) {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
    const apiKey = process.env.CLOUDINARY_API_KEY
    const apiSecret = process.env.CLOUDINARY_API_SECRET

    if (!cloudName || !apiKey || !apiSecret) {
        throw new Error("Image upload is not configured.")
    }

    const timestamp = Math.floor(Date.now() / 1000)
    const folder = "rssa1/products"
    const publicId = buildUploadPublicId(fileName)
    const signature = cloudinary.utils.api_sign_request(
        {
            folder,
            public_id: publicId,
            timestamp,
        },
        apiSecret
    )

    return {
        cloudName,
        apiKey,
        folder,
        publicId,
        signature,
        timestamp,
    }
}

export async function deleteImage(url: string) {
    // Extract public_id from URL
    // Format: https://res.cloudinary.com/cloud_name/image/upload/v12345/folder/id.jpg
    const parts = url.split('/')
    const fileName = parts[parts.length - 1]
    const publicIdWithExt = `rssa1/products/${fileName.split('.')[0]}`

    return await cloudinary.uploader.destroy(publicIdWithExt)
}
