"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Send } from "lucide-react"
import { toast } from "sonner"
import { submitAgentPriceInput } from "@/app/actions/productActions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

interface SubmitAgentPriceInputFormProps {
    productId: string
    productName: string
    defaultAmountNaira: string
    defaultNotes?: string | null
}

export function SubmitAgentPriceInputForm({
    productId,
    productName,
    defaultAmountNaira,
    defaultNotes,
}: SubmitAgentPriceInputFormProps) {
    const router = useRouter()
    const [amount, setAmount] = useState(defaultAmountNaira)
    const [notes, setNotes] = useState(defaultNotes ?? "")
    const [isPending, startTransition] = useTransition()

    const handleSubmit = () => {
        const parsedAmount = Number(amount)

        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
            toast.error("Enter a valid survey price greater than zero.")
            return
        }

        startTransition(async () => {
            try {
                await submitAgentPriceInput(productId, parsedAmount, notes.trim() || undefined)
                toast.success(`Survey price saved for ${productName}.`)
                router.refresh()
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Unable to save survey price.")
            }
        })
    }

    return (
        <div className="space-y-3 rounded-2xl border border-orange-100 bg-orange-50/60 p-4 dark:border-orange-950 dark:bg-orange-950/10">
            <div className="space-y-1">
                <label htmlFor={`agent-price-${productId}`} className="text-sm font-semibold text-gray-900 dark:text-white">
                    Survey price (NGN)
                </label>
                <Input
                    id={`agent-price-${productId}`}
                    type="number"
                    min="0.01"
                    step="0.01"
                    inputMode="decimal"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    className="h-11 rounded-xl border-orange-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
                    placeholder="Enter market survey price"
                />
            </div>

            <div className="space-y-1">
                <label htmlFor={`agent-notes-${productId}`} className="text-sm font-semibold text-gray-900 dark:text-white">
                    Notes
                </label>
                <Textarea
                    id={`agent-notes-${productId}`}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    className="min-h-[96px] rounded-xl border-orange-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
                    placeholder="Add price observations, sourcing notes, or market context."
                />
            </div>

            <Button
                type="button"
                onClick={handleSubmit}
                disabled={isPending}
                className="h-11 rounded-xl bg-[#F58220] px-5 font-semibold text-white hover:bg-[#E57210]"
            >
                {isPending ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                    </>
                ) : (
                    <>
                        <Send className="mr-2 h-4 w-4" />
                        Save Survey Price
                    </>
                )}
            </Button>
        </div>
    )
}
