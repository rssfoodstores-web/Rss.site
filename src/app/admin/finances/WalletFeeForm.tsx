"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import type { WalletFeeSettings } from "@/lib/walletFees"
import { saveWalletFeeSettings } from "./actions"

const fields: Array<{ key: keyof WalletFeeSettings; label: string; kind: "percent" | "naira" }> = [
    { key: "collectionFeeBps", label: "Monnify collection fee", kind: "percent" },
    { key: "collectionFeeCapKobo", label: "Collection fee cap", kind: "naira" },
    { key: "feeVatBps", label: "VAT on provider fees", kind: "percent" },
    { key: "rssTopupFeeBps", label: "RSS top-up service fee", kind: "percent" },
    { key: "payoutBelow10kKobo", label: "Transfer fee below ₦10,000", kind: "naira" },
    { key: "payoutBelow50kKobo", label: "Transfer fee ₦10,000–₦49,999", kind: "naira" },
    { key: "payout50kPlusKobo", label: "Transfer fee ₦50,000 and above", kind: "naira" },
    { key: "rssWithdrawalFeeBps", label: "RSS withdrawal service fee", kind: "percent" },
]

export function WalletFeeForm({ initialSettings }: { initialSettings: WalletFeeSettings }) {
    const [settings, setSettings] = useState(initialSettings)
    const [saving, setSaving] = useState(false)
    return <div className="rounded-2xl border bg-white p-6 dark:bg-zinc-900">
        <div className="grid gap-5 md:grid-cols-2">
            {fields.map((field) => <label key={field.key} className="space-y-2 text-sm font-semibold">
                <span>{field.label}</span>
                <div className="flex items-center rounded-xl border bg-gray-50 px-3 dark:bg-zinc-800">
                    <input className="h-11 min-w-0 flex-1 bg-transparent outline-none" type="number" min="0" step="0.01"
                        value={field.kind === "percent" ? settings[field.key] / 100 : settings[field.key] / 100}
                        onChange={(event) => setSettings((current) => ({ ...current, [field.key]: Math.round(Number(event.target.value || 0) * 100) }))} />
                    <span className="text-gray-500">{field.kind === "percent" ? "%" : "₦"}</span>
                </div>
            </label>)}
        </div>
        <p className="mt-5 text-xs text-amber-700">Confirm changes against your Monnify contract. They affect new transactions immediately.</p>
        <Button className="mt-5 bg-[#F58220] text-white" disabled={saving} onClick={async () => {
            setSaving(true)
            try { await saveWalletFeeSettings(settings); toast.success("Wallet fee rules saved") }
            catch (error) { toast.error(error instanceof Error ? error.message : "Unable to save") }
            finally { setSaving(false) }
        }}>{saving ? "Saving…" : "Save finance rules"}</Button>
    </div>
}

