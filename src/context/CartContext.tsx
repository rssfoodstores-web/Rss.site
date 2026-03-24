"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { toast } from "sonner"

export interface CartItem {
    id: string
    name: string
    price: number
    image?: string
    quantity: number
    merchantId: string
    maxStock?: number
}

interface CartProductInput {
    id: string
    name: string
    price: number
    category?: string
    imageUrl?: string | null
    image?: string | null
    merchant_id?: string | null
    merchantId?: string | null
    quantity?: number
    stock_level?: number | null
}

interface CartContextType {
    items: CartItem[]
    cartMerchantId: string | null
    addToCart: (product: CartProductInput) => void
    removeFromCart: (productId: string) => void
    updateQuantity: (productId: string, quantity: number) => void
    clearCart: () => void
    cartTotal: number
    itemCount: number
}

const CartContext = createContext<CartContextType | undefined>(undefined)

const CART_STORAGE_KEY = "rssa_cart"

function getProductMerchantId(product: CartProductInput): string {
    return product.merchant_id ?? product.merchantId ?? ""
}

export function CartProvider({ children }: { children: ReactNode }) {
    const [items, setItems] = useState<CartItem[]>([])
    const [isLoaded, setIsLoaded] = useState(false)

    useEffect(() => {
        const savedCart = localStorage.getItem(CART_STORAGE_KEY)
        let parsedItems: CartItem[] = []

        if (savedCart) {
            try {
                parsedItems = JSON.parse(savedCart) as CartItem[]
            } catch (error) {
                console.error("Failed to parse cart", error)
            }
        }

        const frame = window.requestAnimationFrame(() => {
            setItems(parsedItems)
            setIsLoaded(true)
        })

        return () => window.cancelAnimationFrame(frame)
    }, [])

    useEffect(() => {
        if (isLoaded) {
            localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items))
        }
    }, [isLoaded, items])

    const addToCart = (product: CartProductInput) => {
        const merchantId = getProductMerchantId(product)
        const requestedQuantity = Math.max(1, Math.trunc(product.quantity ?? 1))
        const availableStock = product.stock_level ?? null

        if (!merchantId) {
            toast.error("This product cannot be added right now.")
            return
        }

        if (availableStock !== null && availableStock <= 0) {
            toast.error("No stock available for this item.")
            return
        }

        setItems((previousItems) => {
            const existingMerchantId = previousItems[0]?.merchantId ?? null

            if (existingMerchantId && existingMerchantId !== merchantId) {
                const confirmed = window.confirm(
                    "Your cart can only contain items from one merchant at a time. Clear the current cart and add this item?"
                )

                if (!confirmed) {
                    return previousItems
                }

                toast.info("Cart cleared for a new merchant order.")

                return [
                    {
                        id: product.id,
                        name: product.name,
                        price: product.price,
                        image: product.imageUrl ?? product.image ?? undefined,
                        quantity: availableStock !== null
                            ? Math.min(requestedQuantity, availableStock)
                            : requestedQuantity,
                        merchantId,
                        maxStock: availableStock ?? undefined,
                    },
                ]
            }

            const existingItem = previousItems.find((item) => item.id === product.id)

            if (existingItem) {
                const nextQuantity = existingItem.quantity + requestedQuantity
                const cappedQuantity = existingItem.maxStock
                    ? Math.min(nextQuantity, existingItem.maxStock)
                    : nextQuantity

                if (cappedQuantity === existingItem.quantity) {
                    toast.error("No more stock available for this item.")
                    return previousItems
                }

                toast.success("Cart updated.", {
                    description: `Increased quantity of ${product.name}.`,
                })

                return previousItems.map((item) =>
                    item.id === product.id
                        ? {
                            ...item,
                            quantity: cappedQuantity,
                        }
                        : item
                )
            }

            toast.success("Added to cart.", {
                description: `${product.name} added to your cart.`,
            })

            return [
                ...previousItems,
                {
                    id: product.id,
                    name: product.name,
                    price: product.price,
                    image: product.imageUrl ?? product.image ?? undefined,
                    quantity: availableStock !== null
                        ? Math.min(requestedQuantity, availableStock)
                        : requestedQuantity,
                    merchantId,
                    maxStock: availableStock ?? undefined,
                },
            ]
        })
    }

    const removeFromCart = (productId: string) => {
        setItems((previousItems) => previousItems.filter((item) => item.id !== productId))
        toast.info("Item removed from cart.")
    }

    const updateQuantity = (productId: string, quantity: number) => {
        if (quantity < 1) {
            removeFromCart(productId)
            return
        }

        setItems((previousItems) =>
            previousItems.map((item) => {
                if (item.id !== productId) {
                    return item
                }

                if (item.maxStock && quantity > item.maxStock) {
                    toast.error("Requested quantity exceeds available stock.")
                    return item
                }

                return { ...item, quantity }
            })
        )
    }

    const clearCart = () => {
        setItems([])
        localStorage.removeItem(CART_STORAGE_KEY)
    }

    const cartTotal = items.reduce((total, item) => total + item.price * item.quantity, 0)
    const itemCount = items.reduce((count, item) => count + item.quantity, 0)
    const cartMerchantId = items[0]?.merchantId ?? null

    return (
        <CartContext.Provider
            value={{
                items,
                cartMerchantId,
                addToCart,
                removeFromCart,
                updateQuantity,
                clearCart,
                cartTotal,
                itemCount,
            }}
        >
            {children}
        </CartContext.Provider>
    )
}

export function useCart() {
    const context = useContext(CartContext)

    if (!context) {
        throw new Error("useCart must be used within a CartProvider")
    }

    return context
}
