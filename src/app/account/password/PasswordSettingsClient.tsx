"use client"

import { useState } from "react"
import { ProfileSidebar } from "@/components/account/ProfileSidebar"
import { Lock, Eye, EyeOff, ShieldCheck, Smartphone, Key, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

export function PasswordSettingsClient() {
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
    const [passwords, setPasswords] = useState({
        new: "",
        confirm: "",
    })

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault()
        if (passwords.new !== passwords.confirm) {
            setMessage({ type: "error", text: "New passwords do not match" })
            return
        }

        setLoading(true)
        setMessage(null)

        const supabase = createClient()
        const { error } = await supabase.auth.updateUser({
            password: passwords.new,
        })

        setLoading(false)
        if (error) {
            setMessage({ type: "error", text: error.message })
        } else {
            setMessage({ type: "success", text: "Password updated successfully!" })
            setPasswords({ new: "", confirm: "" })
        }
    }

    return (
        <div className="min-h-screen bg-gray-50/50 py-6 dark:bg-black sm:py-8 lg:py-12">
            <div className="container mx-auto px-4 sm:px-6">
                <div className="mb-6 sm:mb-8">
                    <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">Password & Security</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 sm:text-base">Manage your password and secure your account.</p>
                </div>

                <div className="flex flex-col gap-5 sm:gap-6 lg:flex-row lg:gap-8">
                    <aside className="w-full flex-shrink-0 lg:sticky lg:top-4 lg:z-10 lg:w-80">
                        <ProfileSidebar />
                    </aside>
                    <main className="min-w-0 flex-1 space-y-6">
                        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
                            <h3 className="mb-6 flex items-center gap-2 text-xl font-bold">
                                <Lock className="h-5 w-5 text-[#F58220]" /> Change Password
                            </h3>

                            <form onSubmit={handleUpdatePassword} className="max-w-md space-y-5">
                                {message ? (
                                    <div
                                        className={cn(
                                            "flex items-center gap-3 rounded-xl border p-4 text-sm",
                                            message.type === "success"
                                                ? "border-green-100 bg-green-50 text-green-700"
                                                : "border-red-100 bg-red-50 text-red-700"
                                        )}
                                    >
                                        {message.type === "success" ? <ShieldCheck className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                                        {message.text}
                                    </div>
                                ) : null}

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">New Password</label>
                                    <div className="relative">
                                        <Input
                                            type={showPassword ? "text" : "password"}
                                            value={passwords.new}
                                            onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                                            className="h-12 rounded-xl border-gray-200 bg-gray-50 pr-12 dark:border-zinc-800 dark:bg-zinc-800/50"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        >
                                            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Confirm New Password</label>
                                    <Input
                                        type={showPassword ? "text" : "password"}
                                        value={passwords.confirm}
                                        onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                                        className="h-12 rounded-xl border-gray-200 bg-gray-50 dark:border-zinc-800 dark:bg-zinc-800/50"
                                        required
                                    />
                                </div>

                                <Button
                                    disabled={loading}
                                    className="h-12 w-full rounded-xl bg-[#F58220] text-white shadow-lg shadow-orange-500/20 hover:bg-[#F58220]/90"
                                >
                                    {loading ? "Updating..." : "Update Password"}
                                </Button>
                            </form>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
                            <div className="flex items-start gap-4 rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-500">
                                    <Smartphone className="h-6 w-6" />
                                </div>
                                <div className="flex-1">
                                    <h4 className="mb-1 font-bold">Two-Factor Authentication</h4>
                                    <p className="mb-4 text-sm text-gray-500">Add an extra layer of security to your account.</p>
                                    <Button variant="outline" size="sm" className="h-9 rounded-lg border-gray-200 text-xs font-bold">Set Up 2FA</Button>
                                </div>
                            </div>

                            <div className="flex items-start gap-4 rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-purple-50 text-purple-500">
                                    <Key className="h-6 w-6" />
                                </div>
                                <div className="flex-1">
                                    <h4 className="mb-1 font-bold">Login History</h4>
                                    <p className="mb-4 text-sm text-gray-500">Monitor where and when you&apos;ve logged in.</p>
                                    <Button variant="outline" size="sm" className="h-9 rounded-lg border-gray-200 text-xs font-bold">View History</Button>
                                </div>
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        </div>
    )
}
