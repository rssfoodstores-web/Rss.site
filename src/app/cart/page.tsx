"use client"

import { useEffect, useRef, useState, type MouseEvent } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import {
    Minus,
    Plus,
    ArrowLeft,
    ShoppingBag,
    Trash2,
    MapPin,
    CreditCard,
    Loader2,
    Wallet,
    Gift,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCart } from "@/context/CartContext"
import { buildOptimizedImageUrl } from "@/lib/imageDelivery"
import { formatKobo } from "@/lib/money"
import { useUser } from "@/context/UserContext"
import { toast } from "sonner"
import { quoteDeliveryAddress, type MerchantDeliveryQuote } from "@/app/actions/deliveryAddresses"
import { DeliveryAddressForm } from "@/components/account/DeliveryAddressForm"
import { DeliveryDestinationPicker } from "@/components/account/DeliveryDestinationPicker"
import { useDeliveryDestination } from "@/context/DeliveryDestinationContext"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
    getRewardCheckoutSummary,
    type RewardCheckoutSummary,
} from "@/app/account/rewards/actions"
import { initiateDirectPayment, processGiftCardPayment, processWalletPayment } from "@/app/actions/orderActions"

type PaymentMethod = "direct" | "wallet" | "giftCard"
type OrderPayload = Parameters<typeof processWalletPayment>[0]

interface CartLocationResponse {
    phone_numbers: string[]
}

interface CartBalancesResponse {
    gift_card_balance: number
    wallet_balance: number
}

const EMPTY_CONTACT_NUMBERS = ["", "", ""]

function normalizeContactNumbers(numbers: string[] | undefined) {
    const nextNumbers = [...EMPTY_CONTACT_NUMBERS]

    numbers?.slice(0, 3).forEach((number, index) => {
        nextNumbers[index] = number ?? ""
    })

    return nextNumbers
}

export default function CartPage() {
    const { items: cartItems, removeFromCart, updateQuantity, cartTotal, clearCart } = useCart()
    const { user } = useUser()
    const router = useRouter()
    const { destination, selectedAddress, selectDestination } = useDeliveryDestination()
    const [confirmingGps, setConfirmingGps] = useState(false)
    const deliveryPicker = useRef<HTMLButtonElement>(null)
    const checkoutTrigger = useRef<HTMLButtonElement>(null)
    const [quote, setQuote] = useState<{ key: string; fee: number; subtotal: number; groups: MerchantDeliveryQuote[]; error?: string } | null>(null)
    const [quoteRevision, setQuoteRevision] = useState(0)
    const paymentAttempt = useRef<{ key: string; id: string } | null>(null)
    const submissionLock = useRef(false)
    const itemsKey = JSON.stringify(cartItems.map(({ id, quantity }) => ({ product_id: id, quantity })))
    const addressId = selectedAddress?.id
    const quoteKey = selectedAddress ? JSON.stringify([selectedAddress, itemsKey, quoteRevision]) : null
    const activeQuote = quoteKey && quote?.key === quoteKey ? quote : null
    const deliveryFeeKobo = activeQuote?.fee ?? 0
    const multiStore = new Set(cartItems.map(({ merchantId }) => merchantId)).size > 1
    const subtotalKobo = activeQuote && !activeQuote.error ? activeQuote.subtotal : cartTotal
    const storeByMerchant = new Map(activeQuote?.groups.map((group) => [group.merchant_id, group.store_name]))
    const quotedPrices = new Map(activeQuote?.groups.flatMap((group) => group.items.map((item) => [item.product_id, item.price] as const)))
    const agentPriceAdjustment = activeQuote?.groups.reduce((total, group) =>
        total + group.items.reduce((sum, item) => sum + (item.agent_price_adjustment ?? 0) * item.quantity, 0), 0) ?? 0

    const displayedItems = cartItems.map((item) => ({ ...item, price: quotedPrices.get(item.id) ?? item.price }))
        .sort((a, b) => a.merchantId.localeCompare(b.merchantId))
    const deliveryFeeError = activeQuote?.error
    const isCalculatingFee = Boolean(quoteKey && !activeQuote)
    const [contactNumbers, setContactNumbers] = useState<string[]>(EMPTY_CONTACT_NUMBERS)

    // Checkout State
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null)
    const [walletBalance, setWalletBalance] = useState<number | null>(null)
    const [isLoadingBalance, setIsLoadingBalance] = useState(false)
    const [giftCardBalance, setGiftCardBalance] = useState<number | null>(null)

    // Rewards State
    const [rewardSummary, setRewardSummary] = useState<RewardCheckoutSummary | null>(null)
    const [rewardPointsInput, setRewardPointsInput] = useState<string>("")
    const rewardPoints = !multiStore && rewardSummary?.enabled
        ? Math.min(Math.max(Number.parseInt(rewardPointsInput, 10) || 0, 0), rewardSummary.maxRedeemablePoints)
        : 0
    const rewardDiscountKobo = rewardPoints * (rewardSummary?.pointValueKobo ?? 0)

    useEffect(() => {
        if (!user) return
        let active = true
        fetch("/api/user/profile-location", { cache: "no-store" })
            .then(async (response) => {
                if (!response.ok || !active) return
                const data = await response.json() as CartLocationResponse
                if (active) setContactNumbers(normalizeContactNumbers(data.phone_numbers))
            }).catch(() => undefined)
        return () => { active = false }
    }, [user])

    useEffect(() => {
        let active = true
        if (user && !multiStore && subtotalKobo > 0) {
            getRewardCheckoutSummary(subtotalKobo)
                .then((summary) => { if (active) setRewardSummary(summary) })
                .catch(() => { if (active) setRewardSummary(null) })
        }
        return () => { active = false }
    }, [multiStore, subtotalKobo, user])

    // Fetch Balances when Checkout Opens
    useEffect(() => {
        if (isCheckoutOpen && user) {
            const fetchBalances = async () => {
                setIsLoadingBalance(true)
                try {
                    const response = await fetch("/api/user/balances", { cache: "no-store" })
                    if (response.ok) {
                        const data = await response.json() as CartBalancesResponse
                        setWalletBalance(data.wallet_balance)
                        setGiftCardBalance(data.gift_card_balance)
                    }
                } catch (error) {
                    console.error("Error fetching balances:", error)
                } finally {
                    setIsLoadingBalance(false)
                }
            }
            void fetchBalances()
        }
    }, [isCheckoutOpen, user])

    useEffect(() => {
        if (!addressId || !quoteKey || itemsKey === "[]") return
        let active = true
        quoteDeliveryAddress(addressId, JSON.parse(itemsKey))
            .then((result) => { if (active) setQuote({ key: quoteKey, ...result }) })
            .catch(() => {
                if (active) setQuote({ key: quoteKey, fee: 0, subtotal: 0, groups: [], error: "Could not calculate delivery. Please try again." })
            })
        return () => { active = false }
    }, [addressId, itemsKey, quoteKey])

    const total = Math.max(0, (subtotalKobo - (multiStore ? 0 : rewardDiscountKobo)) + deliveryFeeKobo)

    const handleProceedToCheckout = (event: MouseEvent<HTMLButtonElement>) => {
        if (!user) {
            toast.error("Please login to proceed to checkout")
            router.push('/login?callback=/cart')
            return
        }
        if (!selectedAddress || !activeQuote) return
        if (deliveryFeeError) {
            toast.error(deliveryFeeError)
            return
        }
        checkoutTrigger.current = event.currentTarget
        setPaymentMethod(null)
        setWalletBalance(null)
        setGiftCardBalance(null)
        setIsCheckoutOpen(true)
    }

    const getCommonPayload = (): OrderPayload | null => {
        if (!user || !selectedAddress || !activeQuote || activeQuote.error) return null

        const points = rewardPoints
        const attemptKey = JSON.stringify([user.id, addressId, itemsKey, subtotalKobo, deliveryFeeKobo, points])
        if (paymentAttempt.current?.key !== attemptKey) {
            const storageKey = "rss-checkout-attempt"
            let id = crypto.randomUUID()
            try {
                const stored = JSON.parse(sessionStorage.getItem(storageKey) ?? "null")
                if (stored?.key === attemptKey && typeof stored.id === "string") id = stored.id
                sessionStorage.setItem(storageKey, JSON.stringify({ key: attemptKey, id }))
            } catch { /* Checkout also works without browser storage. */ }
            paymentAttempt.current = { key: attemptKey, id }
        }
        return {
            userId: user.id,
            checkoutAttemptId: paymentAttempt.current.id,
            quotedSubtotal: subtotalKobo,
            items: cartItems.map((item) => ({
                product_id: item.id,
                quantity: item.quantity,
            })),
            addressId: selectedAddress.id,
            deliveryLocation: {
                type: "Point" as const,
                coordinates: [selectedAddress.lng, selectedAddress.lat],
            },
            deliveryFeeKobo,
            contactNumbers: contactNumbers.filter((number) => number.trim() !== ""),
            rewardPointsToRedeem: points,
        }
    }

    const handleWalletPayment = async () => {
        if (!user || submissionLock.current) return
        submissionLock.current = true
        setIsProcessing(true)
        try {
            const payload = getCommonPayload()
            if (!payload) return
            const result = await processWalletPayment(payload)

            if (result.success) {
                toast.success("Order placed successfully using wallet balance!")
                clearCart()
                paymentAttempt.current = null
                try { sessionStorage.removeItem("rss-checkout-attempt") } catch { /* Optional browser persistence. */ }
                router.push(`/account/orders?orderId=${result.orderId}`)
            } else {
                setQuoteRevision((revision) => revision + 1)
                toast.error(result.error || "Failed to process wallet payment")
            }
        } catch {
            toast.error("An unexpected error occurred")
        } finally {
            submissionLock.current = false
            setIsProcessing(false)
            setIsCheckoutOpen(false)
        }
    }

    const handleGiftCardPayment = async () => {
        if (!user || submissionLock.current) return
        submissionLock.current = true
        setIsProcessing(true)
        try {
            const payload = getCommonPayload()
            if (!payload) return
            const result = await processGiftCardPayment(payload)

            if (result.success) {
                toast.success("Order placed successfully using gift card balance!")
                clearCart()
                paymentAttempt.current = null
                try { sessionStorage.removeItem("rss-checkout-attempt") } catch { /* Optional browser persistence. */ }
                router.push(`/account/orders?orderId=${result.orderId}`)
            } else {
                setQuoteRevision((revision) => revision + 1)
                toast.error(result.error || "Failed to process gift card payment")
            }
        } catch {
            toast.error("An unexpected error occurred")
        } finally {
            submissionLock.current = false
            setIsProcessing(false)
            setIsCheckoutOpen(false)
        }
    }

    const handleDirectPayment = async () => {
        if (!user || submissionLock.current) return
        submissionLock.current = true
        setIsProcessing(true)
        try {
            const payload = getCommonPayload()
            if (!payload) return
            const result = await initiateDirectPayment(payload)

            if (result.success && result.checkoutUrl) {
                toast.success("Redirecting to payment gateway...")
                try { sessionStorage.setItem("rss-pending-order", JSON.stringify({ orderId: result.orderId, itemsKey })) }
                catch { /* The order remains visible in Order History. */ }
                window.location.href = result.checkoutUrl
            } else if (result.success && result.orderId) {
                clearCart()
                paymentAttempt.current = null
                try { sessionStorage.removeItem("rss-checkout-attempt") } catch { /* Optional browser persistence. */ }
                router.push(`/account/orders/${result.orderId}`)
            } else {
                if (result.resetAttempt) {
                    paymentAttempt.current = null
                    try { sessionStorage.removeItem("rss-checkout-attempt") } catch { /* Optional browser persistence. */ }
                }
                setQuoteRevision((revision) => revision + 1)
                toast.error(result.error || "Failed to initialize direct payment")
            }
        } catch {
            toast.error("An unexpected error occurred")
        } finally {
            submissionLock.current = false
            setIsProcessing(false)
            setIsCheckoutOpen(false)
        }
    }

    const updateContactNumber = (index: number, value: string) => {
        const newNumbers = [...contactNumbers]
        newNumbers[index] = value
        setContactNumbers(newNumbers)
    }

    if (cartItems.length === 0) {
        return (
            <main className="mx-auto max-w-lg px-4 py-16 text-center">
                <Image src="/images/cart image.png" alt="" width={320} height={200} className="mx-auto mb-6 h-auto" />
                <h1 className="text-3xl font-bold tracking-tight">Your cart is empty</h1>
                <Button asChild className="mt-5 min-h-11 bg-[#F58220] text-gray-950 hover:bg-orange-400">
                    <Link href="/">Continue shopping</Link>
                </Button>
            </main>
        )
    }

    const groups = new Map<string, typeof displayedItems>()
    for (const item of displayedItems) {
        const store = groups.get(item.merchantId)
        if (store) store.push(item)
        else groups.set(item.merchantId, [item])
    }
    const quoteReady = Boolean(selectedAddress && activeQuote && !activeQuote.error)
    const itemCount = cartItems.reduce((count, item) => count + item.quantity, 0)
    const deliveryLabel = quoteReady ? formatKobo(deliveryFeeKobo)
        : isCalculatingFee ? "Calculating…" : deliveryFeeError ? "Unavailable" : "Choose an address"
    const ctaText = user ? "Continue to payment" : "Sign in to check out"
    const needsAddress = Boolean(user && !selectedAddress)
    const addressCta = destination?.kind === "gps" ? "Confirm delivery address" : "Choose delivery address"
    const chooseAddress = () => {
        if (destination?.kind === "gps") {
            setConfirmingGps(true)
            deliveryPicker.current?.scrollIntoView({ block: "center" })
        } else {
            deliveryPicker.current?.focus()
            deliveryPicker.current?.click()
        }
    }
    const paymentOptions = [
        { id: "direct", label: "Card or bank payment", detail: "Card, bank transfer or USSD", icon: CreditCard, unavailable: total <= 0 },
        { id: "wallet", label: "RSS Wallet", balance: walletBalance, icon: Wallet },
        { id: "giftCard", label: "Gift card", balance: giftCardBalance, icon: Gift },
    ] as const
    const paymentUnavailable = (option: (typeof paymentOptions)[number]) => "balance" in option
        ? isLoadingBalance || option.balance === null || option.balance < total
        : option.unavailable
    const selectedPayment = paymentOptions.find(({ id }) => id === paymentMethod)
    const paymentDisabled = !selectedPayment || paymentUnavailable(selectedPayment) || isProcessing || !quoteReady
    const pay = paymentMethod === "wallet" ? handleWalletPayment
        : paymentMethod === "giftCard" ? handleGiftCardPayment : handleDirectPayment

    const costBreakdown = (
        <dl className="space-y-2 text-sm tabular-nums">
            <div className="flex justify-between gap-3"><dt>Items subtotal</dt><dd className="shrink-0">{formatKobo(subtotalKobo)}</dd></div>
            {quoteReady && agentPriceAdjustment !== 0 && <div className="flex justify-between gap-3 pl-3 text-xs text-muted-foreground">
                <dt>Agent commission adjustment included above</dt>
                <dd className="shrink-0">{agentPriceAdjustment < 0 ? "−" : "+"}{formatKobo(Math.abs(agentPriceAdjustment))}</dd>
            </div>}
            <div className="flex justify-between gap-3"><dt>Delivery{multiStore ? " across stores" : ""}</dt><dd className="text-right">{deliveryLabel}</dd></div>
            {multiStore && quoteReady && activeQuote?.groups.map((group, index) => (
                <div key={group.merchant_id} className="flex justify-between gap-3 border-l pl-3 text-muted-foreground">
                    <dt className="min-w-0 break-words">{group.store_name === "Store" ? `Store ${index + 1}` : group.store_name}</dt>
                    <dd className="shrink-0">{formatKobo(group.fee)}</dd>
                </div>
            ))}
            {rewardDiscountKobo > 0 && <div className="flex justify-between gap-3"><dt>Reward discount</dt><dd>−{formatKobo(rewardDiscountKobo)}</dd></div>}
            <div className="flex items-baseline justify-between gap-3 border-t pt-3 font-semibold">
                <dt>{quoteReady ? "Total to pay" : "Order total"}</dt>
                <dd className="text-right">{quoteReady ? formatKobo(total) : "Pending delivery quote"}</dd>
            </div>
        </dl>
    )

    return (
        <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:pb-12 lg:pt-10">
            <Link href="/" className="inline-flex min-h-10 items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                <ArrowLeft className="size-4" aria-hidden="true" /> Continue shopping
            </Link>
            <header className="mb-5 mt-1 flex items-baseline justify-between gap-3">
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Your cart</h1>
                <span className="shrink-0 text-sm text-muted-foreground">{itemCount} {itemCount === 1 ? "item" : "items"}</span>
            </header>

            <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
                <div className="min-w-0 space-y-5">
                    <section id="cart-delivery" aria-labelledby="cart-delivery-title" className="scroll-mt-28 space-y-3 rounded-2xl border bg-card p-4 sm:p-5">
                        <h2 id="cart-delivery-title" className="flex items-center gap-2 font-semibold">
                            <MapPin className="size-5 text-[#b14b08] dark:text-orange-300" aria-hidden="true" /> Delivery address
                        </h2>
                        <DeliveryDestinationPicker triggerRef={deliveryPicker} onDestinationChange={() => setConfirmingGps(false)} />
                        {selectedAddress ? <p className="break-words text-sm text-muted-foreground">{selectedAddress.address}</p> :
                            <p className="text-sm text-muted-foreground">Choose an address to see your delivery fees and total.</p>}
                        {destination?.kind === "gps" && user && (confirmingGps ? (
                            <DeliveryAddressForm
                                key={`${destination.location.lat},${destination.location.lng}`}
                                initial={{ label: destination.details?.area || "Current location", address: destination.details?.address, ...destination.location }}
                                initialState={destination.state}
                                onSaved={(address) => {
                                    selectDestination({ kind: "address", id: address.id })
                                    setConfirmingGps(false)
                                }}
                            />
                        ) : <Button type="button" variant="outline" onClick={() => setConfirmingGps(true)}>Confirm this delivery address</Button>)}
                        {deliveryFeeError && <div className="space-y-2">
                            <p role="alert" className="text-sm text-destructive">{deliveryFeeError}</p>
                            <Button type="button" variant="outline" onClick={() => setQuoteRevision((revision) => revision + 1)}>Recalculate delivery</Button>
                        </div>}
                    </section>

                    <section aria-labelledby="cart-items-title" className="min-w-0 overflow-hidden rounded-2xl border bg-card">
                        <h2 id="cart-items-title" className="px-4 py-3 font-semibold sm:px-5">Items</h2>
                        {Array.from(groups, ([merchantId, items], index) => {
                            const name = storeByMerchant.get(merchantId)
                            return (
                                <div className="border-t" key={merchantId}>
                                    {(multiStore || (name && name !== "Store")) && (
                                        <h3 className="bg-muted/40 px-4 py-2 text-sm font-medium sm:px-5">
                                            {name && name !== "Store" ? name : `Store ${index + 1}`}
                                        </h3>
                                    )}
                                    <ul className="divide-y">
                                        {items.map((item) => (
                                            <li key={item.id} className="flex min-w-0 items-start gap-3 px-4 py-3 sm:px-5">
                                                <span className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted sm:size-14">
                                                    {item.image
                                                        ? <Image src={buildOptimizedImageUrl(item.image, { width: 112 })} alt="" fill sizes="56px" unoptimized className="object-cover" />
                                                        : <ShoppingBag className="size-5 text-muted-foreground" aria-hidden="true" />}
                                                </span>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                                                        <p className="min-w-0 break-words text-sm font-semibold">{item.name}</p>
                                                        <p className="text-sm font-semibold tabular-nums">{formatKobo(item.price * item.quantity)}</p>
                                                    </div>
                                                    <p className="mt-0.5 text-xs text-muted-foreground">{formatKobo(item.price)} each</p>
                                                    <div className="mt-1 flex flex-wrap items-center justify-between gap-1">
                                                        <div className="inline-flex items-center rounded-lg border" aria-label={`Quantity for ${item.name}`}>
                                                            <button type="button" disabled={item.quantity <= 1} aria-label={`Decrease quantity of ${item.name}`}
                                                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                                                className="grid min-h-10 min-w-10 place-items-center rounded-l-lg hover:bg-muted disabled:opacity-40">
                                                                <Minus className="size-4" aria-hidden="true" />
                                                            </button>
                                                            <span className="min-w-6 text-center text-sm tabular-nums" aria-live="polite">{item.quantity}</span>
                                                            <button type="button" aria-label={`Increase quantity of ${item.name}`}
                                                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                                                className="grid min-h-10 min-w-10 place-items-center rounded-r-lg hover:bg-muted">
                                                                <Plus className="size-4" aria-hidden="true" />
                                                            </button>
                                                        </div>
                                                        <Button type="button" variant="ghost" size="icon" className="size-10 text-muted-foreground"
                                                            aria-label={`Remove ${item.name}`} onClick={() => removeFromCart(item.id)}>
                                                            <Trash2 className="size-4" aria-hidden="true" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )
                        })}
                    </section>
                </div>

                <section aria-labelledby="cart-cost-title" className="space-y-3 rounded-2xl border bg-card p-4 sm:p-5 lg:sticky lg:top-24">
                    <h2 id="cart-cost-title" className="font-semibold">Order summary</h2>
                    <div aria-live="polite">{costBreakdown}</div>
                    {multiStore && quoteReady && <p className="text-xs text-muted-foreground">Delivery is calculated separately for each store.</p>}
                    <div className="hidden lg:block">
                        <Button type="button" onClick={needsAddress ? chooseAddress : handleProceedToCheckout} disabled={Boolean(user && !needsAddress && !quoteReady)}
                            className="h-11 w-full bg-[#F58220] text-gray-950 hover:bg-orange-400">{needsAddress ? addressCta : ctaText}</Button>
                    </div>
                </section>
            </div>

            <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
                <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-x-3 gap-y-2">
                    <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">{quoteReady ? "Total to pay" : "Items subtotal"}</p>
                        <p className="font-semibold tabular-nums">{formatKobo(quoteReady ? total : subtotalKobo)}</p>
                    </div>
                    <Button type="button" onClick={needsAddress ? chooseAddress : handleProceedToCheckout} disabled={Boolean(user && !needsAddress && !quoteReady)}
                        className="min-h-11 bg-[#F58220] text-gray-950 hover:bg-orange-400">{needsAddress ? addressCta : ctaText}</Button>
                </div>
            </div>

            <Dialog open={isCheckoutOpen} onOpenChange={(open) => { if (!isProcessing) setIsCheckoutOpen(open) }}>
                <DialogContent className="flex h-dvh max-h-dvh w-full max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-auto sm:max-h-[90dvh] sm:max-w-xl sm:rounded-2xl"
                    onCloseAutoFocus={(event) => {
                        if (!checkoutTrigger.current?.isConnected) return
                        event.preventDefault()
                        checkoutTrigger.current.focus()
                    }}>
                    <DialogHeader className="shrink-0 border-b px-4 py-4 pr-12 text-left sm:px-6 sm:pr-12">
                        <DialogTitle>Checkout</DialogTitle>
                        <DialogDescription>Review your delivery and payment before placing the order.</DialogDescription>
                    </DialogHeader>
                    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
                        <section className="space-y-3 rounded-xl bg-muted/50 p-3 sm:p-4" aria-label="Checkout summary">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <h3 className="text-sm font-semibold">Deliver to {selectedAddress?.label}</h3>
                                    <p className="break-words text-sm text-muted-foreground">{selectedAddress?.address}</p>
                                </div>
                                <Button type="button" variant="ghost" size="sm" disabled={isProcessing} onClick={() => setIsCheckoutOpen(false)}>Edit cart</Button>
                            </div>
                            <div aria-live="polite">{costBreakdown}</div>
                            {deliveryFeeError && <p role="alert" className="text-sm text-destructive">{deliveryFeeError}</p>}
                        </section>

                        <section className="space-y-2" aria-label="Delivery contact">
                            <label htmlFor="delivery-phone" className="text-sm font-semibold">Phone for delivery</label>
                            <Input id="delivery-phone" type="tel" autoComplete="tel" value={contactNumbers[0]} disabled={isProcessing}
                                onChange={(event) => updateContactNumber(0, event.target.value)} className="min-h-11 text-base" />
                            <details>
                                <summary className="cursor-pointer py-2 text-sm text-muted-foreground">Backup phone numbers (optional)</summary>
                                <div className="grid gap-2 sm:grid-cols-2">
                                    {[1, 2].map((index) => (
                                        <label className="grid gap-1 text-sm" key={index}>
                                            Backup phone {index}
                                            <Input type="tel" value={contactNumbers[index]} disabled={isProcessing}
                                                onChange={(event) => updateContactNumber(index, event.target.value)} className="min-h-11 text-base" />
                                        </label>
                                    ))}
                                </div>
                            </details>
                        </section>

                        {!multiStore && rewardSummary?.enabled && rewardSummary.maxRedeemablePoints > 0 && (
                            <details className="border-y py-2">
                                <summary className="cursor-pointer py-2 text-sm font-medium">Use reward points ({rewardSummary.availablePoints.toLocaleString()} available)</summary>
                                <div className="mt-2 flex items-end gap-2">
                                    <label className="grid min-w-0 flex-1 gap-1 text-sm">Points to use
                                        <Input type="number" min={0} max={rewardSummary.maxRedeemablePoints} value={rewardPointsInput} disabled={isProcessing}
                                            onChange={(event) => setRewardPointsInput(event.target.value)} className="min-h-11 text-base" />
                                    </label>
                                    <Button type="button" variant="outline" className="min-h-11" disabled={isProcessing}
                                        onClick={() => setRewardPointsInput(String(rewardSummary.maxRedeemablePoints))}>Use max</Button>
                                </div>
                            </details>
                        )}

                        <fieldset className="grid min-w-0 gap-2" disabled={isProcessing}>
                            <legend className="mb-2 font-semibold">Payment method</legend>
                            {paymentOptions.map((option) => {
                                const unavailable = paymentUnavailable(option)
                                const Icon = option.icon
                                const detail = "balance" in option
                                    ? isLoadingBalance ? "Checking balance…" : option.balance === null ? "Balance unavailable"
                                        : `${formatKobo(option.balance)} available${unavailable ? " · Insufficient balance" : ""}`
                                    : option.detail
                                return (
                                    <label key={option.id} className="flex min-h-14 items-center gap-3 rounded-xl border px-3 py-2 has-[:checked]:border-orange-400 has-[:checked]:bg-orange-50 dark:has-[:checked]:bg-orange-950/30">
                                        <input type="radio" name="checkout-payment" className="size-4 shrink-0 accent-[#b14b08]" checked={paymentMethod === option.id}
                                            disabled={unavailable} onChange={() => setPaymentMethod(option.id)} />
                                        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                                        <span className="min-w-0">
                                            <span className="block text-sm font-medium">{option.label}</span>
                                            <span className="block text-xs text-muted-foreground">{detail}</span>
                                        </span>
                                    </label>
                                )
                            })}
                        </fieldset>
                    </div>

                    <div className="shrink-0 space-y-2 border-t bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
                        <Button type="button" disabled={paymentDisabled} onClick={() => void pay()}
                            className="min-h-11 w-full bg-[#F58220] text-gray-950 hover:bg-orange-400">
                            {isProcessing ? <><Loader2 className="size-4 animate-spin" aria-hidden="true" /> Processing…</> :
                                quoteReady ? `Pay ${formatKobo(total)}` : "Waiting for delivery quote"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </main>
    )
}
