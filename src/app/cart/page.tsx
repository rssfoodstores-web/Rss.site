"use client"

/// <reference path="../../types/leaflet.d.ts" />

import Link from "next/link"
import { X, Minus, Plus, Home, Wallet, CreditCard, Loader2, AlertCircle, CheckCircle2, MapPin, Smartphone, Gift } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useCart } from "@/context/CartContext"
import { useUser } from "@/context/UserContext"
import { useState, useEffect, useRef } from "react"
import { getWalletData } from "@/app/account/wallet/actions"
import { getGiftCardCheckoutSummary } from "@/app/account/gift-card/actions"
import { getRewardCheckoutSummary, type RewardCheckoutSummary } from "@/app/account/rewards/actions"
import { processWalletPayment, processGiftCardPayment, initiateDirectPayment } from "@/app/actions/orderActions"
import { getDeliverySettings, type DeliverySettings } from "@/app/actions/settingsActions"
import { formatKobo } from "@/lib/money"
import { toast } from "sonner"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import { useRouter } from "next/navigation"
import Script from "next/script"
import { parseCoordinates } from "@/lib/directions"

export default function CartPage() {
    const { items: cartItems, removeFromCart, updateQuantity, cartTotal, clearCart } = useCart()
    const { user, profile } = useUser()
    const router = useRouter()

    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)
    const [walletBalance, setWalletBalance] = useState<number | null>(null)
    const [giftCardBalance, setGiftCardBalance] = useState<number | null>(null)
    const [giftCardCount, setGiftCardCount] = useState(0)
    const [rewardSummary, setRewardSummary] = useState<RewardCheckoutSummary | null>(null)
    const [rewardPointsInput, setRewardPointsInput] = useState("")
    const [isLoadingBalance, setIsLoadingBalance] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'giftCard' | 'direct' | null>(null)

    // Delivery State
    const [deliverySettings, setDeliverySettings] = useState<DeliverySettings | null>(null)
    const [deliveryFeeKobo, setDeliveryFeeKobo] = useState<number>(0)
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
    const [distanceKm, setDistanceKm] = useState<number>(0)
    const [isCalculatingFee, setIsCalculatingFee] = useState(false)
    const [contactNumbers, setContactNumbers] = useState<string[]>(["", "", ""]) // 3 slots
    const [mapLoaded, setMapLoaded] = useState(false)

    const mapRef = useRef<HTMLDivElement>(null)
    const leafletMap = useRef<{ remove: () => void } | null>(null)
    const savedProfileAddress = profile?.address?.trim() || null

    // Load Settings on Mount
    useEffect(() => {
        const fetchSettings = async () => {
            const settings = await getDeliverySettings()
            setDeliverySettings(settings)
        }
        fetchSettings()
    }, [])

    useEffect(() => {
        const nextCoordinates = parseCoordinates(profile?.location ?? null)

        if (nextCoordinates) {
            setUserLocation(nextCoordinates)
            return
        }

        setUserLocation(null)
        setDistanceKm(0)
        setDeliveryFeeKobo(0)
    }, [profile?.location])

    // Calculate Fee when Location or Settings Change
    useEffect(() => {
        if (userLocation && deliverySettings) {
            calculateFee(userLocation.lat, userLocation.lng)
        }
    }, [userLocation, deliverySettings])

    const shipping = deliveryFeeKobo
    const baseTotal = cartTotal + shipping
    const requestedRewardPoints = Number.parseInt(rewardPointsInput, 10)
    const appliedRewardPoints = rewardSummary?.enabled
        ? Math.min(
            Math.max(Number.isFinite(requestedRewardPoints) ? requestedRewardPoints : 0, 0),
            rewardSummary.maxRedeemablePoints
        )
        : 0
    const rewardDiscountKobo = (isCheckoutOpen ? appliedRewardPoints : 0) * (rewardSummary?.pointValueKobo ?? 0)
    const total = Math.max(cartTotal - rewardDiscountKobo, 0) + shipping

    useEffect(() => {
        if (!rewardSummary?.enabled) {
            if (rewardPointsInput !== "") {
                setRewardPointsInput("")
            }
            return
        }

        if (rewardPointsInput !== "" && appliedRewardPoints.toString() !== rewardPointsInput) {
            setRewardPointsInput(appliedRewardPoints > 0 ? appliedRewardPoints.toString() : "")
        }
    }, [appliedRewardPoints, rewardPointsInput, rewardSummary?.enabled])

    useEffect(() => {
        if (paymentMethod === "wallet" && walletBalance !== null && walletBalance < total) {
            setPaymentMethod(null)
        }

        if (paymentMethod === "giftCard" && giftCardBalance !== null && giftCardBalance < total) {
            setPaymentMethod(null)
        }

        if (paymentMethod === "direct" && total <= 0) {
            setPaymentMethod(null)
        }
    }, [giftCardBalance, paymentMethod, total, walletBalance])

    const calculateFee = (lat: number, lng: number) => {
        if (!deliverySettings) return

        setIsCalculatingFee(true)

        // Haversine Formula
        const R = 6371 // Earth radius in km
        const dLat = deg2rad(lat - deliverySettings.originLat)
        const dLng = deg2rad(lng - deliverySettings.originLng)
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(deg2rad(deliverySettings.originLat)) * Math.cos(deg2rad(lat)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2)
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        const d = R * c // Distance in km

        const calculatedFee = deliverySettings.baseFareKobo + (d * deliverySettings.distanceRateKoboPerKm)

        const finalFee = Math.ceil(calculatedFee / 5000) * 5000

        setDistanceKm(parseFloat(d.toFixed(2)))
        setDeliveryFeeKobo(finalFee)
        setIsCalculatingFee(false)
    }

    const deg2rad = (deg: number) => {
        return deg * (Math.PI / 180)
    }

    const initMap = (lat: number, lng: number) => {
        if (typeof window === 'undefined' || !window.L || !mapRef.current) return

        // If map already exists, remove it
        if (leafletMap.current) {
            leafletMap.current.remove()
        }

        const map = window.L.map(mapRef.current).setView([lat, lng], 13) as { remove: () => void }

        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map)

        // User Marker
        window.L.marker([lat, lng]).addTo(map)
            .bindPopup('Saved delivery point')
            .openPopup()

        // Merchant/Origin Marker (Optional)
        if (deliverySettings) {
            window.L.marker([deliverySettings.originLat, deliverySettings.originLng]).addTo(map)
                .bindPopup('RSS Fulfilment Base')
        }

        leafletMap.current = map
    }

    // Ensure map initializes if location is set but map wasn't ready
    useEffect(() => {
        if (mapLoaded && userLocation && window.L) {
            initMap(userLocation.lat, userLocation.lng)
        }
    }, [mapLoaded, userLocation])


    const handleProceedToCheckout = async () => {
        if (!user) {
            toast.error("Please log in to proceed to checkout")
            router.push("/auth/login?redirect=/cart")
            return
        }

        if (!userLocation || !savedProfileAddress) {
            toast.warning("Save your delivery location on your profile before checkout.")
            router.push("/account/profile")
            return
        }

        if (!deliverySettings) {
            toast.warning("Delivery settings are still loading. Please wait a moment.")
            return
        }

        setIsCheckoutOpen(true)
        setPaymentMethod(null)
        setRewardPointsInput("")
        fetchFundingOptions()
    }

    const fetchFundingOptions = async () => {
        setIsLoadingBalance(true)
        try {
            const [walletData, giftCardData, rewardData] = await Promise.all([
                getWalletData(),
                getGiftCardCheckoutSummary(),
                getRewardCheckoutSummary(cartTotal),
            ])

            const walletRows = Array.isArray(walletData.wallets)
                ? walletData.wallets as Array<{ balance: number; type: string }>
                : []

            const customerWallet = walletRows.length
                ? walletRows.find((wallet) => wallet.type === "customer") ?? walletData.wallet
                : walletData.wallet

            if (customerWallet) {
                setWalletBalance(customerWallet.balance)
            }

            if (giftCardData.success) {
                setGiftCardBalance(giftCardData.availableBalanceKobo)
                setGiftCardCount(giftCardData.activeCount)
            } else {
                setGiftCardBalance(0)
                setGiftCardCount(0)
            }

            setRewardSummary(rewardData)
        } catch (error) {
            console.error("Failed to fetch funding options:", error)
        } finally {
            setIsLoadingBalance(false)
        }
    }

    const getCommonPayload = () => {
        const deliveryLocationGeoJSON = userLocation ? {
            type: "Point" as const,
            coordinates: [userLocation.lng, userLocation.lat] as [number, number]
        } : null

        return {
            userId: user!.id,
            items: cartItems.map(item => ({
                product_id: item.id,
                quantity: item.quantity,
            })),
            deliveryFeeKobo,
            deliveryLocation: deliveryLocationGeoJSON,
            contactNumbers: contactNumbers.filter(n => n.trim() !== ""),
            rewardPointsToRedeem: isCheckoutOpen ? appliedRewardPoints : 0,
        }
    }

    const handleWalletPayment = async () => {
        if (!user) return
        setIsProcessing(true)
        try {
            const payload = getCommonPayload()

            const result = await processWalletPayment(payload)

            if (result.success) {
                toast.success("Order placed successfully using wallet balance!")
                clearCart()
                router.push(`/account/orders?orderId=${result.orderId}`)
            } else {
                toast.error(result.error || "Failed to process wallet payment")
            }
        } catch {
            toast.error("An unexpected error occurred")
        } finally {
            setIsProcessing(false)
            setIsCheckoutOpen(false)
        }
    }

    const handleGiftCardPayment = async () => {
        if (!user) return
        setIsProcessing(true)
        try {
            const payload = getCommonPayload()
            const result = await processGiftCardPayment(payload)

            if (result.success) {
                toast.success("Order placed successfully using gift card balance!")
                clearCart()
                router.push(`/account/orders?orderId=${result.orderId}`)
            } else {
                toast.error(result.error || "Failed to process gift card payment")
            }
        } catch {
            toast.error("An unexpected error occurred")
        } finally {
            setIsProcessing(false)
            setIsCheckoutOpen(false)
        }
    }

    const handleDirectPayment = async () => {
        if (!user) return
        setIsProcessing(true)
        try {
            const payload = getCommonPayload()
            const result = await initiateDirectPayment(payload)

            if (result.success && result.checkoutUrl) {
                toast.success("Redirecting to payment gateway...")
                clearCart() // Clear cart as order is already pending in DB for direct pay
                window.location.href = result.checkoutUrl
            } else {
                toast.error(result.error || "Failed to initialize direct payment")
            }
        } catch {
            toast.error("An unexpected error occurred")
        } finally {
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
                        {/* Use a placeholder or available image, assuming /images/cart image.png exists from user code */}
                        <img
                            src="/images/cart image.png"
                            alt="Empty Cart"
                            className="w-full h-full object-contain"
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
            <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossOrigin="" />
            <Script
                src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
                integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
                crossOrigin=""
                onLoad={() => setMapLoaded(true)}
            />

            <div className="min-h-screen bg-white dark:bg-black py-8 lg:py-12 font-sans text-[#1A1A1A] dark:text-white">
                <div className="container mx-auto px-4 lg:px-6">
                    <h1 className="text-3xl font-bold mb-8 text-center">My Shopping Cart</h1>

                    <div className="flex flex-col lg:flex-row gap-8 xl:gap-12">
                        {/* Cart Items Area */}
                        <div className="flex-1">
                            <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">

                                {/* Desktop Table - Hidden on Mobile */}
                                <div className="hidden md:block overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-gray-100 dark:border-zinc-800 text-xs uppercase tracking-wide text-gray-500">
                                                <th className="p-6 font-medium">Product</th>
                                                <th className="p-6 font-medium">Price</th>
                                                <th className="p-6 font-medium">Quantity</th>
                                                <th className="p-6 font-medium">Subtotal</th>
                                                <th className="p-6 font-medium"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                            {cartItems.map((item) => (
                                                <tr key={item.id} className="group">
                                                    <td className="p-6">
                                                        <div className="flex items-center gap-4">
                                                            <div className={`h-20 w-20 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden bg-gray-100`}>
                                                                {item.image ? (
                                                                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <div className="h-8 w-8 bg-gray-200 rounded-full" />
                                                                )}
                                                            </div>
                                                            <span className="font-medium text-lg max-w-[200px] truncate">{item.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-6 text-gray-600 dark:text-gray-400">
                                                        {formatKobo(item.price)}
                                                    </td>
                                                    <td className="p-6">
                                                        <div className="flex items-center gap-3 bg-gray-50 dark:bg-zinc-800 rounded-full px-3 py-1 w-max border border-gray-200 dark:border-zinc-700">
                                                            <button
                                                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                                                className="h-8 w-8 flex items-center justify-center rounded-full bg-white dark:bg-black shadow-sm text-gray-500 hover:text-[#F58220] transition-colors"
                                                            >
                                                                <Minus className="h-4 w-4" />
                                                            </button>
                                                            <span className="font-medium text-base w-6 text-center">{item.quantity}</span>
                                                            <button
                                                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                                                className="h-8 w-8 flex items-center justify-center rounded-full bg-white dark:bg-black shadow-sm text-gray-500 hover:text-[#F58220] transition-colors"
                                                            >
                                                                <Plus className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="p-6 font-bold text-lg">
                                                        {formatKobo(item.price * item.quantity)}
                                                    </td>
                                                    <td className="p-6 text-right">
                                                        <button
                                                            onClick={() => removeFromCart(item.id)}
                                                            className="h-8 w-8 rounded-full hover:bg-red-50 dark:hover:bg-red-900/10 hover:text-red-500 text-gray-400 transition-colors flex items-center justify-center"
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile Card View */}
                                <div className="md:hidden divide-y divide-gray-100 dark:divide-zinc-800">
                                    {cartItems.map((item) => (
                                        <div key={item.id} className="p-4 relative">
                                            <div className="flex gap-4">
                                                <div className={`h-24 w-24 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden bg-gray-100`}>
                                                    {item.image ? (
                                                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="h-8 w-8 bg-gray-200 rounded-full" />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <h3 className="font-bold text-base sm:text-lg truncate pr-2">{item.name}</h3>
                                                        <button
                                                            onClick={() => removeFromCart(item.id)}
                                                            className="h-7 w-7 rounded-full border border-gray-100 dark:border-zinc-800 flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-200 transition-colors shrink-0"
                                                        >
                                                            <X className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                    <p className="text-gray-500 text-sm mb-3">{formatKobo(item.price)}</p>

                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-3 bg-gray-50 dark:bg-zinc-800 rounded-full px-2 py-1 border border-gray-200 dark:border-zinc-700">
                                                            <button
                                                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                                                className="h-7 w-7 flex items-center justify-center rounded-full bg-white dark:bg-black shadow-sm text-gray-500 hover:text-[#F58220] transition-colors"
                                                            >
                                                                <Minus className="h-3 w-3" />
                                                            </button>
                                                            <span className="font-medium text-xs w-4 text-center">{item.quantity}</span>
                                                            <button
                                                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                                                className="h-7 w-7 flex items-center justify-center rounded-full bg-white dark:bg-black shadow-sm text-gray-500 hover:text-[#F58220] transition-colors"
                                                            >
                                                                <Plus className="h-3 w-3" />
                                                            </button>
                                                        </div>
                                                        <span className="font-bold text-base sm:text-lg whitespace-nowrap">{formatKobo(item.price * item.quantity)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Delivery Location Section */}
                            <div className="mt-8 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
                                <h3 className="font-bold text-xl mb-4 flex items-center gap-2">
                                    <MapPin className="h-5 w-5 text-[#F58220]" />
                                    Delivery Location
                                </h3>

                                <div className="space-y-4">
                                    {!userLocation ? (
                                        <div className="text-center py-8 bg-gray-50 dark:bg-zinc-800/50 rounded-xl border border-dashed border-gray-200 dark:border-zinc-700">
                                            <div className="mb-4 text-gray-500">
                                                {deliverySettings
                                                    ? "Set your delivery location on your profile before checkout."
                                                    : "Loading delivery settings..."}
                                            </div>
                                            <Button asChild className="bg-[#F58220] hover:bg-[#F58220]/90 text-white">
                                                <Link href="/account/profile">
                                                    <MapPin className="mr-2 h-4 w-4" />
                                                    Update Profile Location
                                                </Link>
                                            </Button>
                                            <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                                                Orders will be delivered to the location saved on your profile.
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="font-medium text-green-600 flex items-center gap-2">
                                                        <CheckCircle2 className="h-4 w-4" />
                                                        Saved Profile Location
                                                    </p>
                                                    {savedProfileAddress && (
                                                        <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                                                            {savedProfileAddress}
                                                        </p>
                                                    )}
                                                    <p className="text-sm text-gray-500 mt-1">
                                                        Distance to Store: {distanceKm} km
                                                    </p>
                                                </div>
                                                <Button variant="outline" size="sm" asChild>
                                                    <Link href="/account/profile">Edit in Profile</Link>
                                                </Button>
                                            </div>

                                            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100">
                                                <div className="flex gap-2">
                                                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                                    <p>
                                                        Delivery is tied to this saved profile location. Confirm it is correct before payment because riders are only obligated to deliver there.
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Map Container */}
                                            <div className="h-64 w-full rounded-xl overflow-hidden border border-gray-200 dark:border-zinc-700 relative z-0">
                                                <div id="leaflet-map" ref={mapRef} className="h-full w-full" />
                                            </div>

                                            {/* Contact Numbers */}
                                            <div className="mt-6">
                                                <h4 className="font-bold text-sm mb-3 flex items-center gap-2">
                                                    <Smartphone className="h-4 w-4 text-[#F58220]" />
                                                    Delivery Contact Numbers
                                                </h4>
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                    {contactNumbers.map((num, idx) => (
                                                        <Input
                                                            key={idx}
                                                            placeholder={`Phone ${idx + 1}`}
                                                            value={num}
                                                            onChange={(e) => updateContactNumber(idx, e.target.value)}
                                                            className="bg-gray-50 dark:bg-zinc-800/50"
                                                        />
                                                    ))}
                                                </div>
                                                <p className="text-xs text-gray-400 mt-2">Provide up to 3 numbers for the rider to contact you.</p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Cart Totals */}
                        <div className="w-full lg:w-96 flex-shrink-0">
                            <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-6 shadow-sm sticky top-32">
                                <h3 className="font-bold text-xl mb-6 flex items-center justify-between">
                                    Cart Total
                                    <span className="text-sm font-normal text-gray-500">{cartItems.length} Items</span>
                                </h3>

                                <div className="space-y-4 mb-6">
                                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                                        <span>Subtotal</span>
                                        <span className="font-medium text-gray-900 dark:text-white">{formatKobo(cartTotal)}</span>
                                    </div>
                                    <div className="flex justify-between text-gray-600 dark:text-gray-400 pb-4 border-b border-gray-100 dark:border-zinc-800">
                                        <span>Shipping</span>
                                        {isCalculatingFee ? (
                                            <span className="flex items-center text-[#F58220]">
                                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                                Calc...
                                            </span>
                                        ) : (
                                            <span className={`font-medium ${deliveryFeeKobo > 0 ? "text-gray-900 dark:text-white" : "text-green-500"}`}>
                                                {deliveryFeeKobo > 0 ? formatKobo(deliveryFeeKobo) : "Free"}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex justify-between text-lg font-bold">
                                        <span>Total</span>
                                        <span className="text-[#F58220]">{formatKobo(total)}</span>
                                    </div>
                                </div>

                                <Button
                                    onClick={handleProceedToCheckout}
                                    disabled={!userLocation || !deliverySettings}
                                    className="w-full rounded-full bg-[#F58220] hover:bg-[#F58220]/90 text-white font-bold py-6 text-lg shadow-lg shadow-orange-500/20 mb-4 transition-transform hover:scale-[1.02] disabled:opacity-50 disabled:scale-100"
                                >
                                    Proceed to Checkout
                                </Button>

                                <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
                                    <DialogContent className="sm:max-w-[425px] rounded-3xl overflow-hidden border-none p-0 bg-white dark:bg-zinc-950 shadow-2xl">
                                        <div className="bg-[#F58220] p-6 text-white text-center">
                                            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/30 backdrop-blur-sm">
                                                <CheckCircle2 className="h-8 w-8 text-white" />
                                            </div>
                                            <DialogHeader>
                                                <DialogTitle className="text-2xl font-bold text-center text-white">Choose Payment Method</DialogTitle>
                                                <DialogDescription className="text-white/80 text-center">
                                                    Select how you would like to pay for your order.
                                                </DialogDescription>
                                            </DialogHeader>
                                        </div>

                                        <div className="p-6 space-y-6">
                                            <div className="flex justify-between items-center pb-4 border-b border-gray-100 dark:border-zinc-800">
                                                <span className="text-gray-500 dark:text-gray-400 font-medium">Amount Due</span>
                                                <span className="text-2xl font-bold text-gray-900 dark:text-white">{formatKobo(total)}</span>
                                            </div>

                                            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <h3 className="font-bold text-gray-900 dark:text-white">Reward points</h3>
                                                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                                                            {rewardSummary
                                                                ? `${rewardSummary.availablePoints.toLocaleString()} available · ${rewardSummary.pendingPoints.toLocaleString()} pending`
                                                                : "Loading reward balance..."}
                                                        </p>
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="rounded-full"
                                                        disabled={!rewardSummary?.enabled || rewardSummary.maxRedeemablePoints <= 0}
                                                        onClick={() => setRewardPointsInput(rewardSummary ? rewardSummary.maxRedeemablePoints.toString() : "")}
                                                    >
                                                        Use Max
                                                    </Button>
                                                </div>

                                                {rewardSummary?.enabled ? (
                                                    <>
                                                        <div className="mt-4 flex gap-3">
                                                            <Input
                                                                type="number"
                                                                min={0}
                                                                max={rewardSummary.maxRedeemablePoints}
                                                                placeholder="Points to redeem"
                                                                value={rewardPointsInput}
                                                                onChange={(event) => setRewardPointsInput(event.target.value)}
                                                                className="h-11 rounded-xl bg-white dark:bg-zinc-900"
                                                            />
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                className="rounded-xl"
                                                                onClick={() => setRewardPointsInput("")}
                                                                disabled={!rewardPointsInput}
                                                            >
                                                                Clear
                                                            </Button>
                                                        </div>
                                                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                                            1 point = {formatKobo(rewardSummary.pointValueKobo)}. Points reduce product subtotal only. Delivery stays payable.
                                                        </p>
                                                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                                            Up to {rewardSummary.maxRedeemablePoints.toLocaleString()} points can be used on this cart.
                                                        </p>
                                                    </>
                                                ) : (
                                                    <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
                                                        Reward points are currently turned off by admin.
                                                    </p>
                                                )}
                                            </div>

                                            <div className="space-y-3 rounded-2xl border border-gray-100 p-4 dark:border-zinc-800">
                                                <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                                                    <span>Items subtotal</span>
                                                    <span className="font-medium text-gray-900 dark:text-white">{formatKobo(cartTotal)}</span>
                                                </div>
                                                {rewardDiscountKobo > 0 ? (
                                                    <div className="flex justify-between text-sm text-emerald-700 dark:text-emerald-300">
                                                        <span>Reward discount</span>
                                                        <span className="font-semibold">-{formatKobo(rewardDiscountKobo)}</span>
                                                    </div>
                                                ) : null}
                                                <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                                                    <span>Delivery</span>
                                                    <span className="font-medium text-gray-900 dark:text-white">{formatKobo(shipping)}</span>
                                                </div>
                                                <div className="flex justify-between border-t border-gray-100 pt-3 text-sm font-semibold text-gray-900 dark:border-zinc-800 dark:text-white">
                                                    <span>Original total</span>
                                                    <span>{formatKobo(baseTotal)}</span>
                                                </div>
                                            </div>

                                            <div className="grid gap-4">
                                                {/* Wallet Option */}
                                                <div
                                                    onClick={() => !isProcessing && (walletBalance !== null && walletBalance >= total) && setPaymentMethod('wallet')}
                                                    className={`relative flex items-center gap-4 p-5 rounded-2xl border-2 transition-all cursor-pointer group ${paymentMethod === 'wallet'
                                                        ? 'border-[#F58220] bg-orange-50/50 dark:bg-orange-500/10'
                                                        : 'border-gray-100 dark:border-zinc-800 hover:border-orange-200 dark:hover:border-zinc-700'
                                                        } ${(walletBalance !== null && walletBalance < total) ? 'opacity-50 cursor-not-allowed grayscale-[0.5]' : ''}`}
                                                >
                                                    <div className={`p-3 rounded-xl transition-colors ${paymentMethod === 'wallet' ? 'bg-[#F58220] text-white' : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 group-hover:bg-orange-100 group-hover:text-orange-600'}`}>
                                                        <Wallet className="h-6 w-6" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <h3 className="font-bold text-lg">Pay from Wallet</h3>
                                                        <div className="flex items-center gap-2 text-sm">
                                                            {isLoadingBalance ? (
                                                                <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
                                                            ) : (
                                                                <span className={walletBalance !== null && walletBalance < total ? "text-red-500 font-medium" : "text-gray-500"}>
                                                                    Customer wallet: {formatKobo(walletBalance ?? 0)}
                                                                </span>
                                                            )}
                                                            {walletBalance !== null && walletBalance < total && (
                                                                <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Insufficient</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {paymentMethod === 'wallet' && (
                                                        <div className="absolute top-2 right-2 w-5 h-5 bg-[#F58220] rounded-full flex items-center justify-center border-2 border-white dark:border-zinc-950">
                                                            <div className="w-2 h-2 bg-white rounded-full" />
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Gift Card Option */}
                                                <div
                                                    onClick={() => !isProcessing && (giftCardBalance !== null && giftCardBalance >= total) && setPaymentMethod('giftCard')}
                                                    className={`relative flex items-center gap-4 p-5 rounded-2xl border-2 transition-all cursor-pointer group ${paymentMethod === 'giftCard'
                                                        ? 'border-violet-700 bg-violet-50/70 dark:bg-violet-500/10'
                                                        : 'border-gray-100 dark:border-zinc-800 hover:border-violet-200 dark:hover:border-zinc-700'
                                                        } ${(giftCardBalance !== null && giftCardBalance < total) ? 'opacity-50 cursor-not-allowed grayscale-[0.5]' : ''}`}
                                                >
                                                    <div className={`p-3 rounded-xl transition-colors ${paymentMethod === 'giftCard' ? 'bg-violet-700 text-white' : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 group-hover:bg-violet-100 group-hover:text-violet-700'}`}>
                                                        <Gift className="h-6 w-6" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <h3 className="font-bold text-lg">Pay with Gift Card</h3>
                                                        <div className="flex flex-wrap items-center gap-2 text-sm">
                                                            {isLoadingBalance ? (
                                                                <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
                                                            ) : (
                                                                <>
                                                                    <span className={giftCardBalance !== null && giftCardBalance < total ? "text-red-500 font-medium" : "text-gray-500"}>
                                                                        Balance: {formatKobo(giftCardBalance ?? 0)}
                                                                    </span>
                                                                    <span className="text-gray-400">·</span>
                                                                    <span className="text-gray-500">
                                                                        {giftCardCount} active card{giftCardCount === 1 ? "" : "s"}
                                                                    </span>
                                                                </>
                                                            )}
                                                            {giftCardBalance !== null && giftCardBalance < total && (
                                                                <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Insufficient</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {paymentMethod === 'giftCard' && (
                                                        <div className="absolute top-2 right-2 w-5 h-5 bg-violet-700 rounded-full flex items-center justify-center border-2 border-white dark:border-zinc-950">
                                                            <div className="w-2 h-2 bg-white rounded-full" />
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Direct Pay Option */}
                                                <div
                                                    onClick={() => !isProcessing && total > 0 && setPaymentMethod('direct')}
                                                    className={`relative flex items-center gap-4 p-5 rounded-2xl border-2 transition-all cursor-pointer group ${paymentMethod === 'direct'
                                                        ? 'border-[#F58220] bg-orange-50/50 dark:bg-orange-500/10'
                                                        : 'border-gray-100 dark:border-zinc-800 hover:border-orange-200 dark:hover:border-zinc-700'
                                                        } ${total <= 0 ? 'opacity-50 cursor-not-allowed grayscale-[0.5]' : ''}`}
                                                >
                                                    <div className={`p-3 rounded-xl transition-colors ${paymentMethod === 'direct' ? 'bg-[#F58220] text-white' : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 group-hover:bg-orange-100 group-hover:text-orange-600'}`}>
                                                        <CreditCard className="h-6 w-6" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <h3 className="font-bold text-lg">Pay Directly</h3>
                                                        <p className="text-gray-500 text-sm">
                                                            {total > 0 ? "Cards, Bank Transfer, USSD" : "No gateway needed when the amount due is zero"}
                                                        </p>
                                                    </div>
                                                    {paymentMethod === 'direct' && (
                                                        <div className="absolute top-2 right-2 w-5 h-5 bg-[#F58220] rounded-full flex items-center justify-center border-2 border-white dark:border-zinc-950">
                                                            <div className="w-2 h-2 bg-white rounded-full" />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-6 bg-gray-50 dark:bg-zinc-900/50">
                                            <Button
                                                disabled={!paymentMethod || isProcessing}
                                                onClick={
                                                    paymentMethod === 'wallet'
                                                        ? handleWalletPayment
                                                        : paymentMethod === 'giftCard'
                                                            ? handleGiftCardPayment
                                                            : handleDirectPayment
                                                }
                                                className="w-full rounded-2xl bg-[#F58220] hover:bg-[#F58220]/90 text-white font-bold h-14 text-lg shadow-xl shadow-orange-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                                            >
                                                {isProcessing ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                        Processing...
                                                    </>
                                                ) : (
                                                    `Complete Payment ${formatKobo(total)}`
                                                )}
                                            </Button>
                                            <p className="mt-4 text-center text-[10px] font-medium uppercase tracking-[0.1em] text-gray-400">
                                                {paymentMethod === 'direct' ? 'Secured by Monnify Gateway' : 'Stored value payments are secured server-side'}
                                            </p>
                                        </div>
                                    </DialogContent>
                                </Dialog>
                                <p className="text-xs text-center text-gray-400">Secure Checkout - 100% Money Back Guarantee</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}
