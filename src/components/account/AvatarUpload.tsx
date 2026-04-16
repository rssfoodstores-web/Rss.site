"use client"

import Image from "next/image"
import { useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Database } from "@/types/database.types"
import { updateAvatar } from "@/app/account/actions"
import { Loader2 } from "lucide-react"

type Profile = Database["public"]["Tables"]["profiles"]["Row"]

interface AvatarUploadProps {
    profile: Profile
    email: string | undefined
}

export function AvatarUpload({ profile, email }: AvatarUploadProps) {
    const [uploading, setUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        try {
            setUploading(true)

            if (!event.target.files || event.target.files.length === 0) {
                throw new Error("You must select an image to upload.")
            }

            const file = event.target.files[0]
            const fileExt = file.name.split(".").pop()
            const fileName = `${profile.id}-${Math.random()}.${fileExt}`
            const filePath = `${fileName}`

            const supabase = createClient()

            const { error: uploadError } = await supabase.storage
                .from("avatars")
                .upload(filePath, file)

            if (uploadError) {
                // Determine if it's a bucket missing error or something else
                throw uploadError
            }

            const { data } = supabase.storage.from("avatars").getPublicUrl(filePath)

            if (data) {
                const result = await updateAvatar(data.publicUrl)
                if (!result.success) {
                    throw new Error(result.error)
                }
            }

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Upload failed"
            alert("Error uploading avatar: " + errorMessage)
            console.error(error)
        } finally {
            setUploading(false)
        }
    }

    return (
        <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <input
                type="file"
                className="hidden"
                accept="image/*"
                ref={fileInputRef}
                onChange={handleUpload}
                disabled={uploading}
            />

            {uploading ? (
                <div className="h-16 w-16 bg-[#F58220]/10 rounded-full flex items-center justify-center">
                    <Loader2 className="h-6 w-6 text-[#F58220] animate-spin" />
                </div>
            ) : profile.avatar_url ? (
                <Image
                    src={profile.avatar_url}
                    alt="Profile"
                    width={64}
                    height={64}
                    className="h-16 w-16 rounded-full object-cover"
                />
            ) : (
                <div className="h-16 w-16 bg-[#F58220]/10 rounded-full flex items-center justify-center text-[#F58220] font-bold text-2xl uppercase">
                    {profile.full_name?.[0] || email?.[0]}
                </div>
            )}

            <div className={`absolute inset-0 bg-black/50 rounded-full flex items-center justify-center transition-opacity ${uploading ? 'opacity-100 cursor-not-allowed' : 'opacity-0 group-hover:opacity-100'}`}>
                {uploading ? null : <p className="text-white text-xs text-center font-bold">Change</p>}
            </div>
        </div>
    )
}
