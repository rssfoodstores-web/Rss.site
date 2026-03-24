"use client"

import { Edit, Eye, Trash2, Package } from "lucide-react"
import { cn } from "@/lib/utils"
import { deleteProduct } from "@/app/actions/productActions"
import { toast } from "sonner"
import Link from "next/link"
import { formatKobo } from "@/lib/money"

export interface Product {
    id: string
    name: string
    category: string
    price: number
    stock_level: number | null
    status: "pending" | "approved" | "rejected"
    created_at: string
    images: string[]
}

export function ProductTable({ products }: { products: Product[] }) {
    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this product?")) {
            return
        }

        try {
            await deleteProduct(id)
            toast.success("Product deleted successfully")
        } catch {
            toast.error("Failed to delete product")
        }
    }

    return (
        <div className="overflow-hidden rounded-[2rem] border border-gray-100 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            {products.length === 0 && (
                <div className="py-20 text-center">
                    <Package className="mx-auto mb-4 h-12 w-12 text-gray-200" />
                    <p className="font-medium text-gray-400">No products found.</p>
                </div>
            )}

            <div className="space-y-3 p-4 md:hidden">
                {products.map((product) => (
                    <div key={product.id} className="rounded-2xl border border-gray-100 p-4 dark:border-zinc-800">
                        <div className="flex items-start gap-3">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100 dark:bg-zinc-800">
                                {product.images?.[0] ? (
                                    <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover" />
                                ) : (
                                    <Package className="h-6 w-6 text-gray-400" />
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="truncate font-bold text-gray-900 dark:text-white">{product.name}</p>
                                <p className="mt-1 text-sm capitalize text-gray-500">{product.category.replace("_", " ")}</p>
                            </div>
                            <span
                                className={cn(
                                    "rounded-lg px-3 py-1 text-[11px] font-bold capitalize",
                                    product.status === "approved"
                                        ? "bg-green-50 text-[#12B76A]"
                                        : product.status === "pending"
                                            ? "bg-orange-50 text-[#F58220]"
                                            : "bg-red-50 text-[#F04438]"
                                )}
                            >
                                {product.status}
                            </span>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <div>
                                <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Price</p>
                                <p className="mt-1 font-bold text-gray-900 dark:text-white">{formatKobo(product.price)}</p>
                            </div>
                            <div>
                                <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Stock</p>
                                <p className="mt-1 text-sm font-medium text-gray-500">{product.stock_level ?? 0}</p>
                            </div>
                            <div>
                                <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Date</p>
                                <p className="mt-1 text-sm font-medium text-gray-500">
                                    {new Date(product.created_at).toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                    })}
                                </p>
                            </div>
                        </div>
                        <div className="mt-4 flex items-center justify-end gap-2 text-gray-300">
                            <Link href={`/merchant/products/edit/${product.id}`}>
                                <button className="rounded-lg p-2 transition-colors hover:bg-gray-50 hover:text-[#F58220] dark:hover:bg-zinc-800">
                                    <Edit className="h-4 w-4" />
                                </button>
                            </Link>
                            <Link href={`/merchant/products/${product.id}`}>
                                <button className="rounded-lg p-2 transition-colors hover:bg-gray-50 hover:text-[#F58220] dark:hover:bg-zinc-800">
                                    <Eye className="h-4 w-4" />
                                </button>
                            </Link>
                            <button
                                onClick={() => handleDelete(product.id)}
                                className="rounded-lg p-2 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 dark:bg-zinc-800/50">
                        <tr>
                            <th className="px-8 py-5 text-sm font-bold text-gray-400 uppercase tracking-wider">Products</th>
                            <th className="px-8 py-5 text-sm font-bold text-gray-400 uppercase tracking-wider">Categories</th>
                            <th className="px-8 py-5 text-sm font-bold text-gray-400 uppercase tracking-wider">Price</th>
                            <th className="px-8 py-5 text-sm font-bold text-gray-400 uppercase tracking-wider">Stock</th>
                            <th className="px-8 py-5 text-sm font-bold text-gray-400 uppercase tracking-wider">Status</th>
                            <th className="px-8 py-5 text-sm font-bold text-gray-400 uppercase tracking-wider">Date</th>
                            <th className="px-8 py-5 text-sm font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                        {products.map((product) => (
                            <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                                <td className="px-8 py-6">
                                    <div className="flex items-center gap-4">
                                        <div className="h-12 w-12 bg-gray-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center overflow-hidden shrink-0">
                                            {product.images?.[0] ? (
                                                <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover" />
                                            ) : (
                                                <Package className="h-6 w-6 text-gray-400" />
                                            )}
                                        </div>
                                        <span className="font-bold text-gray-900 dark:text-white truncate max-w-[200px]">{product.name}</span>
                                    </div>
                                </td>
                                <td className="px-8 py-6 text-gray-500 font-medium capitalize">{product.category.replace("_", " ")}</td>
                                <td className="px-8 py-6 font-bold text-gray-900 dark:text-white">{formatKobo(product.price)}</td>
                                <td className="px-8 py-6 text-gray-500 font-medium">{product.stock_level ?? 0}</td>
                                <td className="px-8 py-6">
                                    <span
                                        className={cn(
                                            "px-4 py-1.5 rounded-lg text-[11px] font-bold capitalize",
                                            product.status === "approved"
                                                ? "bg-green-50 text-[#12B76A]"
                                                : product.status === "pending"
                                                    ? "bg-orange-50 text-[#F58220]"
                                                    : "bg-red-50 text-[#F04438]"
                                        )}
                                    >
                                        {product.status}
                                    </span>
                                </td>
                                <td className="px-8 py-6 text-gray-500 text-sm font-medium">
                                    {new Date(product.created_at).toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                    })}
                                </td>
                                <td className="px-8 py-6 text-right">
                                    <div className="flex items-center justify-end gap-2 text-gray-300">
                                        <Link href={`/merchant/products/edit/${product.id}`}>
                                            <button className="p-2 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded-lg transition-colors hover:text-[#F58220]">
                                                <Edit className="h-4 w-4" />
                                            </button>
                                        </Link>
                                        <Link href={`/merchant/products/${product.id}`}>
                                            <button className="p-2 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded-lg transition-colors hover:text-[#F58220]">
                                                <Eye className="h-4 w-4" />
                                            </button>
                                        </Link>
                                        <button
                                            onClick={() => handleDelete(product.id)}
                                            className="p-2 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors hover:text-red-500"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
