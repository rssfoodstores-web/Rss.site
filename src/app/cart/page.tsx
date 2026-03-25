"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Minus, Plus, X, Trash2, MapPin, Smartphone, CreditCard, ChevronRight, Home, ArrowLeft, Loader2, AlertCircle, CheckCircle2, Wallet, Gift } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCart } from "@/context/CartContext"
import { formatKobo } from "@/lib/money"
import { useUser } from "@/context/UserContext"
import { toast } from "sonner"
import Script from "next/script"
import { calculateDeliveryFee } from "@/app/actions/delivery"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { getRewardCheckoutSummary } from "@/app/account/rewards/actions"
import { initiateDirectPayment, processGiftCardPayment, processWalletPayment } from "@/app/actions/orderActions"

// Standard Nigeria Lat/Lng (Middle of Nigeria for default)
const DEFAULT_CENTER: [number, number] = [9.0820, 8.6753]

export default function CartPage() {
    const { items: cartItems, removeFromCart, updateQuantity, cartTotal, clearCart } = useCart()
    const { user } = useUser()
    const router = useRouter()
    const [mapLoaded, setMapLoaded] = useState(false)
    const [mapInstance, setMapInstance] = useState<any>(null)
    const [markerInstance, setMarkerInstance] = useState<any>(null)
    const mapRef = useRef<HTMLDivElement>(null)

    // User Location & Delivery State
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
    const [savedProfileAddress, setSavedProfileAddress] = useState<string>("")
    const [deliveryFeeKobo, setDeliveryFeeKobo] = useState<number>(0)
    const [isCalculatingFee, setIsCalculatingFee] = useState(false)
    const [deliverySettings, setDeliverySettings] = useState<any>(null)
    const [distanceKm, setDistanceKm] = useState<number>(0)
    const [contactNumbers, setContactNumbers] = useState<string[]>(["", "", ""])

    // Checkout State
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const [paymentMethod, setPaymentMethod] = useState<'direct' | 'wallet' | 'giftCard' | null>(null)
    const [walletBalance, setWalletBalance] = useState<number | null>(null)
    const [isLoadingBalance, setIsLoadingBalance] = useState(false)
    const [giftCardBalance, setGiftCardBalance] = useState<number | null>(null)
    const [giftCardCount, setGiftCardCount] = useState<number>(0)

    // Rewards State
    const [rewardSummary, setRewardSummary] = useState<any>(null)
    const [rewardPointsInput, setRewardPointsInput] = useState<string>("")
    const [rewardDiscountKobo, setRewardDiscountKobo] = useState<number>(0)

    // Fetch User Data & Settings
    useEffect(() => {
        const fetchData = async () => {
            if (!user) return

            try {
                // Fetch rewards
                if (cartTotal > 0) {
                    const rewards = await getRewardCheckoutSummary(cartTotal)
                    setRewardSummary(rewards)
                }

                // Fetch delivery settings and location via a combined profile call would be better,
                // but for now we follow the existing pattern if available.
                // Assuming existing logic from user code was working:
                const response = await fetch('/api/user/profile-location')
                if (response.ok) {
                    const data = await response.json()
                    if (data.location) {
                        setUserLocation(data.location)
                        setSavedProfileAddress(data.address || "")
                        setContactNumbers(data.phone_numbers || ["", "", ""])
                    }
                    setDeliverySettings(data.settings)
                }
            } catch (error) {
                console.error("Error fetching cart init data:", error)
            }
        }
        fetchData()
    }, [user])

    // Calculate Rewards Discount
    useEffect(() => {
        if (!rewardSummary?.enabled || !rewardPointsInput) {
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
    }, [rewardPointsInput, rewardSummary])

    // Fetch Balances when Checkout Opens
    useEffect(() => {
        if (isCheckoutOpen && user) {
            const fetchBalances = async () => {
                setIsLoadingBalance(true)
                try {
                    const response = await fetch('/api/user/balances')
                    if (response.ok) {
                        const data = await response.json()
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
            fetchBalances()
        }
    }, [isCheckoutOpen, user])

    // Calculate Delivery Fee
    useEffect(() => {
        const getFee = async () => {
            if (userLocation && deliverySettings) {
                setIsCalculatingFee(true)
                try {
                    const result = await calculateDeliveryFee(userLocation.lat, userLocation.lng)
                    setDeliveryFeeKobo(result.fee)
                    setDistanceKm(Number(result.distance.toFixed(2)))
                } catch (error) {
                    console.error("Error calculating fee:", error)
                    toast.error("Could not calculate delivery fee")
                } finally {
                    setIsCalculatingFee(false)
                }
            }
        }
        getFee()
    }, [userLocation, deliverySettings])

    // Leaflet Map Initialization
    useEffect(() => {
        if (mapLoaded && mapRef.current && !mapInstance && userLocation) {
            const L = (window as any).L
            const map = L.map(mapRef.current).setView([userLocation.lat, userLocation.lng], 13)
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(map)

            const icon = L.icon({
                iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
                shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41]
            })

            const marker = L.marker([userLocation.lat, userLocation.lng], { icon }).addTo(map)
            setMapInstance(map)
            setMarkerInstance(marker)
        } else if (mapInstance && userLocation && markerInstance) {
            markerInstance.setLatLng([userLocation.lat, userLocation.lng])
            mapInstance.setView([userLocation.lat, userLocation.lng], 13)
        }
    }, [mapLoaded, userLocation])

    const total = Math.max(0, (cartTotal - rewardDiscountKobo) + deliveryFeeKobo)
    const shipping = deliveryFeeKobo
    const baseTotal = cartTotal + deliveryFeeKobo

    const handleProceedToCheckout = () => {
        if (!user) {
            toast.error("Please login to proceed to checkout")
            router.push('/login?callback=/cart')
            return
        }
        if (!userLocation) {
            toast.error("Please set your delivery location in your profile")
            return
        }
        setIsCheckoutOpen(true)
    }

    const getCommonPayload = () => {
        if (!user) return null;
        
        return {
            userId: user.id,
            items: cartItems.map(i => ({ 
                product_id: i.id, 
                quantity: i.quantity 
            })),
            deliveryLocation: userLocation ? {
                type: "Point" as const,
                coordinates: [userLocation.lng, userLocation.lat] as [number, number]
            } : null,
            deliveryFeeKobo: deliveryFeeKobo,
            contactNumbers: contactNumbers.filter(n => n.trim() !== ""),
            rewardPointsToRedeem: parseInt(rewardPointsInput) || 0
        }
    }

    const handleWalletPayment = async () => {
        if (!user) return
        setIsProcessing(true)
        try {
            const payload = getCommonPayload()
            if (!payload) return
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
            if (!payload) return
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
            if (!payload) return
            const result = await initiateDirectPayment(payload)

            if (result.success && result.checkoutUrl) {
                toast.success("Redirecting to payment gateway...")
                clearCart()
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
                                            {cartItems.map((item) => (
                                                <tr key={item.id} className="group hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                                                    <td className="p-6">
                                                        <div className="flex items-center gap-4">
                                                            <div className="h-20 w-20 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden bg-gray-50 dark:bg-zinc-800 border border-gray-100 dark:border-zinc-800 group-hover:shadow-md transition-shadow">
                                                                {item.image ? (
                                                                    <img src={item.image} alt={item.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                                                ) : (
                                                                    <div className="h-10 w-10 bg-gray-200 dark:bg-zinc-700 rounded-full" />
                                                                )}
                                                            </div>
                                                            <span className="font-bold text-lg max-w-[240px] truncate tracking-tight text-gray-900 dark:text-white">{item.name}</span>
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
                                    {cartItems.map((item) => (
                                        <div key={item.id} className="p-4 relative transition-colors hover:bg-gray-50/30 dark:hover:bg-zinc-800/30">
                                            <div className="flex gap-4">
                                                {/* Image Container */}
                                                <div className="h-20 w-20 xs:h-24 xs:w-24 rounded-2xl flex-shrink-0 flex items-center justify-center overflow-hidden bg-gray-50 dark:bg-zinc-800 border border-gray-100 dark:border-zinc-800 shadow-sm relative group">
                                                    {item.image ? (
                                                        <img src={item.image} alt={item.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                                    ) : (
                                                        <div className="h-10 w-10 bg-gray-200 dark:bg-zinc-700 rounded-full animate-pulse" />
                                                    )}
                                                </div>

                                                {/* Details */}
                                                <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                                                    <div>
                                                        <div className="flex justify-between items-start mb-1">
                                                            <h3 className="font-bold text-gray-900 dark:text-white text-base truncate pr-6 tracking-tight">{item.name}</h3>
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
                                    {!userLocation ? (
                                        <div className="text-center py-10 bg-gray-50 dark:bg-zinc-800/50 rounded-2xl border-2 border-dashed border-gray-200 dark:border-zinc-700">
                                            <div className="mb-6 text-gray-500 text-lg font-medium">
                                                {deliverySettings
                                                    ? "Set your delivery location on your profile before checkout."
                                                    : "Loading delivery settings..."}
                                            </div>
                                            <Button asChild className="w-full bg-[#F58220] hover:bg-[#F58220]/90 text-white px-6 py-4 md:px-8 md:py-6 rounded-2xl h-auto text-base md:text-lg font-bold shadow-xl shadow-orange-500/20">
                                                <Link href="/account/profile">
                                                    <MapPin className="mr-2 h-5 w-5" />
                                                    Set My Location
                                                </Link>
                                            </Button>
                                            <div className="mt-6 text-sm text-gray-400 max-w-sm mx-auto">
                                                Orders will be delivered to the location saved on your profile for maximum security.
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 p-4 md:p-5 bg-gray-50 dark:bg-zinc-800/50 rounded-2xl border border-gray-100 dark:border-zinc-800">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-2 text-[10px] md:text-sm uppercase tracking-wider mb-2">
                                                        <CheckCircle2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                                                        Verified Location
                                                    </p>
                                                    {savedProfileAddress && (
                                                        <p className="text-base md:text-lg font-bold text-gray-900 dark:text-white leading-tight mb-2 truncate md:whitespace-normal">
                                                            {savedProfileAddress}
                                                        </p>
                                                    )}
                                                    <div className="flex flex-wrap items-center gap-3 md:gap-4 text-xs md:text-sm font-bold text-gray-500">
                                                        <span className="flex items-center gap-1.5 whitespace-nowrap">
                                                            <div className="w-1.5 h-1.5 bg-[#F58220] rounded-full" />
                                                            Distance: {distanceKm} km
                                                        </span>
                                                        <span className="flex items-center gap-1.5 whitespace-nowrap">
                                                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                                                            Rider Ready
                                                        </span>
                                                    </div>
                                                </div>
                                                <Button variant="outline" size="sm" asChild className="w-full sm:w-auto rounded-xl border-2 border-gray-200 dark:border-zinc-700 font-black hover:bg-white transition-all shadow-sm py-5 sm:py-2">
                                                    <Link href="/account/profile">Change</Link>
                                                </Button>
                                            </div>

                                            <div className="rounded-2xl border-2 border-amber-200/50 bg-amber-50/50 px-5 py-4 text-sm text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-100 backdrop-blur-sm">
                                                <div className="flex gap-3">
                                                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                                                    <p className="font-medium">
                                                        Delivery is strictly tied to this saved location. Ensure it's accurate because our riders are dispatched using these exact coordinates.
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Map Container */}
                                            <div className="h-72 w-full rounded-2xl overflow-hidden border-4 border-white dark:border-zinc-800 shadow-xl relative z-0">
                                                <div id="leaflet-map" ref={mapRef} className="h-full w-full" />
                                            </div>

                                            {/* Contact Numbers */}
                                            <div className="mt-8">
                                                <h4 className="font-black text-sm mb-4 flex items-center gap-2 uppercase tracking-widest text-gray-400">
                                                    <Smartphone className="h-4 w-4 text-[#F58220]" />
                                                    Contact Rider Via
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
                                        <span className="font-bold text-gray-900 dark:text-white">{formatKobo(cartTotal)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[#6B7280] dark:text-gray-400 font-medium pb-5 border-b border-gray-100 dark:border-zinc-800 text-lg">
                                        <span>Delivery Fee</span>
                                        {isCalculatingFee ? (
                                            <span className="flex items-center text-[#F58220] font-black italic animate-pulse">
                                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                CALCULATING
                                            </span>
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
                                    disabled={!userLocation || !deliverySettings}
                                    className="w-full rounded-2xl bg-[#F58220] hover:bg-[#F58220]/90 text-white font-black py-6 md:py-8 text-lg md:text-xl shadow-2xl shadow-orange-500/30 mb-6 transition-all hover:scale-[1.03] active:scale-95 disabled:opacity-50 disabled:scale-100 h-auto"
                                >
                                    PAY NOW
                                </Button>

                                <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
                                    <DialogContent className="sm:max-w-[480px] rounded-[2.5rem] overflow-hidden border-none p-0 bg-white dark:bg-zinc-950 shadow-2xl">
                                        <div className="bg-[#F58220] p-8 text-white relative">
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                                            <div className="w-20 h-20 bg-white/20 rounded-[2rem] flex items-center justify-center mx-auto mb-6 border border-white/30 backdrop-blur-md shadow-lg rotate-12">
                                                <CreditCard className="h-10 w-10 text-white -rotate-12" />
                                            </div>
                                            <DialogHeader>
                                                <DialogTitle className="text-3xl font-black text-center text-white tracking-tighter mb-2">Checkout Details</DialogTitle>
                                                <DialogDescription className="text-white/90 text-center font-bold text-base opacity-80">
                                                    Secure your order with premium payment
                                                </DialogDescription>
                                            </DialogHeader>
                                        </div>

                                        <div className="p-8 space-y-8">
                                            <div className="flex justify-between items-center p-6 bg-gray-50 dark:bg-zinc-900 rounded-[2rem] border border-gray-100 dark:border-zinc-800">
                                                <span className="text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest text-sm">Grand Total</span>
                                                <span className="text-3xl font-black text-[#F58220] tracking-tighter">{formatKobo(total)}</span>
                                            </div>

                                            {/* Rewards Section */}
                                            <div className="rounded-[2rem] border-2 border-emerald-100 bg-emerald-50/50 p-4 xs:p-6 dark:border-emerald-900/30 dark:bg-emerald-950/20 relative overflow-hidden group">
                                                <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl transition-transform group-hover:scale-150" />
                                                <div className="flex items-start justify-between gap-4 relative z-10">
                                                    <div>
                                                        <h3 className="font-black text-emerald-800 dark:text-emerald-400 text-lg tracking-tight">Reward Points</h3>
                                                        <p className="mt-1 text-sm text-emerald-700/70 dark:text-emerald-300/60 font-medium">
                                                            {rewardSummary
                                                                ? `${rewardSummary.availablePoints.toLocaleString()} available`
                                                                : "Checking points..."}
                                                        </p>
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="rounded-xl bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300 font-black"
                                                        disabled={!rewardSummary?.enabled || rewardSummary.maxRedeemablePoints <= 0}
                                                        onClick={() => setRewardPointsInput(rewardSummary ? rewardSummary.maxRedeemablePoints.toString() : "")}
                                                    >
                                                        USE MAX
                                                    </Button>
                                                </div>

                                                {rewardSummary?.enabled ? (
                                                    <div className="mt-6 flex gap-3 relative z-10">
                                                        <Input
                                                            type="number"
                                                            min={0}
                                                            max={rewardSummary.maxRedeemablePoints}
                                                            placeholder="Points to redeem"
                                                            value={rewardPointsInput}
                                                            onChange={(event) => setRewardPointsInput(event.target.value)}
                                                            className="h-14 rounded-2xl bg-white dark:bg-zinc-900 border-emerald-100 dark:border-emerald-900 font-bold focus:ring-emerald-500"
                                                        />
                                                    </div>
                                                ) : null}
                                            </div>

                                            <div className="grid gap-4">
                                                {/* Payment Option Components... */}
                                                <PaymentOption 
                                                    id="wallet"
                                                    title="Rss Wallet"
                                                    subtitle={isLoadingBalance ? "Checking..." : `Balance: ${formatKobo(walletBalance ?? 0)}`}
                                                    icon={<Wallet className="h-6 w-6" />}
                                                    isSelected={paymentMethod === 'wallet'}
                                                    isDisabled={walletBalance === null || walletBalance < total}
                                                    onClick={() => setPaymentMethod('wallet')}
                                                    color="orange"
                                                />
                                                <PaymentOption 
                                                    id="giftCard"
                                                    title="Gift Card"
                                                    subtitle={isLoadingBalance ? "Checking..." : `Balance: ${formatKobo(giftCardBalance ?? 0)}`}
                                                    icon={<Gift className="h-6 w-6" />}
                                                    isSelected={paymentMethod === 'giftCard'}
                                                    isDisabled={giftCardBalance === null || giftCardBalance < total}
                                                    onClick={() => setPaymentMethod('giftCard')}
                                                    color="violet"
                                                />
                                                <PaymentOption 
                                                    id="direct"
                                                    title="Secure Pay"
                                                    subtitle="Cards, Bank, Transfer, USSD"
                                                    icon={<CreditCard className="h-6 w-6" />}
                                                    isSelected={paymentMethod === 'direct'}
                                                    isDisabled={total <= 0}
                                                    onClick={() => setPaymentMethod('direct')}
                                                    color="orange"
                                                />
                                            </div>
                                        </div>

                                        <div className="p-6 md:p-8 bg-gray-50 dark:bg-zinc-900/50 flex flex-col items-center">
                                            <Button
                                                disabled={!paymentMethod || isProcessing}
                                                onClick={
                                                    paymentMethod === 'wallet'
                                                        ? handleWalletPayment
                                                        : paymentMethod === 'giftCard'
                                                            ? handleGiftCardPayment
                                                            : handleDirectPayment
                                                }
                                                className="w-full rounded-[2rem] bg-[#F58220] hover:bg-[#F58220]/90 text-white font-black h-16 text-xl shadow-2xl shadow-orange-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                                            >
                                                {isProcessing ? (
                                                    <Loader2 className="h-8 w-8 animate-spin" />
                                                ) : (
                                                    `COMPLETE ORDER`
                                                )}
                                            </Button>
                                            <div className="mt-6 flex items-center gap-2 opacity-40">
                                                <div className="h-px w-8 bg-current" />
                                                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Verified Secure</span>
                                                <div className="h-px w-8 bg-current" />
                                            </div>
                                        </div>
                                    </DialogContent>
                                </Dialog>
                                <p className="text-xs text-center text-gray-400 font-bold opacity-60">100% Secure Checkout · SSL Encrypted</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}

function PaymentOption({ id, title, subtitle, icon, isSelected, isDisabled, onClick, color }: any) {
    const colorClasses = {
        orange: isSelected ? 'border-[#F58220] bg-orange-50/50 dark:bg-orange-500/10' : 'border-gray-100 dark:border-zinc-800 hover:border-orange-200',
        violet: isSelected ? 'border-violet-600 bg-violet-50/50 dark:bg-violet-500/10' : 'border-gray-100 dark:border-zinc-800 hover:border-violet-200'
    }

    const iconBg = {
        orange: isSelected ? 'bg-[#F58220] text-white shadow-lg shadow-orange-500/30' : 'bg-gray-100 dark:bg-zinc-800 text-gray-400',
        violet: isSelected ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/30' : 'bg-gray-100 dark:bg-zinc-800 text-gray-400'
    }

    return (
        <div
            onClick={() => !isDisabled && onClick()}
            className={`flex items-center gap-3 md:gap-4 p-4 md:p-5 rounded-[2rem] border-2 transition-all cursor-pointer group relative overflow-hidden ${colorClasses[color as keyof typeof colorClasses]} ${isDisabled ? 'opacity-40 grayscale-[0.5] cursor-not-allowed' : 'active:scale-[0.98]'}`}
        >
            <div className={`p-3 md:p-4 rounded-2xl transition-all duration-300 ${iconBg[color as keyof typeof iconBg]}`}>
                {icon}
            </div>
            <div className="flex-1">
                <h3 className="font-black text-lg tracking-tight">{title}</h3>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{subtitle}</p>
            </div>
            {isSelected && (
                <div className={`h-8 w-8 rounded-full flex items-center justify-center border-4 border-white dark:border-zinc-950 shadow-md ${color === 'orange' ? 'bg-[#F58220]' : 'bg-violet-600'}`}>
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                </div>
            )}
        </div>
    )
}
