"use client"

import { useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Home } from "lucide-react"
import { buildAbsoluteUrl, getClientSiteUrl } from "@/lib/site-url"

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("")
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
    const supabase = createClient()

    const handleResetRequest = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setMessage(null)

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
                redirectTo: buildAbsoluteUrl(getClientSiteUrl(), "/reset-password"),
            })

            if (error) {
                setMessage({ type: 'error', text: error.message })
            } else {
                setMessage({
                    type: 'success',
                    text: "If an account exists with this email, you will receive a password reset link shortly."
                })
            }
        } catch (authError) {
            console.error("Unexpected forgot-password failure:", authError)
            setMessage({ type: "error", text: "Unable to start password recovery right now. Please try again." })
        }
        setLoading(false)
    }

    return (
        <div className="min-h-screen bg-white dark:bg-black font-sans">
            {/* Breadcrumb */}
            <div className="container mx-auto px-4 md:px-8 py-6">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Link href="/" className="hover:text-[#F58220] transition-colors">
                        <Home className="h-4 w-4" />
                    </Link>
                    <span>{">"}</span>
                    <span>Home</span>
                    <span>{">"}</span>
                    <Link href="/login" className="hover:text-[#F58220] transition-colors">
                        Sign in
                    </Link>
                    <span>{">"}</span>
                    <span className="text-[#F58220]">Forgot password</span>
                </div>
            </div>

            <div className="flex items-center justify-center pt-16 pb-20 px-4">
                <div className="w-full max-w-[500px]">
                    <div className="bg-white dark:bg-zinc-900 rounded-[10px] shadow-[0_0_20px_rgba(0,0,0,0.05)] p-8 md:p-12 border border-gray-100 dark:border-zinc-800">
                        <div className="text-center mb-8 space-y-2">
                            <h1 className="text-3xl font-bold text-[#1A1A1A] dark:text-white">Forget Password</h1>
                            <p className="text-sm text-gray-500">
                                Enter the email address associated with your account.
                            </p>
                        </div>

                        {!message || message.type === 'error' ? (
                            <form onSubmit={handleResetRequest} className="space-y-6">
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

                                {message && message.type === 'error' && (
                                    <p className="text-sm text-red-500 text-center">{message.text}</p>
                                )}

                                <Button className="w-full h-[52px] bg-[#F58220] hover:bg-[#F58220]/90 text-white font-bold text-lg rounded-full" type="submit" disabled={loading}>
                                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Send Reset Link"}
                                </Button>
                            </form>
                        ) : (
                            <div className="flex flex-col items-center gap-4 text-center py-4">
                                <div className="space-y-4">
                                    <p className="text-sm text-green-600 dark:text-green-400">{message.text}</p>
                                    <Button onClick={() => setMessage(null)} variant="outline" className="w-full">
                                        Try again
                                    </Button>
                                </div>
                            </div>
                        )}

                        <div className="text-center pt-8 space-y-4">
                            <p className="text-sm text-gray-500">
                                Already have an account?{" "}
                                <Link href="/login" className="font-bold text-[#002603] hover:text-[#F58220] transition-colors dark:text-white dark:hover:text-[#F58220]">
                                    Sign In
                                </Link>
                            </p>
                            <p className="text-xs text-gray-400 max-w-xs mx-auto leading-relaxed">
                                You may contact <span className="text-[#F58220]">Customer Service</span> for help restoring access to your account.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
