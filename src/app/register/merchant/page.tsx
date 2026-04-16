"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CheckCircle2, Loader2 } from "lucide-react"
import { registerMerchant } from "@/app/account/actions"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { createClient } from "@/lib/supabase/client"

const SHOWCASE_IMAGES = [
    {
        alt: "Happy Market Woman",
        src: "/merchant-showcase/merchant_showcase_1_1769431074272.png",
    },
    {
        alt: "Wholesale Warehouse",
        src: "/merchant-showcase/merchant_showcase_2_1769431099130.png",
    },
    {
        alt: "Digital Dashboard",
        src: "/merchant-showcase/merchant_showcase_3_1769431117704.png",
    },
]

interface UserRoleRow {
    role: string
}

export default function MerchantRegisterPage() {
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)
    const [currentImage, setCurrentImage] = useState(0)
    const [merchantType, setMerchantType] = useState<"business" | "individual">("business")
    const [authReady, setAuthReady] = useState(false)
    const router = useRouter()

    useEffect(() => {
        const timer = window.setInterval(() => {
            setCurrentImage((current) => (current + 1) % SHOWCASE_IMAGES.length)
        }, 5000)

        return () => window.clearInterval(timer)
    }, [])

    useEffect(() => {
        const checkRole = async () => {
            const supabase = createClient()
            const {
                data: { user },
            } = await supabase.auth.getUser()

            if (!user) {
                router.replace("/login?next=%2Fregister%2Fmerchant")
                return
            }

            const { data: roles } = await supabase
                .from("user_roles")
                .select("role")
                .eq("user_id", user.id)

            const roleNames = (roles ?? []).map((roleRow: UserRoleRow) => roleRow.role)

            if (roleNames.includes("merchant")) {
                router.replace("/merchant")
                return
            }

            setAuthReady(true)
        }

        void checkRole()
    }, [router])

    if (!authReady && !success) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-white dark:bg-zinc-950">
                <Loader2 className="h-8 w-8 animate-spin text-[#F58220]" />
            </div>
        )
    }

    async function handleSubmit(formData: FormData) {
        setLoading(true)
        const result = await registerMerchant(formData)
        setLoading(false)

        if (!result.success) {
            alert("Registration failed: " + result.error)
            return
        }

        setSuccess(true)
        window.setTimeout(() => {
            router.push("/merchant")
        }, 3000)
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
                        We&apos;ve received your merchant application. Our team will review your details and get back to you within 24-48 hours.
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
            <div className="flex flex-col justify-center px-4 py-8 md:px-6 lg:px-24 bg-white dark:bg-zinc-950 relative z-10">
                <div className="max-w-md w-full mx-auto">
                    <header className="mb-8 lg:mb-10">
                        <h1 className="text-3xl lg:text-4xl font-extrabold text-[#1A1A1A] dark:text-gray-100 mb-3">Create your Merchant Account</h1>
                        <p className="text-[#8E8E93] text-base lg:text-lg font-medium">Business Information</p>
                    </header>

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
                        <input type="hidden" name="merchant_type" value={merchantType} />

                        <div className="space-y-4">
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

            <div className="hidden lg:block relative overflow-hidden bg-black">
                <AnimatePresence mode="wait">
                    <motion.img
                        key={currentImage}
                        src={SHOWCASE_IMAGES[currentImage].src}
                        alt={SHOWCASE_IMAGES[currentImage].alt}
                        initial={{ opacity: 0, scale: 1.1 }}
                        animate={{ opacity: 0.6, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1.5 }}
                        className="absolute inset-0 w-full h-full object-cover blur-[2px]"
                    />
                </AnimatePresence>

                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

                <div className="absolute inset-0 flex flex-col justify-end p-20 text-white z-10">
                    <blockquote className="max-w-xl">
                        <p className="text-4xl lg:text-5xl font-extrabold leading-tight mb-8">
                            &ldquo;Buying in bulk isn&apos;t just saving money. <span className="text-[#F58220]">It&apos;s buying freedom</span> from future stress.&rdquo;
                        </p>
                        <footer className="space-y-1">
                            <p className="text-2xl font-bold">Marie Forleo</p>
                            <p className="text-white/60 text-lg font-medium italic">Entrepreneur, author, and creator of MarieTV</p>
                        </footer>
                    </blockquote>
                </div>

                <div className="absolute top-10 right-10 flex gap-2 z-20">
                    {SHOWCASE_IMAGES.map((_, index) => (
                        <div
                            key={index}
                            onClick={() => setCurrentImage(index)}
                            className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${index === currentImage ? "w-8 bg-white" : "w-2 bg-white/30 hover:bg-white/50"}`}
                        />
                    ))}
                </div>
            </div>
        </div>
    )
}

function FileUploadField({ label, name, required = true }: { label: string; name: string; required?: boolean }) {
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
                    onChange={(event) => {
                        if (event.target.files?.[0]) {
                            setFileName(event.target.files[0].name)
                        }
                    }}
                />
            </label>
        </div>
    )
}
