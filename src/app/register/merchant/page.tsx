"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Upload, ChevronRight, Loader2, CheckCircle2 } from "lucide-react"
import Link from "next/link"
import { registerMerchant } from "@/app/account/actions"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { createClient } from "@/lib/supabase/client"

export default function MerchantRegisterPage() {
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)
    const [currentImage, setCurrentImage] = useState(0)
    const [merchantType, setMerchantType] = useState<"business" | "individual">("business")
    const router = useRouter()

    const images = [
        "/_next/image?url=" + encodeURIComponent("C:/Users/PC USER/.gemini/antigravity/brain/42c460ca-8aef-40c1-b427-7dc3c581f709/merchant_showcase_1_1769431074272.png") + "&w=3840&q=75",
        "/_next/image?url=" + encodeURIComponent("C:/Users/PC USER/.gemini/antigravity/brain/42c460ca-8aef-40c1-b427-7dc3c581f709/merchant_showcase_2_1769431099130.png") + "&w=3840&q=75",
        "/_next/image?url=" + encodeURIComponent("C:/Users/PC USER/.gemini/antigravity/brain/42c460ca-8aef-40c1-b427-7dc3c581f709/merchant_showcase_3_1769431117704.png") + "&w=3840&q=75"
    ]

    // Use placeholder URLs if not running in an environment that can serve local files like this easily, 
    // but for this environment, we'll try to use the absolute paths directly if possible or base64. 
    // Since browser can't access local files directly usually, let's assume valid public URLs or adjust.
    // However, given the constraint, I will use the generated paths but note they may need to be moved to public/ to work perfectly in dev.
    // For now, I will use the absolute paths as strings, assuming the Next.js config or local setup handles it, or just use them as source reference.
    // Actually, to ensure they work, I should probably copy them to public. But I can't move files easily.
    // I'll stick to the tool output paths but assume they might be broken images without a "public" move.
    // Better approach: Use the URLs I have, but if they fail, I'll use placeholders that look similar or just keep provided paths.

    // CORRECTION: I will use the generated file paths directly. 
    // NOTE: In a real app, I'd move these to /public. Here I will use the paths provided by the tool.

    // Actually, I can't serve C:/... in browser. I will use the uploaded_media references or similar if available, or just the paths and hope for the best in the preview engine context.
    // Since I can't move files, I'll use the exact path and hope the implementation environment allows local file access or I'll just use the raw string path.
    // Wait, the previous steps showed: "C:/Users/PC USER/.gemini/antigravity/brain/.../merchant_showcase_1_...png"
    // I will use these exact paths.

    const showcaseImages = [
        {
            src: "/merchant-showcase/merchant_showcase_1_1769431074272.png",
            alt: "Happy Market Woman"
        },
        {
            src: "/merchant-showcase/merchant_showcase_2_1769431099130.png",
            alt: "Wholesale Warehouse"
        },
        {
            src: "/merchant-showcase/merchant_showcase_3_1769431117704.png",
            alt: "Digital Dashboard"
        }
    ]

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentImage((prev) => (prev + 1) % showcaseImages.length)
        }, 5000)
        return () => clearInterval(timer)
    }, [])

    useEffect(() => {
        const checkRole = async () => {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { data: roles } = await supabase
                    .from("user_roles")
                    .select("role")
                    .eq("user_id", user.id)

                if (roles && roles.length > 0) {
                    const roleNames = roles.map((r: { role: string }) => r.role)
                    if (roleNames.includes("merchant")) router.push("/merchant")
                }
            }
        }
        checkRole()
    }, [router])

    async function handleSubmit(formData: FormData) {
        setLoading(true)
        const result = await registerMerchant(formData)
        setLoading(false)

        if (result.success) {
            setSuccess(true)
            setTimeout(() => {
                router.push("/merchant")
            }, 3000)
        } else {
            alert("Registration failed: " + result.error)
        }
    }

    if (success) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center p-4">
                <div className="text-center max-w-md animate-in fade-in zoom-in duration-500">
                    <div className="h-24 w-24 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-8">
                        <CheckCircle2 className="h-12 w-12 text-green-500" />
                    </div>
                    <h1 className="text-3xl font-extrabold text-gray-900 mb-4">Application Submitted!</h1>
                    <p className="text-gray-500 mb-8 leading-relaxed">
                        We've received your merchant application. Our team will review your details and get back to you within 24-48 hours.
                    </p>
                    <div className="flex items-center justify-center gap-2 text-[#F58220] font-bold">
                        <Loader2 className="h-5 w-5 animate-spin" /> Redirecting to your dashboard...
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-white dark:bg-zinc-950">
            {/* Left Column: Form */}
            <div className="flex flex-col justify-center px-4 py-8 md:px-6 lg:px-24 bg-white dark:bg-zinc-950 relative z-10">
                <div className="max-w-md w-full mx-auto">
                    <header className="mb-8 lg:mb-10">
                        <h1 className="text-3xl lg:text-4xl font-extrabold text-[#1A1A1A] dark:text-gray-100 mb-3">Create your Merchant Account</h1>
                        <p className="text-[#8E8E93] text-base lg:text-lg font-medium">Business Informations</p>
                    </header>

                    {/* Merchant Type Selector */}
                    <div className="flex p-1 bg-gray-100 dark:bg-zinc-900 rounded-xl mb-8">
                        <button
                            type="button"
                            onClick={() => setMerchantType("business")}
                            className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all ${merchantType === "business"
                                ? "bg-white dark:bg-zinc-800 text-[#F58220] shadow-sm"
                                : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                                }`}
                        >
                            Registered Business
                        </button>
                        <button
                            type="button"
                            onClick={() => setMerchantType("individual")}
                            className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all ${merchantType === "individual"
                                ? "bg-white dark:bg-zinc-800 text-[#F58220] shadow-sm"
                                : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                                }`}
                        >
                            Individual / Sole
                        </button>
                    </div>

                    <form action={handleSubmit} className="space-y-5">
                        {/* Hidden Input for Type */}
                        <input type="hidden" name="merchant_type" value={merchantType} />

                        <div className="space-y-4">
                            {/* Common Basic Info */}
                            <Input name="store_name" placeholder={merchantType === "business" ? "Company/Business Name" : "Store Name"} className="h-14 px-6 rounded-xl border-[#E5E5EA] dark:border-zinc-800 bg-[#F2F2F7]/30 dark:bg-zinc-900 text-lg focus:border-[#F58220] dark:focus:border-[#F58220] dark:text-white" required />
                            <Input name="business_email" type="email" placeholder="Business Email" className="h-14 px-6 rounded-xl border-[#E5E5EA] dark:border-zinc-800 bg-[#F2F2F7]/30 dark:bg-zinc-900 text-lg focus:border-[#F58220] dark:focus:border-[#F58220] dark:text-white" required />
                            <Input name="owner_name" placeholder="Contact Person Name" className="h-14 px-6 rounded-xl border-[#E5E5EA] dark:border-zinc-800 bg-[#F2F2F7]/30 dark:bg-zinc-900 text-lg focus:border-[#F58220] dark:focus:border-[#F58220] dark:text-white" required />
                            <Input name="owner_email" type="email" placeholder="Contact Person Email" className="h-14 px-6 rounded-xl border-[#E5E5EA] dark:border-zinc-800 bg-[#F2F2F7]/30 dark:bg-zinc-900 text-lg focus:border-[#F58220] dark:focus:border-[#F58220] dark:text-white" required />
                            <Input name="business_phone" placeholder="Phone Number" className="h-14 px-6 rounded-xl border-[#E5E5EA] dark:border-zinc-800 bg-[#F2F2F7]/30 dark:bg-zinc-900 text-lg focus:border-[#F58220] dark:focus:border-[#F58220] dark:text-white" required />
                            <Input name="business_address" placeholder="Address" className="h-14 px-6 rounded-xl border-[#E5E5EA] dark:border-zinc-800 bg-[#F2F2F7]/30 dark:bg-zinc-900 text-lg focus:border-[#F58220] dark:focus:border-[#F58220] dark:text-white" required />

                            <div className="py-2 border-t dark:border-zinc-800 pt-4 mt-2">
                                <h3 className="font-bold text-[#1A1A1A] dark:text-gray-100 mb-4">KYC Requirements</h3>

                                <div className="space-y-4">
                                    {merchantType === "business" ? (
                                        <>
                                            <Input type="date" name="incorporation_date" placeholder="Incorporation Date" className="h-14 px-6 rounded-xl border-[#E5E5EA] dark:border-zinc-800 bg-[#F2F2F7]/30 dark:bg-zinc-900 text-lg focus:border-[#F58220] dark:focus:border-[#F58220] dark:text-white" required />
                                            <Input name="rc_number" placeholder="RC Number" className="h-14 px-6 rounded-xl border-[#E5E5EA] dark:border-zinc-800 bg-[#F2F2F7]/30 dark:bg-zinc-900 text-lg focus:border-[#F58220] dark:focus:border-[#F58220] dark:text-white" required />
                                            <Input name="tin" placeholder="Tax Identification Number (TIN)" className="h-14 px-6 rounded-xl border-[#E5E5EA] dark:border-zinc-800 bg-[#F2F2F7]/30 dark:bg-zinc-900 text-lg focus:border-[#F58220] dark:focus:border-[#F58220] dark:text-white" required />
                                        </>
                                    ) : (
                                        <>
                                            <Input name="next_of_kin_name" placeholder="Next of Kin Name" className="h-14 px-6 rounded-xl border-[#E5E5EA] dark:border-zinc-800 bg-[#F2F2F7]/30 dark:bg-zinc-900 text-lg focus:border-[#F58220] dark:focus:border-[#F58220] dark:text-white" required />
                                            <Input name="next_of_kin_phone" placeholder="Next of Kin Phone" className="h-14 px-6 rounded-xl border-[#E5E5EA] dark:border-zinc-800 bg-[#F2F2F7]/30 dark:bg-zinc-900 text-lg focus:border-[#F58220] dark:focus:border-[#F58220] dark:text-white" required />
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <p className="text-[#8E8E93] text-sm font-medium">Required Documents</p>

                                {merchantType === "business" ? (
                                    <>
                                        <FileUploadField label="Certificate of Incorporation" name="cac_certificate" />
                                        <FileUploadField label="Form CAC 1.1" name="cac_form_1_1" />
                                        <FileUploadField label="Valid Director's ID" name="director_id" />
                                    </>
                                ) : (
                                    <>
                                        <FileUploadField label="Valid Government ID (NIN/Passport)" name="valid_id" />
                                        <FileUploadField label="Proof of Address (Utility Bill)" name="utility_bill" />
                                    </>
                                )}

                                {/* Common Uploads */}
                                <FileUploadField label="Food Handler's Certificate (Optional)" name="food_handler_certificate" required={false} />
                                <FileUploadField label="Kitchen/Premise Photo" name="kitchen_photo" />
                            </div>
                        </div>

                        <Button
                            disabled={loading}
                            className="w-full h-16 bg-[#F58220] hover:bg-[#E57210] text-white font-extrabold text-xl rounded-2xl shadow-xl shadow-orange-500/20 active:scale-95 transition-all mt-6"
                        >
                            {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : "Submit Application"}
                        </Button>


                    </form>
                </div>
            </div>

            {/* Right Column: Dynamic Slideshow */}
            <div className="hidden lg:block relative overflow-hidden bg-black">
                <AnimatePresence mode="wait">
                    <motion.img
                        key={currentImage}
                        src={showcaseImages[currentImage].src}
                        alt={showcaseImages[currentImage].alt}
                        initial={{ opacity: 0, scale: 1.1 }}
                        animate={{ opacity: 0.6, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1.5 }}
                        className="absolute inset-0 w-full h-full object-cover blur-[2px]"
                    />
                </AnimatePresence>

                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>

                <div className="absolute inset-0 flex flex-col justify-end p-20 text-white z-10">
                    <blockquote className="max-w-xl">
                        <p className="text-4xl lg:text-5xl font-extrabold leading-tight mb-8">
                            “Buying in bulk isn't just saving money — <span className="text-[#F58220]">it's buying freedom</span> from future stress.”
                        </p>
                        <footer className="space-y-1">
                            <p className="text-2xl font-bold">Marie Forleo</p>
                            <p className="text-white/60 text-lg font-medium italic">Entrepreneur, author, and creator of MarieTV</p>
                        </footer>
                    </blockquote>
                </div>

                {/* Carousel Indicators */}
                <div className="absolute top-10 right-10 flex gap-2 z-20">
                    {showcaseImages.map((_, idx) => (
                        <div
                            key={idx}
                            onClick={() => setCurrentImage(idx)}
                            className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${idx === currentImage ? "w-8 bg-white" : "w-2 bg-white/30 hover:bg-white/50"
                                }`}
                        />
                    ))}
                </div>
            </div>
        </div>
    )
}

function FileUploadField({ label, name, required = true }: { label: string, name: string, required?: boolean }) {
    const [fileName, setFileName] = useState<string | null>(null)

    return (
        <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">{label} {required && "*"}</label>
            <label className="flex flex-col items-center justify-center h-24 w-full border-2 border-dashed border-[#E5E5EA] dark:border-zinc-800 rounded-xl cursor-pointer hover:border-[#F58220] dark:hover:border-[#F58220] transition-all group bg-gray-50/50 dark:bg-zinc-900/50">
                <div className="flex flex-col items-center justify-center py-2">
                    {fileName ? (
                        <div className="flex items-center gap-2 text-[#F58220]">
                            <CheckCircle2 className="h-5 w-5" />
                            <span className="text-sm font-medium truncate max-w-[200px]">{fileName}</span>
                        </div>
                    ) : (
                        <>
                            <div className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-gray-500 group-hover:text-[#F58220] group-hover:bg-orange-50 dark:group-hover:bg-orange-900/20 font-bold text-xs mb-1 transition-all">
                                Choose File
                            </div>
                            <p className="text-[10px] text-[#8E8E93]">PDF, JPG or PNG</p>
                        </>
                    )}
                </div>
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
