"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { AuthChangeEvent, Session } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Eye, EyeOff, Home } from "lucide-react"

export default function ResetPasswordPage() {
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [loading, setLoading] = useState(false)
    const [checkingSession, setCheckingSession] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const [sessionReady, setSessionReady] = useState(false)

    // Independent visibility states
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)

    const router = useRouter()
    const supabase = createClient()

    useEffect(() => {
        let active = true

        const applySessionState = async () => {
            try {
                const { data, error: sessionError } = await supabase.auth.getSession()

                if (sessionError) {
                    throw sessionError
                }

                if (!active) {
                    return
                }

                if (data.session) {
                    setSessionReady(true)
                    setError(null)
                } else {
                    setSessionReady(false)
                    setError("This password reset link is invalid or has expired. Request a new one.")
                }
            } catch (sessionError) {
                if (!active) {
                    return
                }

                console.error("Failed to restore reset session:", sessionError)
                setSessionReady(false)
                setError("We could not verify your reset link. Request a new password reset email.")
            } finally {
                if (active) {
                    setCheckingSession(false)
                }
            }
        }

        const { data: authListener } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
            if (!active) {
                return
            }

            if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
                setSessionReady(Boolean(session))
                setCheckingSession(false)

                if (session) {
                    setError(null)
                }
            }
        })

        void applySessionState()

        return () => {
            active = false
            authListener.subscription.unsubscribe()
        }
    }, [supabase])

    const handlePasswordUpdate = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        if (!sessionReady) {
            setError("This password reset link is invalid or has expired. Request a new one.")
            setLoading(false)
            return
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match")
            setLoading(false)
            return
        }

        if (password.length < 6) {
            setError("Password must be at least 6 characters")
            setLoading(false)
            return
        }

        const { error } = await supabase.auth.updateUser({
            password: password
        })

        if (error) {
            setError(error.message)
            setLoading(false)
        } else {
            setSuccess(true)
            setLoading(false)
            setTimeout(() => {
                router.push("/login")
            }, 3000)
        }
    }

    if (success) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-black/40">
                <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-[10px] shadow-lg p-8 mx-4 text-center">
                    <h3 className="text-2xl font-bold mb-4 text-green-600">Password Updated!</h3>
                    <p className="text-gray-500 mb-6">Your password has been successfully reset. Redirecting to login...</p>
                    <Link href="/login">
                        <Button className="w-full h-[52px] bg-[#F58220] hover:bg-[#F58220]/90 text-white font-bold rounded-full">
                            Return to Login
                        </Button>
                    </Link>
                </div>
            </div>
        )
    }

    if (checkingSession) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-white font-sans dark:bg-black">
                <div className="text-center">
                    <Loader2 className="mx-auto h-10 w-10 animate-spin text-[#F58220]" />
                    <p className="mt-4 text-sm text-gray-500">Verifying your reset link...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-white dark:bg-black font-sans">
            {/* Breadcrumb */}
            <div className="container mx-auto px-4 md:px-8 py-6">
                <div className="flex items-center gap-2 text-sm text-gray-500 overflow-x-auto whitespace-nowrap">
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
                    <Link href="/forgot-password" className="hover:text-[#F58220] transition-colors">
                        Forgot password
                    </Link>
                    <span>{">"}</span>
                    <span className="text-[#F58220]">Reset password</span>
                </div>
            </div>

            <div className="flex items-center justify-center pt-16 pb-20 px-4">
                <div className="w-full max-w-[500px]">
                    <div className="bg-white dark:bg-zinc-900 rounded-[10px] shadow-[0_0_20px_rgba(0,0,0,0.05)] p-8 md:p-12 border border-gray-100 dark:border-zinc-800">
                        <div className="text-center mb-8 space-y-2">
                            <h1 className="text-3xl font-bold text-[#1A1A1A] dark:text-white">Reset Password</h1>
                            <p className="text-sm text-gray-500">
                                You can now put in a new password.
                            </p>
                        </div>

                        <form onSubmit={handlePasswordUpdate} className="space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-2 relative">
                                    <Input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="New Password"
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

                                <div className="space-y-2 relative">
                                    <Input
                                        type={showConfirmPassword ? "text" : "password"}
                                        placeholder="Confirm Password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                        className="h-[52px] rounded-lg border-gray-200 bg-white px-4 text-base placeholder:text-gray-400 focus-visible:ring-[#F58220] focus-visible:border-[#F58220] pr-12"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-4 top-[14px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                    >
                                        {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                    </button>
                                </div>
                            </div>

                            {error && <p className="text-sm text-red-500 text-center">{error}</p>}

                            <Button className="w-full h-[52px] bg-[#F58220] hover:bg-[#F58220]/90 text-white font-bold text-lg rounded-full" type="submit" disabled={loading || !sessionReady}>
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Reset Password"}
                            </Button>
                        </form>

                        {!sessionReady ? (
                            <div className="mt-6 text-center">
                                <Link href="/forgot-password" className="text-sm font-semibold text-[#F58220] hover:underline">
                                    Request a new reset link
                                </Link>
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    )
}
