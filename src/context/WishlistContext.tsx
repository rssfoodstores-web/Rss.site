"use client"

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
    type ReactNode,
} from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/context/UserContext"

interface ProductRow {
    category: string
    id: string
    image_url: string | null
    name: string
    price: number
    stock_level: number | null
}

interface WishlistProductInput {
    category?: string | null
    id: string
    image?: string | null
    imageUrl?: string | null
    name: string
    price: number
    stock_level?: number | null
}

interface WishlistRelationRow {
    product_id: string | null
    products: ProductRow | ProductRow[] | null
}

interface WishlistItem {
    id: string
    name: string
    price: number
    image?: string
    status: "In Stock" | "Out of Stock"
    category?: string
}

interface WishlistContextType {
    items: WishlistItem[]
    isInWishlist: (productId: string) => boolean
    toggleWishlist: (product: WishlistProductInput) => Promise<void>
    isLoading: boolean
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined)
const WISHLIST_STORAGE_KEY = "rssa_wishlist"

function mapProductToWishlistItem(product: ProductRow): WishlistItem {
    return {
        category: product.category,
        id: product.id,
        image: product.image_url ?? undefined,
        name: product.name,
        price: product.price,
        status: (product.stock_level ?? 0) > 0 ? "In Stock" : "Out of Stock",
    }
}

function buildWishlistItemFromInput(product: WishlistProductInput): WishlistItem {
    return {
        category: product.category ?? undefined,
        id: product.id,
        image: product.imageUrl ?? product.image ?? undefined,
        name: product.name,
        price: product.price,
        status: (product.stock_level ?? 1) > 0 ? "In Stock" : "Out of Stock",
    }
}

function parseStoredWishlist(value: string | null): WishlistItem[] {
    if (!value) {
        return []
    }

    try {
        const parsed = JSON.parse(value) as unknown

        if (!Array.isArray(parsed)) {
            return []
        }

        return parsed.filter((item): item is WishlistItem => {
            if (!item || typeof item !== "object") {
                return false
            }

            return typeof item.id === "string"
                && typeof item.name === "string"
                && typeof item.price === "number"
        })
    } catch (error) {
        console.error("Failed to parse stored wishlist:", error)
        return []
    }
}

function getFirstRelatedProduct(products: WishlistRelationRow["products"]): ProductRow | null {
    if (Array.isArray(products)) {
        return products[0] ?? null
    }

    return products ?? null
}

export function WishlistProvider({ children }: { children: ReactNode }) {
    const [items, setItems] = useState<WishlistItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const { user, isLoading: isUserLoading } = useUser()
    const [supabase] = useState(() => createClient())

    const persistLocalWishlist = useCallback((nextItems: WishlistItem[]) => {
        if (typeof window === "undefined") {
            return
        }

        localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(nextItems))
    }, [])

    const loadWishlistFromLocal = useCallback(async () => {
        if (typeof window === "undefined") {
            setItems([])
            return
        }

        const localItems = parseStoredWishlist(localStorage.getItem(WISHLIST_STORAGE_KEY))
        const productIds = localItems.map((item) => item.id)

        if (!productIds.length) {
            setItems([])
            return
        }

        const { data, error } = await supabase
            .from("products")
            .select("id, name, price, image_url, stock_level, category")
            .in("id", productIds)

        const refreshedProducts = (data ?? null) as ProductRow[] | null

        if (error || !refreshedProducts) {
            if (error) {
                console.error("Error refreshing local wishlist items:", error)
            }
            setItems(localItems)
            return
        }

        const refreshedItems = refreshedProducts.map(mapProductToWishlistItem)
        setItems(refreshedItems)
        persistLocalWishlist(refreshedItems)
    }, [persistLocalWishlist, supabase])

    const fetchWishlistFromDB = useCallback(async (userId: string) => {
        const { data, error } = await supabase
            .from("wishlists")
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
            .eq("user_id", userId)

        if (error) {
            throw error
        }

        const rows = (data ?? []) as WishlistRelationRow[]
        const formattedItems = rows
            .map((row) => getFirstRelatedProduct(row.products))
            .filter((product): product is ProductRow => Boolean(product))
            .map(mapProductToWishlistItem)

        setItems(formattedItems)
    }, [supabase])

    const syncLocalToDB = useCallback(async (userId: string) => {
        if (typeof window === "undefined") {
            return
        }

        const localItems = parseStoredWishlist(localStorage.getItem(WISHLIST_STORAGE_KEY))

        if (!localItems.length) {
            return
        }

        for (const item of localItems) {
            const { error } = await supabase
                .from("wishlists")
                .upsert(
                    { product_id: item.id, user_id: userId },
                    {
                        ignoreDuplicates: true,
                        onConflict: "user_id,product_id",
                    }
                )

            if (error) {
                console.error("Error syncing wishlist item:", error)
            }
        }

        localStorage.removeItem(WISHLIST_STORAGE_KEY)
    }, [supabase])

    useEffect(() => {
        const initWishlist = async () => {
            if (isUserLoading) {
                return
            }

            try {
                if (user) {
                    await syncLocalToDB(user.id)
                    await fetchWishlistFromDB(user.id)
                } else {
                    await loadWishlistFromLocal()
                }
            } catch (error) {
                console.error("Error loading wishlist:", error)
                await loadWishlistFromLocal()
            } finally {
                setIsLoading(false)
            }
        }

        void initWishlist()
    }, [fetchWishlistFromDB, isUserLoading, loadWishlistFromLocal, syncLocalToDB, user])

    const isInWishlist = useCallback((productId: string) => {
        return items.some((item) => item.id === productId)
    }, [items])

    const toggleWishlist = useCallback(async (product: WishlistProductInput) => {
        const nextItem = buildWishlistItemFromInput(product)
        const existingItem = items.find((item) => item.id === product.id)
        const nextItems = existingItem
            ? items.filter((item) => item.id !== product.id)
            : [...items, nextItem]

        setItems(nextItems)
        toast[existingItem ? "info" : "success"](
            existingItem ? "Removed from wishlist" : "Added to wishlist"
        )

        if (!user) {
            persistLocalWishlist(nextItems)
            return
        }

        try {
            if (existingItem) {
                const { error } = await supabase
                    .from("wishlists")
                    .delete()
                    .match({ product_id: product.id, user_id: user.id })

                if (error) {
                    throw error
                }
            } else {
                const { error } = await supabase
                    .from("wishlists")
                    .upsert(
                        { product_id: product.id, user_id: user.id },
                        {
                            ignoreDuplicates: true,
                            onConflict: "user_id,product_id",
                        }
                    )

                if (error) {
                    throw error
                }
            }
        } catch (error) {
            console.error("Wishlist update failed, reverting:", error)
            setItems(items)
            toast.error("Failed to update wishlist")
        }
    }, [items, persistLocalWishlist, supabase, user])

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
