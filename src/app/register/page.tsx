"use client"

import { useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Eye, EyeOff, Home } from "lucide-react"
import { SuccessModal } from "@/components/ui/SuccessModal"
import { buildAbsoluteUrl, getClientSiteUrl } from "@/lib/site-url"
import { resolvePostAuthPath } from "@/lib/auth-redirects"

export default function RegisterPage() {
    const [fullName, setFullName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [showPassword, setShowPassword] = useState(false)
    const [showSuccessModal, setShowSuccessModal] = useState(false)
    const searchParams = useSearchParams()
    const supabase = createClient()
    const referralCode = searchParams.get("ref")?.trim().toUpperCase() ?? ""

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const emailAddress = email.trim().toLowerCase()
            const normalizedName = fullName.trim()
            const emailRedirectTo = buildAbsoluteUrl(getClientSiteUrl(), "/auth/callback", {
                next: "/",
                ref: referralCode || undefined,
            })

            const { data, error: signUpError } = await supabase.auth.signUp({
                email: emailAddress,
                password,
                options: {
                    emailRedirectTo,
                    data: {
                        full_name: normalizedName,
                        referred_by_code: referralCode || undefined,
                    },
                },
            })

            if (signUpError) {
                setError(signUpError.message)
                setLoading(false)
                return
            }

            if (data.session && data.user) {
                const destination = await resolvePostAuthPath(supabase, data.user.id, "/")
                window.location.assign(destination)
                return
            }

            if (data.user) {
                setLoading(false)
                setShowSuccessModal(true)
                return
            }

            setLoading(false)
            setError("Registration completed but the account could not be confirmed. Please try again.")
        } catch (authError) {
            console.error("Unexpected registration failure:", authError)
            setError("Unable to create your account right now. Please try again.")
            setLoading(false)
        }
    }

    const handleGoogleSignUp = async () => {
        setLoading(true)
        setError(null)

        try {
            const redirectUrl = buildAbsoluteUrl(getClientSiteUrl(), "/auth/callback", {
                next: "/",
                ref: referralCode || undefined,
            })

            const { error } = await supabase.auth.signInWithOAuth({
                provider: "google",
                options: {
                    redirectTo: redirectUrl,
                },
            })

            if (error) {
                setError(error.message)
                setLoading(false)
            }
        } catch (authError) {
            console.error("Unexpected Google sign-up failure:", authError)
            setError("Unable to start Google sign up right now. Please try again.")
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-white dark:bg-black font-sans">
            {/* Breadcrumb - Top Left */}
            <div className="container mx-auto px-4 md:px-8 py-6">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Link href="/" className="hover:text-[#F58220] transition-colors">
                        <Home className="h-4 w-4" />
                    </Link>
                    <span>{">"}</span>
                    <span className="text-[#F58220]">Sign Up</span>
                </div>
            </div>

            <div className="flex items-center justify-center pt-8 pb-20 px-4">
                <div className="w-full max-w-[500px]">
                    <div className="bg-white dark:bg-zinc-900 rounded-[10px] shadow-[0_0_20px_rgba(0,0,0,0.05)] p-8 md:p-12 border border-gray-100 dark:border-zinc-800">
                        <div className="text-center mb-10 space-y-2">
                            <h1 className="text-3xl font-bold text-[#1A1A1A] dark:text-white">Create Account</h1>
                            {referralCode ? (
                                <p className="text-sm font-medium text-[#F58220]">
                                    Joining with referral code {referralCode}
                                </p>
                            ) : null}
                        </div>

                        <form onSubmit={handleRegister} className="space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Input
                                        type="text"
                                        placeholder="Full Name"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        required
                                        className="h-[52px] rounded-lg border-gray-200 bg-white px-4 text-base placeholder:text-gray-400 focus-visible:ring-[#F58220] focus-visible:border-[#F58220]"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Input
                                        type="email"
                                        placeholder="Email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className="h-[52px] rounded-lg border-gray-200 bg-white px-4 text-base placeholder:text-gray-400 focus-visible:ring-[#F58220] focus-visible:border-[#F58220]"
                                    />
                                </div>
                                <div className="space-y-2 relative">
                                    <Input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        className="h-[52px] rounded-lg border-gray-200 bg-white px-4 text-base placeholder:text-gray-400 focus-visible:ring-[#F58220] focus-visible:border-[#F58220] pr-12"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-[14px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                    >
                                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                    </button>
                                </div>
                            </div>

                            {error && <p className="text-sm text-red-500 text-center">{error}</p>}

                            <div className="space-y-4 pt-2">
                                <Button className="w-full h-[52px] bg-[#F58220] hover:bg-[#F58220]/90 text-white font-bold text-lg rounded-full" type="submit" disabled={loading}>
                                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Sign Up"}
                                </Button>

                                <div className="relative py-2">
                                    <div className="absolute inset-0 flex items-center">
                                        <span className="w-full border-t border-gray-200 dark:border-zinc-800" />
                                    </div>
                                    <div className="relative flex justify-center text-xs uppercase">
                                        <span className="bg-white dark:bg-zinc-900 px-2 text-gray-400">
                                            Or
                                        </span>
                                    </div>
                                </div>

                                <Button
                                    variant="outline"
                                    type="button"
                                    disabled={loading}
                                    className="w-full h-[52px] rounded-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700 text-[#1A1A1A] dark:text-white font-medium text-base relative"
                                    onClick={handleGoogleSignUp}
                                >
                                    <img src="https://www.google.com/favicon.ico" alt="Google" className="absolute left-6 h-5 w-5" />
                                    Sign up with Google
                                </Button>
                            </div>

                            <div className="text-center pt-2">
                                <p className="text-sm text-gray-500">
                                    Already have an account?{" "}
                                    <Link href="/login" className="font-bold text-[#1A1A1A] hover:text-[#F58220] transition-colors dark:text-white dark:hover:text-[#F58220]">
                                        Login
                                    </Link>
                                </p>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
            <SuccessModal
                isOpen={showSuccessModal}
                onClose={() => setShowSuccessModal(false)}
                title="Registration Successful"
                description="Your account has been created successfully. Please check your email to verify your account before logging in."
                buttonText="Go to Login"
            />
        </div>
    )
}
