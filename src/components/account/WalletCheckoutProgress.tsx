import { ShieldCheck } from "lucide-react"

export function WalletCheckoutProgress() {
    return (
        <div role="status" aria-live="polite" className="space-y-4 rounded-2xl border border-orange-200/80 bg-gradient-to-br from-orange-50 via-white to-orange-50/50 p-5 shadow-sm motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300 dark:border-orange-900/50 dark:from-orange-950/25 dark:via-zinc-900 dark:to-zinc-900">
            <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300"><ShieldCheck className="h-5 w-5" aria-hidden="true" /></span>
                <div>
                    <p className="text-sm font-semibold text-gray-950 dark:text-white">Preparing your secure checkout</p>
                    <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-400">Creating your payment link with Monnify. This may take a moment.</p>
                </div>
            </div>
            <div role="progressbar" aria-label="Preparing Monnify checkout" className="relative h-1.5 overflow-hidden rounded-full bg-orange-100 dark:bg-orange-950/70">
                <span aria-hidden="true" className="wallet-checkout-progress absolute inset-y-0 left-0 w-1/3 rounded-full bg-gradient-to-r from-orange-400 via-[#F58220] to-orange-300 shadow-[0_0_12px_rgba(245,130,32,0.35)] motion-reduce:left-1/3" />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Please keep this page open while we prepare your link.</p>
        </div>
    )
}
