"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Database } from "@/types/database.types"
import { updateProfile } from "@/app/account/actions"
import { LottieLoader } from "@/components/ui/LottieLoader"

type Profile = Database["public"]["Tables"]["profiles"]["Row"]

interface ProfileEditDialogProps {
    profile: Profile
}

export function ProfileEditDialog({ profile }: ProfileEditDialogProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)

    async function handleSubmit(formData: FormData) {
        setLoading(true)
        const result = await updateProfile(formData)
        setLoading(false)

        if (result.success) {
            setOpen(false)
            // Optional: Show toast
        } else {
            alert("Failed to update profile: " + result.error)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <button className="text-[#F58220] text-sm font-bold uppercase hover:underline">
                    Edit Profile
                </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Edit Profile</DialogTitle>
                    <DialogDescription>
                        Make changes to your profile here. Click save when you&apos;re done.
                    </DialogDescription>
                </DialogHeader>
                <form action={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Full Name</label>
                        <Input
                            name="fullName"
                            defaultValue={profile.full_name}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Phone</label>
                        <Input
                            name="phone"
                            defaultValue={profile.phone || ""}
                            placeholder="+234..."
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Address</label>
                        <Input
                            name="address"
                            defaultValue={profile.address || ""}
                            placeholder="Your delivery address"
                        />
                    </div>
                    <DialogFooter>
                        <Button type="submit" className="bg-[#F58220] hover:bg-[#F58220]/90 text-white" disabled={loading}>
                            {loading && <div className="mr-2 scale-50 -ml-4"><LottieLoader width="40px" height="40px" /></div>}
                            {loading ? "Saving..." : "Save Changes"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
