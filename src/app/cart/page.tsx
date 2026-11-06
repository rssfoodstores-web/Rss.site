"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import {
    Minus,
    Plus,
    X,
    MapPin,
    Smartphone,
    CreditCard,
    Home,
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
type PaymentOptionColor = "orange" | "violet"

interface CartLocationResponse {
    phone_numbers: string[]
}

interface CartBalancesResponse {
    gift_card_balance: number
    gift_card_count: number
    wallet_balance: number
}

interface PaymentOptionProps {
    color: PaymentOptionColor
    icon: ReactNode
    isDisabled: boolean
    isSelected: boolean
    onClick: () => void
    subtitle: string
    title: string
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
    const [giftCardCount, setGiftCardCount] = useState<number>(0)

    // Rewards State
    const [rewardSummary, setRewardSummary] = useState<RewardCheckoutSummary | null>(null)
    const [rewardPointsInput, setRewardPointsInput] = useState<string>("")
    const [rewardDiscountKobo, setRewardDiscountKobo] = useState<number>(0)

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

    // Calculate Rewards Discount
    useEffect(() => {
        if (multiStore || !rewardSummary?.enabled || !rewardPointsInput) {
            setRewardDiscountKobo(0)
            return
        }

        const points = parseInt(rewardPointsInput)
        if (isNaN(points) || points <= 0) {
            setRewardDiscountKobo(0)
            return
        }

        const clampedPoints = Math.min(points, rewardSummary.maxRedeemablePoints)
        setRewardDiscountKobo(clampedPoints * rewardSummary.pointValueKobo)
    }, [multiStore, rewardPointsInput, rewardSummary])

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
                        setGiftCardCount(data.gift_card_count)
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

    const handleProceedToCheckout = () => {
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
        setIsCheckoutOpen(true)
    }

    const getCommonPayload = (): OrderPayload | null => {
        if (!user || !selectedAddress || !activeQuote || activeQuote.error) return null

        const points = multiStore ? 0 : Math.min(
            Math.max(Number.parseInt(rewardPointsInput, 10) || 0, 0),
            rewardSummary?.enabled ? rewardSummary.maxRedeemablePoints : 0,
        )
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
            <div className="min-h-screen bg-white dark:bg-black font-sans text-[#1A1A1A] dark:text-white">
                {/* Breadcrumbs */}
                <div className="container mx-auto px-4 lg:px-6 py-6 border-b border-gray-50 dark:border-zinc-900 mb-12">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Link href="/" className="hover:text-[#F58220] transition-colors">
                            <Home className="h-4 w-4" />
                        </Link>
                        <span>{">"}</span>
                        <Link href="/" className="hover:text-[#F58220] transition-colors font-medium">Home</Link>
                        <span>{">"}</span>
                        <span className="text-[#F58220] font-medium">Empty Cart</span>
                    </div>
                </div>

                <div className="container mx-auto px-4 lg:px-6 flex flex-col items-center justify-center text-center py-12">
                    <div className="relative w-full max-w-md aspect-video mb-12">
                        <Image
                            src="/images/cart image.png"
                            alt="Empty cart"
                            fill
                            className="object-contain"
                            sizes="(max-width: 768px) 90vw, 28rem"
                        />
                    </div>

                    <h1 className="text-[40px] leading-tight font-bold mb-4 text-[#1A1A1A] dark:text-white">
                        Your cart is empty
                    </h1>
                    <p className="text-gray-400 text-lg mb-10">
                        Add something to make it happy!
                    </p>

                    <Link href="/">
                        <Button className="bg-[#F58220] hover:bg-[#F58220]/90 text-white font-bold px-12 py-7 rounded-full text-lg shadow-xl shadow-orange-500/20 active:scale-95 transition-all">
                            Continue Shopping
                        </Button>
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <>

            <div className="min-h-screen bg-white dark:bg-black py-8 lg:py-12 font-sans text-[#1A1A1A] dark:text-white">
                <div className="container mx-auto px-4 lg:px-6">
                    {/* Breadcrumbs */}
                    <div className="flex items-center gap-2 text-sm text-gray-400 mb-8 border-b border-gray-50 dark:border-zinc-900 pb-4">
                        <Link href="/" className="hover:text-[#F58220] transition-colors">
                            <Home className="h-4 w-4" />
                        </Link>
                        <span>{">"}</span>
                        <Link href="/" className="hover:text-[#F58220] transition-colors font-medium">Home</Link>
                        <span>{">"}</span>
                        <span className="text-[#F58220] font-medium">Cart</span>
                    </div>

                    <h1 className="text-3xl md:text-4xl font-black mb-6 md:mb-10 text-center tracking-tight">My Shopping Cart</h1>

                    <div className="flex flex-col lg:flex-row gap-8 xl:gap-12">
                        {/* Cart Items Area */}
                        <div className="flex-1">
                            <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">

                                {/* Desktop Table - Hidden on Mobile */}
                                <div className="hidden md:block overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-gray-100 dark:border-zinc-800 text-xs uppercase tracking-wide text-gray-400 font-bold">
                                                <th className="p-6">Product</th>
                                                <th className="p-6">Price</th>
                                                <th className="p-6">Quantity</th>
                                                <th className="p-6">Subtotal</th>
                                                <th className="p-6"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                            {displayedItems.map((item) => (
                                                <tr key={item.id} className="group hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                                                    <td className="p-6">
                                                        <div className="flex items-center gap-4">
                                                            <div className="h-20 w-20 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden bg-gray-50 dark:bg-zinc-800 border border-gray-100 dark:border-zinc-800 group-hover:shadow-md transition-shadow">
                                                                {item.image ? (
                                                                    <Image src={buildOptimizedImageUrl(item.image, { width: 160 })} alt={item.name} fill unoptimized className="object-cover transition-transform duration-500 group-hover:scale-110" />
                                                                ) : (
                                                                    <div className="h-10 w-10 bg-gray-200 dark:bg-zinc-700 rounded-full" />
                                                                )}
                                                            </div>
                                                            <div className="min-w-0">
                                                            <p className="truncate font-bold">{item.name}</p>
                                                            {multiStore && <p className="text-xs text-muted-foreground">{storeByMerchant.get(item.merchantId) ?? "Store"}</p>}
                                                        </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-6 text-[#6B7280] dark:text-gray-400 font-medium">
                                                        {formatKobo(item.price)}
                                                    </td>
                                                    <td className="p-6">
                                                        <div className="flex items-center gap-3 bg-gray-100/80 dark:bg-zinc-800/80 rounded-full px-3 py-1.5 w-max border border-gray-200/50 dark:border-zinc-700/50 shadow-inner backdrop-blur-sm">
                                                            <button
                                                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                                                className="h-8 w-8 flex items-center justify-center rounded-full bg-white dark:bg-zinc-700 shadow-sm text-gray-500 hover:text-[#F58220] transition-all hover:scale-110 active:scale-95 border border-gray-100 dark:border-zinc-600"
                                                            >
                                                                <Minus className="h-4 w-4" />
                                                            </button>
                                                            <span className="font-black text-base w-8 text-center text-gray-900 dark:text-white">{item.quantity}</span>
                                                            <button
                                                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                                                className="h-8 w-8 flex items-center justify-center rounded-full bg-white dark:bg-zinc-700 shadow-sm text-gray-500 hover:text-[#F58220] transition-all hover:scale-110 active:scale-95 border border-gray-100 dark:border-zinc-600"
                                                            >
                                                                <Plus className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="p-6 font-black text-xl text-[#F58220] tracking-tight">
                                                        {formatKobo(item.price * item.quantity)}
                                                    </td>
                                                    <td className="p-6 text-right">
                                                        <button
                                                            onClick={() => removeFromCart(item.id)}
                                                            className="h-10 w-10 rounded-full bg-gray-50/50 dark:bg-zinc-800/50 border border-gray-100 dark:border-zinc-700 flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all shadow-sm active:scale-90"
                                                        >
                                                            <X className="h-5 w-5" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile Card View */}
                                <div className="md:hidden divide-y divide-gray-100 dark:divide-zinc-800">
                                    {displayedItems.map((item) => (
                                        <div key={item.id} className="p-4 relative transition-colors hover:bg-gray-50/30 dark:hover:bg-zinc-800/30">
                                            <div className="flex gap-4">
                                                {/* Image Container */}
                                                <div className="h-20 w-20 xs:h-24 xs:w-24 rounded-2xl flex-shrink-0 flex items-center justify-center overflow-hidden bg-gray-50 dark:bg-zinc-800 border border-gray-100 dark:border-zinc-800 shadow-sm relative group">
                                                    {item.image ? (
                                                        <Image src={buildOptimizedImageUrl(item.image, { width: 160 })} alt={item.name} fill unoptimized className="object-cover transition-transform duration-500 group-hover:scale-110" />
                                                    ) : (
                                                        <div className="h-10 w-10 bg-gray-200 dark:bg-zinc-700 rounded-full animate-pulse" />
                                                    )}
                                                </div>

                                                {/* Details */}
                                                <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                                                    <div>
                                                        <div className="flex justify-between items-start mb-1">
                                                            <div className="min-w-0">
                                                                <h3 className="truncate pr-6 font-bold">{item.name}</h3>
                                                                {multiStore && <p className="text-xs text-muted-foreground">{storeByMerchant.get(item.merchantId) ?? "Store"}</p>}
                                                            </div>
                                                            <button
                                                                onClick={() => removeFromCart(item.id)}
                                                                className="absolute top-4 right-4 h-8 w-8 rounded-full bg-gray-50/80 dark:bg-zinc-800/80 border border-gray-100/50 dark:border-zinc-700/50 flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all shadow-sm active:scale-90 backdrop-blur-sm"
                                                            >
                                                                <X className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                        <p className="text-[#6B7280] dark:text-gray-400 text-xs font-bold uppercase tracking-wider">{formatKobo(item.price)}</p>
                                                    </div>

                                                    <div className="flex items-center justify-between gap-2 mt-3">
                                                        {/* Quantity Selector */}
                                                        <div className="flex items-center gap-1 bg-gray-100/80 dark:bg-zinc-800/80 rounded-full p-1 border border-gray-200/50 dark:border-zinc-700/50 backdrop-blur-sm shadow-inner">
                                                            <button
                                                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                                                className="h-7 w-7 flex items-center justify-center rounded-full bg-white dark:bg-zinc-700 shadow-sm text-gray-600 dark:text-gray-300 hover:text-[#F58220] dark:hover:text-[#F58220] transition-all hover:scale-105 active:scale-95 border border-gray-100 dark:border-zinc-600"
                                                            >
                                                                <Minus className="h-3 w-3" />
                                                            </button>
                                                            <span className="font-black text-xs min-w-[28px] text-center text-gray-900 dark:text-white">{item.quantity}</span>
                                                            <button
                                                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                                                className="h-7 w-7 flex items-center justify-center rounded-full bg-white dark:bg-zinc-700 shadow-sm text-gray-600 dark:text-gray-300 hover:text-[#F58220] dark:hover:text-[#F58220] transition-all hover:scale-105 active:scale-95 border border-gray-100 dark:border-zinc-600"
                                                            >
                                                                <Plus className="h-3 w-3" />
                                                            </button>
                                                        </div>

                                                        {/* Subtotal */}
                                                        <div className="text-right">
                                                            <span className="block text-[#F58220] font-black text-base xs:text-lg whitespace-nowrap tracking-tight">
                                                                {formatKobo(item.price * item.quantity)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Delivery Location Section */}
                            <div className="mt-8 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-3xl p-6 shadow-sm overflow-hidden relative">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full -mr-16 -mt-16 blur-3xl" />
                                <h3 className="font-black text-xl md:text-2xl mb-4 md:mb-6 flex items-center gap-3 tracking-tight">
                                    <div className="p-2 bg-orange-100 dark:bg-orange-500/20 rounded-xl">
                                        <MapPin className="h-5 w-5 md:h-6 md:w-6 text-[#F58220]" />
                                    </div>
                                    Delivery Location
                                </h3>

                                <div className="space-y-6">
                                    <DeliveryDestinationPicker />
                                    {selectedAddress && <p className="text-sm font-medium">{selectedAddress.address}</p>}
                                    {destination?.kind === "gps" && (
                                        <div className="space-y-3">
                                            <p>Deliver to your current location?</p>
                                            {confirmingGps ? (
                                                <DeliveryAddressForm
                                                    key={`${destination.location.lat},${destination.location.lng}`}
                                                    initial={{ label: "Current location", ...destination.location }}
                                                    onSaved={(address) => {
                                                        selectDestination({ kind: "address", id: address.id })
                                                        setConfirmingGps(false)
                                                    }}
                                                />
                                            ) : <Button type="button" onClick={() => setConfirmingGps(true)}>Confirm delivery address</Button>}
                                        </div>
                                    )}
                                    {deliveryFeeError && (
                                        <div className="space-y-2">
                                            <p role="alert" className="text-sm text-red-600">{deliveryFeeError}</p>
                                            <Button type="button" variant="outline" size="sm" onClick={() => setQuoteRevision((revision) => revision + 1)}>Recalculate delivery</Button>
                                        </div>
                                    )}
                                    {selectedAddress && (
                                        <>
                                            {/* Contact Numbers */}
                                            <div className="mt-8">
                                                <h4 className="font-black text-sm mb-4 flex items-center gap-2 uppercase tracking-widest text-gray-400">
                                                    <Smartphone className="h-4 w-4 text-[#F58220]" />
                                                    Phone for delivery
                                                </h4>
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                    {contactNumbers.map((num, idx) => (
                                                        <Input
                                                            key={idx}
                                                            placeholder={`Phone ${idx + 1}`}
                                                            value={num}
                                                            onChange={(e) => updateContactNumber(idx, e.target.value)}
                                                            className="h-14 rounded-2xl bg-gray-100/50 dark:bg-zinc-800/50 border-gray-200 dark:border-zinc-800 font-bold focus:ring-[#F58220]"
                                                        />
                                                    ))}
                                                </div>
                                                <p className="text-xs text-gray-400 mt-3 font-medium text-center">We recommend providing at least two alternative numbers for seamless delivery.</p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Cart Totals */}
                        <div className="w-full lg:w-96 flex-shrink-0">
                            <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-3xl p-8 shadow-xl shadow-gray-200/50 dark:shadow-none sticky top-32 overflow-hidden relative">
                                <div className="absolute top-0 right-0 w-40 h-40 bg-orange-500/10 rounded-full -mr-20 -mt-20 blur-3xl opacity-50" />
                                <h3 className="font-black text-xl md:text-2xl mb-6 md:mb-8 flex items-center justify-between tracking-tight">
                                    Summary
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 py-1 px-2 md:py-1 md:px-3 bg-gray-50 dark:bg-zinc-800 rounded-lg">{cartItems.length} Items</span>
                                </h3>

                                <div className="space-y-5 mb-8">
                                    <div className="flex justify-between text-[#6B7280] dark:text-gray-400 font-medium text-lg">
                                        <span>Subtotal</span>
                                        <span className="font-bold text-gray-900 dark:text-white">{formatKobo(subtotalKobo)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[#6B7280] dark:text-gray-400 font-medium pb-5 border-b border-gray-100 dark:border-zinc-800 text-lg">
                                        <span>Delivery Fee</span>
                                        {isCalculatingFee ? (
                                            <span className="flex items-center text-[#F58220] font-black italic animate-pulse">
                                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                CALCULATING
                                            </span>
                                        ) : deliveryFeeError || !selectedAddress ? (
                                            <span className="text-sm font-semibold">{deliveryFeeError ? "Unavailable" : "Select an address"}</span>
                                        ) : (
                                            <span className={`font-black ${deliveryFeeKobo > 0 ? "text-gray-900 dark:text-white" : "text-emerald-500"}`}>
                                                {deliveryFeeKobo > 0 ? formatKobo(deliveryFeeKobo) : "FREE"}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex justify-between items-end pt-2">
                                        <span className="text-gray-500 font-bold uppercase tracking-widest text-[10px] md:text-sm mb-1">Total Payable</span>
                                        <span className="text-3xl md:text-4xl font-black text-[#F58220] tracking-tighter">{formatKobo(total)}</span>
                                    </div>
                                </div>

                                <Button
                                    onClick={handleProceedToCheckout}
                                    disabled={Boolean(user && (!selectedAddress || !activeQuote || deliveryFeeError))}
                                    className="w-full rounded-2xl bg-[#F58220] hover:bg-[#F58220]/90 text-white font-black py-6 md:py-8 text-lg md:text-xl shadow-2xl shadow-orange-500/30 mb-6 transition-all hover:scale-[1.03] active:scale-95 disabled:opacity-50 disabled:scale-100 h-auto"
                                >
                                    PAY NOW
                                </Button>
                                {multiStore && activeQuote?.groups.length ? (
                                    <div className="mb-4 space-y-2 text-sm">
                                        <p className="font-semibold">Separate deliveries by store</p>
                                        {activeQuote.groups.map((group, index) => (
                                            <div key={group.merchant_id} className="flex justify-between gap-2">
                                                <span>{group.store_name === "Store" ? `Store ${index + 1}` : group.store_name}</span>
                                                <span>{formatKobo(group.fee)}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : null}
                                <p className="text-xs text-center text-gray-400 font-bold opacity-60">100% Secure Checkout · SSL Encrypted</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Checkout Dialog - rendered outside the layout grid to avoid sticky/overflow issues */}
                <Dialog open={isCheckoutOpen} onOpenChange={(open) => { if (!isProcessing) setIsCheckoutOpen(open) }}>
                    <DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-[480px] flex-col overflow-hidden rounded-2xl border-none bg-white p-0 shadow-2xl dark:bg-zinc-950 sm:w-full sm:rounded-[2rem]">
                        {/* Compact Header */}
                        <div className="relative bg-[#F58220] px-4 py-3 text-white sm:px-6 sm:py-4 flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/30 bg-white/20 backdrop-blur-md sm:h-12 sm:w-12 sm:rounded-2xl">
                                    <CreditCard className="h-5 w-5 text-white sm:h-6 sm:w-6" />
                                </div>
                                <DialogHeader className="flex-1 space-y-0">
                                    <DialogTitle className="text-left text-lg font-black tracking-tight text-white sm:text-xl">Checkout</DialogTitle>
                                    <DialogDescription className="text-left text-xs font-medium text-white/80 sm:text-sm">
                                        Select a payment method
                                    </DialogDescription>
                                </DialogHeader>
                                <span className="text-lg font-black tracking-tighter sm:text-xl">{formatKobo(total)}</span>
                            </div>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-6 sm:py-4">
                            <div className="space-y-3 sm:space-y-4">
                                {multiStore ? <p className="text-xs text-muted-foreground">Reward points can be used on single-store orders.</p> : (
                                <div className="group relative overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900/30 dark:bg-emerald-950/20 sm:p-4">
                                    <div className="relative z-10 flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <h3 className="font-bold text-emerald-800 dark:text-emerald-400 text-sm tracking-tight">Reward Points</h3>
                                            <p className="text-xs text-emerald-700/70 dark:text-emerald-300/60 font-medium">
                                                {rewardSummary
                                                    ? `${rewardSummary.availablePoints.toLocaleString()} available`
                                                    : "Checking..."}
                                            </p>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 rounded-lg bg-emerald-500/10 px-2 text-xs font-black text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
                                            disabled={!rewardSummary?.enabled || rewardSummary.maxRedeemablePoints <= 0}
                                            onClick={() => setRewardPointsInput(rewardSummary ? rewardSummary.maxRedeemablePoints.toString() : "")}
                                        >
                                            USE MAX
                                        </Button>
                                    </div>

                                    {rewardSummary?.enabled ? (
                                        <div className="relative z-10 mt-2">
                                            <Input
                                                type="number"
                                                min={0}
                                                max={rewardSummary.maxRedeemablePoints}
                                                placeholder="Points to redeem"
                                                value={rewardPointsInput}
                                                onChange={(event) => setRewardPointsInput(event.target.value)}
                                                className="h-9 rounded-lg bg-white dark:bg-zinc-900 border-emerald-100 dark:border-emerald-900 text-sm font-bold focus:ring-emerald-500"
                                            />
                                        </div>
                                    ) : null}
                                </div>

                                )}
                                {/* Payment Methods Label */}
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-1">Choose payment</p>

                                {/* Payment Options - Compact */}
                                <div className="grid gap-2">
                                    <PaymentOption 
                                        title="Rss Wallet"
                                        subtitle={isLoadingBalance ? "Checking..." : `Balance: ${formatKobo(walletBalance ?? 0)}`}
                                        icon={<Wallet className="h-5 w-5" />}
                                        isSelected={paymentMethod === 'wallet'}
                                        isDisabled={walletBalance === null || walletBalance < total}
                                        onClick={() => setPaymentMethod('wallet')}
                                        color="orange"
                                    />
                                    <PaymentOption 
                                        title="Gift Card"
                                        subtitle={
                                            isLoadingBalance
                                                ? "Checking..."
                                                : `Balance: ${formatKobo(giftCardBalance ?? 0)} | ${giftCardCount} active`
                                        }
                                        icon={<Gift className="h-5 w-5" />}
                                        isSelected={paymentMethod === 'giftCard'}
                                        isDisabled={giftCardBalance === null || giftCardBalance < total}
                                        onClick={() => setPaymentMethod('giftCard')}
                                        color="violet"
                                    />
                                    <PaymentOption 
                                        title="Secure Pay"
                                        subtitle="Cards, Bank, Transfer, USSD"
                                        icon={<CreditCard className="h-5 w-5" />}
                                        isSelected={paymentMethod === 'direct'}
                                        isDisabled={total <= 0}
                                        onClick={() => setPaymentMethod('direct')}
                                        color="orange"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Sticky Footer */}
                        <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/50 sm:px-6 sm:py-4 flex-shrink-0">
                            <Button
                                disabled={!paymentMethod || isProcessing || !activeQuote || Boolean(deliveryFeeError)}
                                onClick={
                                    paymentMethod === 'wallet'
                                        ? handleWalletPayment
                                        : paymentMethod === 'giftCard'
                                            ? handleGiftCardPayment
                                            : handleDirectPayment
                                }
                                className="w-full rounded-xl bg-[#F58220] hover:bg-[#F58220]/90 text-white font-black h-12 text-base shadow-xl shadow-orange-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                            >
                                {isProcessing ? (
                                    <Loader2 className="h-6 w-6 animate-spin" />
                                ) : (
                                    `COMPLETE ORDER`
                                )}
                            </Button>
                            <div className="mt-2 flex items-center justify-center gap-2 opacity-40">
                                <div className="h-px w-6 bg-current" />
                                <span className="text-[9px] font-black uppercase tracking-[0.2em]">Verified Secure</span>
                                <div className="h-px w-6 bg-current" />
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </>
    )
}

function PaymentOption({ title, subtitle, icon, isSelected, isDisabled, onClick, color }: PaymentOptionProps) {
    const colorClasses = {
        orange: isSelected ? "border-[#F58220] bg-orange-50/50 dark:bg-orange-500/10" : "border-gray-100 dark:border-zinc-800 hover:border-orange-200",
        violet: isSelected ? "border-violet-600 bg-violet-50/50 dark:bg-violet-500/10" : "border-gray-100 dark:border-zinc-800 hover:border-violet-200",
    }

    const iconBg = {
        orange: isSelected ? "bg-[#F58220] text-white shadow-md shadow-orange-500/30" : "bg-gray-100 dark:bg-zinc-800 text-gray-400",
        violet: isSelected ? "bg-violet-600 text-white shadow-md shadow-violet-500/30" : "bg-gray-100 dark:bg-zinc-800 text-gray-400",
    }

    return (
        <div
            onClick={() => !isDisabled && onClick()}
            className={`flex items-center gap-3 p-2.5 sm:p-3 rounded-xl border-2 transition-all cursor-pointer group relative overflow-hidden ${colorClasses[color]} ${isDisabled ? "opacity-40 grayscale-[0.5] cursor-not-allowed" : "active:scale-[0.98]"}`}
        >
            <div className={`p-2 sm:p-2.5 rounded-lg sm:rounded-xl transition-all duration-300 ${iconBg[color]}`}>
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <h3 className="font-black text-sm sm:text-base tracking-tight">{title}</h3>
                <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider truncate">{subtitle}</p>
            </div>
            {isSelected && (
                <div className={`h-6 w-6 rounded-full flex items-center justify-center border-2 border-white dark:border-zinc-950 shadow-md flex-shrink-0 ${color === "orange" ? "bg-[#F58220]" : "bg-violet-600"}`}>
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                </div>
            )}
        </div>
    )
}
