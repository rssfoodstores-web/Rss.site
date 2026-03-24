"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Loader2, Save } from "lucide-react"
import { updateSetting } from "./actions"

interface Setting {
    key: string
    value: any
    description?: string | null
}

export function SettingsForm({ initialSettings }: { initialSettings: Setting[] }) {
    const [settings, setSettings] = useState(initialSettings)
    const [loading, setLoading] = useState<string | null>(null)

    const handleSave = async (key: string, newValue: any) => {
        setLoading(key)
        try {
            await updateSetting(key, newValue)
            toast.success("Setting updated successfully")
            // Update local state to reflect change (though revalidatePath should handle it)
            setSettings(prev => prev.map(s => s.key === key ? { ...s, value: newValue } : s))
        } catch (error) {
            toast.error("Failed to update setting")
            console.error(error)
        } finally {
            setLoading(null)
        }
    }

    const getLabel = (key: string) => {
        switch (key) {
            case "referral_bonus_points": return "Referral Bonus (Points)"
            case "point_value_naira": return "Point Value (₦)"
            case "point_expiration_days": return "Expiration Period (Days)"
            case "referral_min_spend": return "Minimum Order Spend (₦)"
            default: return key
        }
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {settings.map((setting) => (
                <div key={setting.key} className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm">
                    <div className="mb-4">
                        <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-1">
                            {getLabel(setting.key)}
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            {setting.description}
                        </p>
                    </div>

                    <div className="flex gap-2">
                        <input
                            type="number"
                            className="flex-1 px-3 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F58220]/20 focus:border-[#F58220]"
                            defaultValue={setting.value}
                            onBlur={(e) => {
                                const val = parseFloat(e.target.value)
                                if (val !== setting.value) {
                                    handleSave(setting.key, val)
                                }
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.currentTarget.blur()
                                }
                            }}
                        />
                        <div className="flex items-center justify-center w-10">
                            {loading === setting.key ? (
                                <Loader2 className="h-4 w-4 text-[#F58220] animate-spin" />
                            ) : (
                                <div className="text-green-500 opacity-0 transition-opacity duration-500 data-[saved=true]:opacity-100">
                                    <Save className="h-4 w-4" />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}
