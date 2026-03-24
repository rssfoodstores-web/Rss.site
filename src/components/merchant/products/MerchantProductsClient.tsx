"use client"

import { useState, useMemo, useEffect } from "react"
import { ProductTable, type Product } from "@/components/merchant/products/ProductTable"
import { ProductFilters } from "@/components/merchant/products/ProductFilters"
import { Button } from "@/components/ui/button"
import { Plus, MapPin, Lock, RefreshCw } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

interface MerchantProductsClientProps {
    initialProducts: Product[]
    locationReady: boolean
    locationEditingUnlocked: boolean
    updateRequested: boolean
    locationStatusMessage: string
    userId: string
}

export function MerchantProductsClient({
    initialProducts,
    locationReady,
    locationEditingUnlocked,
    updateRequested,
    locationStatusMessage,
    userId
}: MerchantProductsClientProps) {
    // Use initial products as the starting state, but keep local state for realtime updates if needed
    const [products, setProducts] = useState<Product[]>(initialProducts)
    const [activeTab, setActiveTab] = useState("All Products")
    const router = useRouter()
    const supabase = createClient()

    // Sync products if initialProducts changes (e.g. server re-render)
    useEffect(() => {
        setProducts(initialProducts)
    }, [initialProducts])

    // Real-time subscription to keep list updated without refresh
    useEffect(() => {
        const channel = supabase
            .channel('merchant-products-realtime')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'products',
                filter: `merchant_id=eq.${userId}` // Filter by merchant ID for efficiency
            }, async () => {
                // For simplicity, we can just refresh the page data or handle the delta
                // Refreshing the route is the easiest way to keep server data in sync
                router.refresh()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [supabase, router, userId])

    const counts = useMemo(() => {
        return {
            all: products.length,
            pending: products.filter(p => p.status === 'pending').length,
            approved: products.filter(p => p.status === 'approved').length,
            rejected: products.filter(p => p.status === 'rejected').length,
        }
    }, [products])

    const filteredProducts = useMemo(() => {
        if (activeTab === "All Products") return products
        const status = activeTab.toLowerCase()
        return products.filter(p => p.status === status)
    }, [products, activeTab])

    return (
        <div className="space-y-6">

            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-[#1A1A1A] dark:text-white mb-1">Product</h1>
                    {!locationReady && (
                        <p className="text-sm text-red-500 font-medium">
                            {locationStatusMessage}
                        </p>
                    )}
                </div>
                <div className="flex w-full flex-col gap-3 sm:flex-row md:w-auto md:items-center">
                    <Link href="/merchant/verify-location">
                        {updateRequested ? (
                            <Button
                                variant="outline"
                                className="flex h-10 w-full items-center rounded-lg border border-yellow-200 bg-yellow-50 px-6 text-sm font-medium text-yellow-700 hover:bg-yellow-100 sm:w-auto"
                            >
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Update Pending
                            </Button>
                        ) : locationEditingUnlocked ? (
                            <Button
                                variant="outline"
                                className="flex h-10 w-full items-center rounded-lg border border-blue-200 bg-blue-50 px-6 text-sm font-medium text-blue-700 hover:bg-blue-100 sm:w-auto"
                            >
                                <MapPin className="h-4 w-4 mr-2" /> Edit Approved
                            </Button>
                        ) : locationReady ? (
                            <Button
                                variant="outline"
                                className="flex h-10 w-full items-center rounded-lg border border-green-200 bg-green-50 px-6 text-sm font-medium text-green-700 hover:bg-green-100 sm:w-auto"
                            >
                                <Lock className="h-4 w-4 mr-2" /> Location Verified
                            </Button>
                        ) : (
                            <Button
                                className="h-10 w-full rounded-lg border border-red-200 bg-red-50 px-6 text-sm font-medium text-red-600 hover:bg-red-100 sm:w-auto animate-pulse"
                            >
                                <MapPin className="h-4 w-4 mr-2" /> Verify Location
                            </Button>
                        )}
                    </Link>

                    {locationReady ? (
                        <Link href="/merchant/products/add">
                            <Button className="flex h-10 w-full items-center gap-2 rounded-lg bg-[#1E1E66] px-6 font-bold text-white shadow-sm transition-all active:scale-95 hover:bg-[#1E1E66]/90 sm:w-auto">
                                <Plus className="h-4 w-4" /> Add Product
                            </Button>
                        </Link>
                    ) : (
                        <Link href="/merchant/verify-location">
                            <Button
                                className="flex h-10 w-full cursor-not-allowed items-center gap-2 rounded-lg bg-gray-200 px-6 font-bold text-gray-500 transition-colors hover:bg-gray-300 sm:w-auto"
                            >
                                <Plus className="h-4 w-4" /> Add Product
                            </Button>
                        </Link>
                    )}
                </div>
            </div>

            <div className="rounded-[2rem] border border-gray-100/50 bg-white p-5 shadow-sm dark:bg-zinc-900 sm:p-8">
                {/* Filter Tabs & Search */}
                <ProductFilters
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    counts={counts}
                />

                {/* Product Table */}
                <div className="mt-6">
                    <ProductTable products={filteredProducts} />
                </div>
            </div>

            <div className="text-center text-[10px] text-gray-400 py-4">
                RSS FOODS Platform @ 2025. All right reserved
            </div>
        </div>
    )
}
