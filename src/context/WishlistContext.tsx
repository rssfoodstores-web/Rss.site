"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Product } from "@/components/home/ProductCard" // Import type
import { useUser } from "@/context/UserContext"

interface WishlistItem {
    id: string // Product ID
    name: string
    price: number
    image?: string
    status: "In Stock" | "Out of Stock"
    category?: string
}

interface WishlistContextType {
    items: WishlistItem[]
    isInWishlist: (productId: string) => boolean
    toggleWishlist: (product: any) => Promise<void>
    isLoading: boolean
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined)

export function WishlistProvider({ children }: { children: ReactNode }) {
    const [items, setItems] = useState<WishlistItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const { user, isLoading: isUserLoading } = useUser()
    const supabase = createClient()

    // 1. Respond to User Changes
    useEffect(() => {
        const init = async () => {
            if (isUserLoading) return

            try {
                if (user) {
                    await syncLocalToDB(user.id)
                    await fetchWishlistFromDB(user.id)
                } else {
                    loadWishlistFromLocal()
                }
            } catch (error) {
                console.error("Error loading wishlist:", error)
                loadWishlistFromLocal()
            } finally {
                setIsLoading(false)
            }
        }
        init()
    }, [user, isUserLoading])

    const loadWishlistFromLocal = async () => {
        const saved = localStorage.getItem("rssa_wishlist")
        if (saved) {
            try {
                const localItems: WishlistItem[] = JSON.parse(saved)
                // Extract IDs to fetch fresh data
                const productIds = localItems.map(i => i.id)

                if (productIds.length > 0) {
                    const { data, error } = await supabase
                        .from('products')
                        .select('id, name, price, image_url, stock_level, category')
                        .in('id', productIds)

                    if (!error && data) {
                        // Merge fresh data with local data (to keep any extra fields if any, though mostly we replace)
                        const refreshedItems: WishlistItem[] = data.map((prod: any) => ({
                            id: prod.id,
                            name: prod.name,
                            price: prod.price,
                            image: prod.image_url,
                            status: (prod.stock_level ?? 0) > 0 ? "In Stock" : "Out of Stock",
                            category: prod.category
                        }))
                        setItems(refreshedItems)
                        // Optionally update local storage with fresh data
                        localStorage.setItem("rssa_wishlist", JSON.stringify(refreshedItems))
                        return
                    }
                }

                // Fallback if fetch fails or no items
                setItems(localItems)
            } catch (e) {
                console.error("Failed to parse wishlist", e)
            }
        }
    }

    const fetchWishlistFromDB = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('wishlists')
                .select(`
                    product_id,
                    products (
                        id,
                        name,
                        price,
                        image_url,
                        stock_level,
                        category
                    )
                `)
                .eq('user_id', userId)

            if (error) throw error

            if (data) {
                const formattedItems: WishlistItem[] = data.map((item: any) => ({
                    id: item.products.id,
                    name: item.products.name,
                    price: item.products.price,
                    image: item.products.image_url,
                    status: item.products.stock_level > 0 ? "In Stock" : "Out of Stock",
                    category: item.products.category
                }))
                setItems(formattedItems)
            }
        } catch (err) {
            console.error("Error fetching wishlist:", err)
        }
    }

    const syncLocalToDB = async (userId: string) => {
        const local = localStorage.getItem("rssa_wishlist")
        if (!local) return

        try {
            const localItems: WishlistItem[] = JSON.parse(local)
            // Upsert all local items to DB
            // Note: This is a bit naive, ideally we check duplicates, but DB constraint handles unique(user_id, product_id)
            // We loop for simplicity or use upsert
            for (const item of localItems) {
                await supabase
                    .from('wishlists')
                    .insert({ user_id: userId, product_id: item.id })
                    .select() // ignore error if exists
                    .maybeSingle()
            }
            // Clear local
            localStorage.removeItem("rssa_wishlist")
        } catch (e) {
            console.error("Sync error", e)
        }
    }

    const isInWishlist = (productId: string) => {
        return items.some(item => item.id === productId)
    }

    const toggleWishlist = async (product: any) => {
        const exists = isInWishlist(product.id)

        // Optimistic UI update
        if (exists) {
            setItems(prev => prev.filter(item => item.id !== product.id))
            toast.info("Removed from wishlist")
        } else {
            const newItem: WishlistItem = {
                id: product.id,
                name: product.name,
                price: product.price,
                image: product.imageUrl || product.image,
                status: (product.stock_level ?? 1) > 0 ? "In Stock" : "Out of Stock", // Default to In Stock if unknown
                category: product.category
            }
            setItems(prev => [...prev, newItem])
            toast.success("Added to wishlist")
        }

        // Persist
        if (user) {
            try {
                if (exists) {
                    await supabase
                        .from('wishlists')
                        .delete()
                        .match({ user_id: user.id, product_id: product.id })
                } else {
                    await supabase
                        .from('wishlists')
                        .insert({ user_id: user.id, product_id: product.id })
                }
            } catch (err) {
                console.error("DB update failed, reverting", err)
                // Revert state if needed (skip for brevity, but good practice)
                toast.error("Failed to update wishlist server")
            }
        } else {
            // LocalStorage
            const current = exists
                ? items.filter(i => i.id !== product.id)
                : [...items, {
                    id: product.id,
                    name: product.name,
                    price: product.price,
                    image: product.imageUrl || product.image,
                    status: (product.stock_level ?? 1) > 0 ? "In Stock" : "Out of Stock",
                    category: product.category
                }]
            localStorage.setItem("rssa_wishlist", JSON.stringify(current))
        }
    }

    return (
        <WishlistContext.Provider value={{ items, isInWishlist, toggleWishlist, isLoading }}>
            {children}
        </WishlistContext.Provider>
    )
}

export function useWishlist() {
    const context = useContext(WishlistContext)
    if (context === undefined) {
        throw new Error("useWishlist must be used within a WishlistProvider")
    }
    return context
}
