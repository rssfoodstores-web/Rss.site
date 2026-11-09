"use client"

import { useState } from "react"
import { Eye, EyeOff, ShieldCheck, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

export function ChangePasswordForm() {
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

        try {
            const supabase = createClient()
            const { error } = await supabase.auth.updateUser({ password: passwords.new })
            if (error) {
                setMessage({ type: "error", text: error.message })
            } else {
                setMessage({ type: "success", text: "Password updated." })
                setPasswords({ new: "", confirm: "" })
            }
        } catch {
            setMessage({ type: "error", text: "Could not update your password. Please try again." })
        } finally {
            setLoading(false)
        }
    }

    return (
        <form onSubmit={handleUpdatePassword} className="max-w-md space-y-5">
            {message ? (
                <div
                    role={message.type === "success" ? "status" : "alert"}
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
                <label htmlFor="new-account-password" className="text-sm font-bold text-gray-700 dark:text-gray-300">New Password</label>
                <div className="relative">
                    <Input id="new-account-password" autoComplete="new-password" minLength={6}
                        type={showPassword ? "text" : "password"}
                        value={passwords.new}
                        onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                        className="h-12 rounded-xl border-gray-200 bg-gray-50 pr-12 dark:border-zinc-800 dark:bg-zinc-800/50"
                        required
                    />
                    <button
                        type="button"
                        aria-label={showPassword ? "Hide passwords" : "Show passwords"}
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                </div>
            </div>

            <div className="space-y-2">
                <label htmlFor="confirm-account-password" className="text-sm font-bold text-gray-700 dark:text-gray-300">Confirm New Password</label>
                <Input id="confirm-account-password" autoComplete="new-password" minLength={6}
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
    )
}
