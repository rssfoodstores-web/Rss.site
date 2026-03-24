"use client"

import Link from "next/link"
import { Home, ShoppingCart, Trash2, Heart, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useWishlist } from "@/context/WishlistContext"
import { useCart } from "@/context/CartContext"

export default function WishlistPage() {
    const { items: wishlistItems, toggleWishlist, isLoading } = useWishlist()
    const { addToCart } = useCart()

    if (isLoading) {
        return (
            <div className="min-h-screen bg-white dark:bg-black font-sans text-center py-24 text-[#1A1A1A] dark:text-white">
                Loading...
            </div>
        )
    }

    if (wishlistItems.length === 0) {
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
                        <span className="text-[#F58220] font-medium">Wishlist</span>
                    </div>
                </div>

                <div className="container mx-auto px-4 lg:px-6 flex flex-col items-center justify-center text-center py-12">
                    <div className="h-32 w-32 bg-gray-50 dark:bg-zinc-900 rounded-full flex items-center justify-center mb-8">
                        <Heart className="h-12 w-12 text-gray-300 dark:text-gray-600" />
                    </div>

                    <h1 className="text-[40px] leading-tight font-bold mb-4 text-[#1A1A1A] dark:text-white">
                        Your wishlist is empty
                    </h1>
                    <p className="text-gray-400 text-lg mb-10">
                        Explore our products and save your favorites!
                    </p>

                    <Link href="/">
                        <Button className="bg-[#F58220] hover:bg-[#F58220]/90 text-white font-bold px-12 py-7 rounded-full text-lg shadow-xl shadow-orange-500/20 active:scale-95 transition-all">
                            Start Shopping
                        </Button>
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-white dark:bg-black py-8 lg:py-12 font-sans text-[#1A1A1A] dark:text-white">
            <div className="container mx-auto px-4 lg:px-6">
                <h1 className="text-3xl font-bold mb-8 text-center">My Wishlist</h1>

                <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
                    {/* Desktop Table */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-gray-100 dark:border-zinc-800 text-xs uppercase tracking-wide text-gray-500">
                                    <th className="p-6 font-medium">Product</th>
                                    <th className="p-6 font-medium">Price</th>
                                    <th className="p-6 font-medium">Stock Status</th>
                                    <th className="p-6 font-medium"></th>
                                    <th className="p-6 font-medium"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                {wishlistItems.map((item) => (
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
                                            ₦{item.price.toLocaleString()}
                                        </td>
                                        <td className="p-6">
                                            <Badge variant={item.status === "In Stock" ? "default" : "destructive"} className={item.status === "In Stock" ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400" : ""}>
                                                {item.status}
                                            </Badge>
                                        </td>
                                        <td className="p-6">
                                            <Button
                                                onClick={() => addToCart(item)}
                                                disabled={item.status === "Out of Stock"}
                                                className="rounded-full bg-[#F58220] hover:bg-[#F58220]/90 text-white font-bold shadow-lg shadow-orange-500/20"
                                            >
                                                Add to Cart <ShoppingCart className="ml-2 h-4 w-4" />
                                            </Button>
                                        </td>
                                        <td className="p-6 text-right">
                                            <button
                                                onClick={() => toggleWishlist(item)}
                                                className="h-8 w-8 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400 hover:text-red-500 transition-colors flex items-center justify-center"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden divide-y divide-gray-100 dark:divide-zinc-800">
                        {wishlistItems.map((item) => (
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
                                                onClick={() => toggleWishlist(item)}
                                                className="h-7 w-7 rounded-full border border-gray-100 dark:border-zinc-800 flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-200 transition-colors shrink-0"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                        <p className="text-gray-500 text-sm mb-2">₦{item.price.toLocaleString()}</p>
                                        <div className="mb-3">
                                            <Badge variant={item.status === "In Stock" ? "default" : "destructive"} className={item.status === "In Stock" ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400" : ""}>
                                                {item.status}
                                            </Badge>
                                        </div>

                                        <Button
                                            onClick={() => addToCart(item)}
                                            disabled={item.status === "Out of Stock"}
                                            size="sm"
                                            className="w-full rounded-full bg-[#F58220] hover:bg-[#F58220]/90 text-white font-bold shadow-md shadow-orange-500/20"
                                        >
                                            Add to Cart <ShoppingCart className="ml-2 h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
