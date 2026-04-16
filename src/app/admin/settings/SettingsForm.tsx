"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Loader2, Save } from "lucide-react"
import type { Json } from "@/types/database.types"
import { updateSetting } from "./actions"

interface Setting {
    key: string
    value: Json
    description?: string | null
}

function getNumericSettingValue(value: Json) {
    return typeof value === "number" ? value : Number(value ?? 0)
}

export function SettingsForm({ initialSettings }: { initialSettings: Setting[] }) {
    const [settings, setSettings] = useState(initialSettings)
    const [loading, setLoading] = useState<string | null>(null)

    const handleSave = async (key: string, newValue: number) => {
        setLoading(key)
        try {
            await updateSetting(key, newValue)
            toast.success("Setting updated successfully")
            setSettings((prev) => prev.map((setting) => (
                setting.key === key
                    ? { ...setting, value: newValue }
                    : setting
            )))
        } catch (error) {
            toast.error("Failed to update setting")
            console.error(error)
        } finally {
            setLoading(null)
        }
    }

    const getLabel = (key: string) => {
        switch (key) {
            case "referral_bonus_points":
                return "Referral Bonus (Points)"
            case "point_value_naira":
                return "Point Value (Naira)"
            case "point_expiration_days":
                return "Expiration Period (Days)"
            case "referral_min_spend":
                return "Minimum Order Spend (Naira)"
            default:
                return key
        }
    }

    return (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {settings.map((setting) => (
                <div key={setting.key} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="mb-4">
                        <label className="mb-1 block text-sm font-semibold text-gray-900 dark:text-white">
                            {getLabel(setting.key)}
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            {setting.description}
                        </p>
                    </div>

                    <div className="flex gap-2">
                        <input
                            type="number"
                            className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-[#F58220] focus:outline-none focus:ring-2 focus:ring-[#F58220]/20 dark:border-zinc-700 dark:bg-zinc-800"
                            defaultValue={getNumericSettingValue(setting.value)}
                            onBlur={(event) => {
                                const nextValue = parseFloat(event.target.value)
                                if (!Number.isNaN(nextValue) && nextValue !== getNumericSettingValue(setting.value)) {
                                    handleSave(setting.key, nextValue)
                                }
                            }}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                    event.currentTarget.blur()
                                }
                            }}
                        />
                        <div className="flex w-10 items-center justify-center">
                            {loading === setting.key ? (
                                <Loader2 className="h-4 w-4 animate-spin text-[#F58220]" />
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
