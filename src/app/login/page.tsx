"use client"

import { useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Eye, EyeOff, Home } from "lucide-react"
import { buildAbsoluteUrl, getClientSiteUrl } from "@/lib/site-url"
import { getSafeNextPath, resolvePostAuthPath } from "@/lib/auth-redirects"

export default function LoginPage() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [showPassword, setShowPassword] = useState(false)
    const searchParams = useSearchParams()
    const supabase = createClient()
    const authMessage = searchParams.get("auth_message")?.trim() ?? ""

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email.trim().toLowerCase(),
                password,
            })

            if (error) {
                setError(error.message)
                setLoading(false)
                return
            }

            if (!data.user) {
                setError("Login succeeded but the session could not be confirmed. Please try again.")
                setLoading(false)
                return
            }

            const destination = await resolvePostAuthPath(supabase, data.user.id, searchParams.get("next"))

            // Force a full navigation so the server-side auth guards receive the new cookies immediately.
            window.location.assign(destination)
        } catch (authError) {
            console.error("Unexpected login failure:", authError)
            setError("Unable to complete sign in right now. Please try again.")
            setLoading(false)
        }
    }

    const handleGoogleLogin = async () => {
        setLoading(true)
        setError(null)

        try {
            const callbackUrl = buildAbsoluteUrl(getClientSiteUrl(), "/auth/callback", {
                next: getSafeNextPath(searchParams.get("next")) ?? "/",
            })

            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: callbackUrl
                }
            })

            if (error) {
                setError(error.message)
                setLoading(false)
            }
        } catch (authError) {
            console.error("Unexpected Google login failure:", authError)
            setError("Unable to start Google sign in right now. Please try again.")
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
                    <span className="text-[#F58220]">Sign in</span>
                </div>
            </div>

            <div className="flex items-center justify-center pt-8 pb-20 px-4">
                <div className="w-full max-w-[500px]">
                    <div className="bg-white dark:bg-zinc-900 rounded-[10px] shadow-[0_0_20px_rgba(0,0,0,0.05)] p-8 md:p-12 border border-gray-100 dark:border-zinc-800">
                        <div className="text-center mb-10 space-y-2">
                            <h1 className="text-3xl font-bold text-[#1A1A1A] dark:text-white">Sign In</h1>
                        </div>

                        <form onSubmit={handleLogin} className="space-y-6">
                            <div className="space-y-4">
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

                            <div className="flex items-center justify-between pt-1">
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        id="remember"
                                        className="h-4 w-4 rounded border-gray-300 text-[#F58220] focus:ring-[#F58220]"
                                    />
                                    <label
                                        htmlFor="remember"
                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-gray-500 cursor-pointer"
                                    >
                                        Remember me
                                    </label>
                                </div>
                                <Link href="/forgot-password" className="text-sm text-gray-500 hover:text-[#F58220] transition-colors">
                                    Forget Password
                                </Link>
                            </div>

                            {authMessage ? (
                                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                                    {authMessage}
                                </div>
                            ) : null}

                            {error && <p className="text-sm text-red-500 text-center">{error}</p>}

                            <div className="space-y-4 pt-2">
                                <Button className="w-full h-[52px] bg-[#F58220] hover:bg-[#F58220]/90 text-white font-bold text-lg rounded-full" type="submit" disabled={loading}>
                                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Login"}
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
                                    onClick={handleGoogleLogin}
                                >
                                    <span
                                        aria-hidden="true"
                                        className="absolute left-6 flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-bold text-[#4285F4] shadow-sm"
                                    >
                                        G
                                    </span>
                                    Sign in with Google
                                </Button>
                            </div>

                            <div className="text-center pt-2">
                                <p className="text-sm text-gray-500">
                                    Don&apos;t have account?{" "}
                                    <Link href="/register" className="font-bold text-[#1A1A1A] hover:text-[#F58220] transition-colors dark:text-white dark:hover:text-[#F58220]">
                                        Register
                                    </Link>
                                </p>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    )
}
