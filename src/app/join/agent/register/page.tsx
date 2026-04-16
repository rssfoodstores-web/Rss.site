"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slideshow } from "@/components/ui/slideshow"
import { Loader2, Upload, CheckCircle2 } from "lucide-react"
import { registerAgent } from "@/app/actions/agentActions"

const agentSlides = [
    {
        id: 1,
        image: "/images/slideshow/slide1.png",
        quote: "Empowering local commerce, one connection at a time.",
        author: "Agent Network",
        role: "RSS Foods"
    },
    {
        id: 2,
        image: "/images/slideshow/slide2.png",
        quote: "Organization is the key to efficient logistics.",
        author: "Warehouse Ops",
        role: "Logistics Partner"
    },
    {
        id: 3,
        image: "/images/slideshow/slide3.png",
        quote: "Buying in bulk isn't just saving money — it's buying freedom from future stress.",
        author: "Marie Forleo",
        role: "Entrepreneur"
    }
]

export default function AgentRegisterPage() {
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)
    const [authReady, setAuthReady] = useState(false)
    const router = useRouter()

    useEffect(() => {
        const checkRole = async () => {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()

            if (!user) {
                router.replace("/login?next=%2Fjoin%2Fagent%2Fregister")
                return
            }

            const { data: roles } = await supabase
                .from("user_roles")
                .select("role")
                .eq("user_id", user.id)

            if (roles && roles.length > 0) {
                const roleNames = roles.map((r: { role: string }) => r.role)
                if (roleNames.includes("agent")) {
                    router.replace("/agent")
                    return
                }
            }

            setAuthReady(true)
        }

        void checkRole()
    }, [router])

    if (!authReady && !success) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-[#F58220]" />
            </div>
        )
    }

    async function handleSubmit(formData: FormData) {
        setLoading(true)
        try {
            const result = await registerAgent(formData)

            if (result.success) {
                setSuccess(true)
                setTimeout(() => {
                    router.push("/agent")
                }, 3000)
            } else {
                alert("Registration failed: " + result.error)
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error"
            alert("An unexpected error occurred: " + errorMessage)
        } finally {
            setLoading(false)
        }
    }

    if (success) {
        return (
            <div className="flex min-h-screen bg-background h-screen items-center justify-center">
                <div className="text-center max-w-md animate-in fade-in zoom-in duration-500 p-8">
                    <div className="h-24 w-24 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-8">
                        <CheckCircle2 className="h-12 w-12 text-green-500" />
                    </div>
                    <h1 className="text-3xl font-extrabold text-foreground mb-4">Application Submitted!</h1>
                    <p className="text-muted-foreground mb-8 leading-relaxed">
                        We&apos;ve received your agent application. Our team will review your details and get back to you shortly.
                    </p>
                    <div className="flex items-center justify-center gap-2 text-[#F58220] font-bold">
                        <Loader2 className="h-5 w-5 animate-spin" /> Redirecting to your dashboard...
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="flex min-h-screen bg-background h-screen overflow-hidden">
            {/* Left Side - Form */}
            <div className="w-full lg:w-1/2 overflow-y-auto p-8 lg:p-12 xl:p-16 flex flex-col">
                <div className="max-w-md mx-auto w-full flex-1 flex flex-col justify-center">
                    <div className="mb-8">
                        <Link href="/" className="text-[#F58220] font-bold text-xl mb-8 block">
                            RSS Foods
                        </Link>
                        <h1 className="text-3xl lg:text-4xl font-bold text-foreground mb-2">
                            Create your Agent Account
                        </h1>
                        <p className="text-muted-foreground">
                            Join our network and start earning commissions.
                        </p>
                    </div>

                    <form action={handleSubmit} className="space-y-8">
                        {/* Personal Information */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-foreground border-b pb-2">Personal Information</h3>

                            <div className="space-y-2">
                                <Label htmlFor="fullName">Full Name</Label>
                                <Input id="fullName" name="fullName" placeholder="your legal name" required className="h-12 bg-gray-50 dark:bg-zinc-900 border-border/50" />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="phone">Phone Number</Label>
                                    <Input id="phone" name="phone" type="tel" placeholder="08012345678" required className="h-12 bg-gray-50 dark:bg-zinc-900 border-border/50" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email</Label>
                                    {/* Email is usually from auth, but confirming it here is fine or we can omit/make readonly if we prefill */}
                                    <Input id="email" name="email" type="email" placeholder="you@example.com" required className="h-12 bg-gray-50 dark:bg-zinc-900 border-border/50" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="address">Residential Address</Label>
                                <Input id="address" name="address" placeholder="123 Street, City, State" required className="h-12 bg-gray-50 dark:bg-zinc-900 border-border/50" />
                            </div>
                        </div>

                        {/* Identity Verification */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-foreground border-b pb-2">Identity Verification</h3>
                            <FileUploadField label="Valid Government ID (NIN, Passport, Voter's Card)" name="idCard" />
                        </div>

                        {/* Bank Details */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-foreground border-b pb-2">Bank Details</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="bankName">Bank Name</Label>
                                    <Input id="bankName" name="bankName" placeholder="e.g. GTBank" required className="h-12 bg-gray-50 dark:bg-zinc-900 border-border/50" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="accountNumber">Account Number</Label>
                                    <Input id="accountNumber" name="accountNumber" placeholder="0123456789" required className="h-12 bg-gray-50 dark:bg-zinc-900 border-border/50" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="accountName">Account Name</Label>
                                <Input id="accountName" name="accountName" placeholder="Must match your ID name" required className="h-12 bg-gray-50 dark:bg-zinc-900 border-border/50" />
                            </div>
                        </div>

                        {/* Guarantors */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-foreground border-b pb-2">Guarantors</h3>

                            <div className="border p-4 rounded-lg space-y-4 bg-gray-50/50 dark:bg-zinc-900/50">
                                <p className="font-medium text-sm text-muted-foreground">Guarantor 1</p>
                                <Input name="guarantor1Name" placeholder="Full Name" required className="bg-background" />
                                <Input name="guarantor1Phone" placeholder="Phone Number" required className="bg-background" />
                                <Input name="guarantor1Address" placeholder="Address" required className="bg-background" />
                            </div>

                            <div className="border p-4 rounded-lg space-y-4 bg-gray-50/50 dark:bg-zinc-900/50">
                                <p className="font-medium text-sm text-muted-foreground">Guarantor 2</p>
                                <Input name="guarantor2Name" placeholder="Full Name" required className="bg-background" />
                                <Input name="guarantor2Phone" placeholder="Phone Number" required className="bg-background" />
                                <Input name="guarantor2Address" placeholder="Address" required className="bg-background" />
                            </div>
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-12 bg-[#F58220] hover:bg-[#F58220]/90 text-white font-bold rounded-lg text-lg mt-6"
                            disabled={loading}
                        >
                            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Submit Application"}
                        </Button>
                    </form>
                </div>
            </div>

            {/* Right Side - Slideshow */}
            <div className="hidden lg:block w-1/2 relative bg-zinc-900">
                <Slideshow slides={agentSlides} />
            </div>
        </div>
    )
}

function FileUploadField({ label, name, required = true }: { label: string, name: string, required?: boolean }) {
    const [fileName, setFileName] = useState<string | null>(null)

    return (
        <div className="space-y-2">
            <Label className="text-sm font-semibold text-foreground">{label} {required && "*"}</Label>
            <label className="flex items-center gap-3 p-4 border border-dashed border-[#E5E5EA] dark:border-zinc-800 rounded-xl cursor-pointer hover:border-[#F58220] dark:hover:border-[#F58220] transition-all bg-background group">
                <div className="h-10 w-10 bg-gray-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center group-hover:bg-orange-50 group-hover:text-[#F58220] transition-colors">
                    <Upload className="h-5 w-5 text-gray-500 dark:text-gray-400 group-hover:text-[#F58220]" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${fileName ? "text-[#F58220]" : "text-muted-foreground"}`}>
                        {fileName || "Click to upload document"}
                    </p>
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
