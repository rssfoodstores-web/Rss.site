"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Upload, CheckCircle2, Loader2 } from "lucide-react"
import LivePhotoCapture from "./LivePhotoCapture"
import { submitDeliveryApplication } from "@/app/actions/deliveryActions"
import { useRouter } from "next/navigation"

function getErrorMessage(error: unknown) {
    if (error instanceof Error) {
        return error.message
    }

    return "Unknown error"
}

export default function DeliveryRegistrationForm() {
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)
    const [livePhoto, setLivePhoto] = useState<File | null>(null)
    const router = useRouter()

    async function handleSubmit(formData: FormData) {
        if (!livePhoto) {
            alert("Please complete the live photo verification.")
            return
        }

        setLoading(true)
        formData.append("passport_photo", livePhoto)

        try {
            const result = await submitDeliveryApplication(formData)

            if (result.success) {
                setSuccess(true)
                setTimeout(() => {
                    // Redirect to a pending status page or dashboard
                    router.push("/rider")
                }, 3000)
            } else {
                alert("Application failed: " + result.error)
            }
        } catch (error: unknown) {
            alert("An unexpected error occurred: " + getErrorMessage(error))
        } finally {
            setLoading(false)
        }
    }

    if (success) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center animate-in fade-in zoom-in duration-500">
                <div className="h-24 w-24 bg-green-50 rounded-full flex items-center justify-center mb-6">
                    <CheckCircle2 className="h-12 w-12 text-green-500" />
                </div>
                <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Application Received!</h2>
                <p className="text-gray-500 mb-8 max-w-md">
                    Your rider application is now pending review. We will notify you once your documents have been verified.
                </p>
                <div className="flex items-center justify-center gap-2 text-[#F58220] font-bold">
                    <Loader2 className="h-5 w-5 animate-spin" /> Redirecting to your profile...
                </div>
            </div>
        )
    }

    return (
        <form action={handleSubmit} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="space-y-6">
                <h3 className="text-xl font-bold text-[#1A1A1A] dark:text-gray-100 flex items-center gap-2">
                    <span className="bg-[#F58220] text-white h-8 w-8 rounded-full flex items-center justify-center text-sm">1</span>
                    Personal Information
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input name="full_name" placeholder="Full Name" className="h-14 px-6 rounded-xl border-[#E5E5EA] dark:border-zinc-800 bg-[#F2F2F7]/50 dark:bg-zinc-900 text-lg focus:border-[#F58220] dark:focus:border-[#F58220]" required />
                    <Input name="phone" placeholder="Phone Number" className="h-14 px-6 rounded-xl border-[#E5E5EA] dark:border-zinc-800 bg-[#F2F2F7]/50 dark:bg-zinc-900 text-lg focus:border-[#F58220] dark:focus:border-[#F58220]" required />
                </div>
                <Input name="address" placeholder="Residential Address" className="h-14 px-6 rounded-xl border-[#E5E5EA] dark:border-zinc-800 bg-[#F2F2F7]/50 dark:bg-zinc-900 text-lg focus:border-[#F58220] dark:focus:border-[#F58220]" required />
            </div>

            <div className="space-y-6 pt-4 border-t dark:border-zinc-800">
                <h3 className="text-xl font-bold text-[#1A1A1A] dark:text-gray-100 flex items-center gap-2">
                    <span className="bg-[#F58220] text-white h-8 w-8 rounded-full flex items-center justify-center text-sm">2</span>
                    Identity Verification
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <LivePhotoCapture onCapture={setLivePhoto} />

                    <div className="space-y-4">
                        <FileUploadField label="Valid Government ID (Front)" name="id_card_front" />
                        <FileUploadField label="Valid Government ID (Back)" name="id_card_back" required={false} />
                    </div>
                </div>
            </div>

            <div className="space-y-6 pt-4 border-t dark:border-zinc-800">
                <h3 className="text-xl font-bold text-[#1A1A1A] dark:text-gray-100 flex items-center gap-2">
                    <span className="bg-[#F58220] text-white h-8 w-8 rounded-full flex items-center justify-center text-sm">3</span>
                    Bike & Guarantor Details
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <h4 className="font-semibold text-gray-500">Bike Documents</h4>
                        <FileUploadField label="Vehicle License" name="bike_license" />
                        <FileUploadField label="Insurance Certificate" name="bike_insurance" />
                        <FileUploadField label="Road Worthiness" name="bike_roadworthiness" />
                    </div>

                    <div className="space-y-4">
                        <h4 className="font-semibold text-gray-500">Guarantor Information</h4>
                        <Input name="guarantor_name" placeholder="Guarantor Name" className="h-12 rounded-lg" required />
                        <Input name="guarantor_phone" placeholder="Guarantor Phone" className="h-12 rounded-lg" required />
                        <FileUploadField label="Signed Guarantor Form" name="guarantor_form" />
                        <FileUploadField label="Guarantor ID" name="guarantor_id" />
                    </div>
                </div>
            </div>

            <div className="pt-6">
                <Button
                    disabled={loading}
                    className="w-full h-16 bg-[#F58220] hover:bg-[#E57210] text-white font-extrabold text-xl rounded-2xl shadow-xl shadow-orange-500/20 active:scale-95 transition-all"
                >
                    {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : "Submit Application"}
                </Button>
                <p className="text-center text-gray-400 mt-4 text-sm">
                    By submitting, you agree to our <span className="underline">Terms of Service</span> for riders.
                </p>
            </div>
        </form>
    )
}

function FileUploadField({ label, name, required = true }: { label: string, name: string, required?: boolean }) {
    const [fileName, setFileName] = useState<string | null>(null)

    return (
        <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">{label} {required && "*"}</label>
            <label className="flex items-center gap-3 p-4 border border-[#E5E5EA] dark:border-zinc-800 rounded-xl cursor-pointer hover:border-[#F58220] dark:hover:border-[#F58220] transition-all bg-white dark:bg-zinc-900 group">
                <div className="h-10 w-10 bg-gray-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center group-hover:bg-orange-50 group-hover:text-[#F58220] transition-colors">
                    <Upload className="h-5 w-5 text-gray-500 dark:text-gray-400 group-hover:text-[#F58220]" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${fileName ? "text-[#F58220]" : "text-gray-500"}`}>
                        {fileName || "Click to upload document"}
                    </p>
                    <p className="text-[10px] text-gray-400">PDF, JPG, PNG (Max 5MB)</p>
                </div>
                {fileName && <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />}

                <input
                    type="file"
                    name={name}
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png"
                    required={required}
                    onChange={(e) => {
                        if (e.target.files?.[0]) {
                            setFileName(e.target.files[0].name)
                        }
                    }}
                />
            </label>
        </div>
    )
}
