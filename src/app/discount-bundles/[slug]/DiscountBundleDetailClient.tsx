"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { Minus, Plus, ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCart } from "@/context/CartContext"
import { formatKobo } from "@/lib/money"
import type { PublicDiscountBundle } from "../data"

function renderMedia(type: "image" | "video", url: string, alt: string) {
    if (type === "video") {
        return <video src={url} controls className="h-full w-full object-cover" />
    }

    return <Image src={url} alt={alt} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 45vw" />
}

export function DiscountBundleDetailClient({
    bundle,
    relatedBundles,
}: {
    bundle: PublicDiscountBundle
    relatedBundles: PublicDiscountBundle[]
}) {
    const { addToCart } = useCart()
    const [quantity, setQuantity] = React.useState(1)

    return (
        <div className="container mx-auto space-y-10 px-4 py-8 md:px-8">
            <div className="grid gap-8 lg:grid-cols-[1fr_0.95fr]">
                <div className="relative min-h-[420px] overflow-hidden rounded-[2rem] border border-gray-100 bg-gray-100 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    {renderMedia(bundle.cardMediaType, bundle.cardMediaUrl, bundle.title)}
                </div>

                <div className="space-y-6">
                    {bundle.badgeText ? <p className="text-sm font-bold uppercase tracking-[0.24em] text-[#F58220]">{bundle.badgeText}</p> : null}
                    <div>
                        <h1 className="text-4xl font-black text-gray-900 dark:text-white">{bundle.title}</h1>
                        <p className="mt-4 text-base leading-7 text-gray-600 dark:text-zinc-300">{bundle.description ?? bundle.summary ?? "Bundle essentials at one campaign price."}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <span className="text-4xl font-black text-[#F58220]">{formatKobo(bundle.bundlePriceKobo)}</span>
                        {bundle.compareAtPriceKobo > bundle.bundlePriceKobo ? (
                            <>
                                <span className="text-lg text-gray-400 line-through">{formatKobo(bundle.compareAtPriceKobo)}</span>
                                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">
                                    Save {bundle.savingsPercent}%
                                </span>
                            </>
                        ) : null}
                    </div>

                    <div className="flex items-center gap-3">
                        <Button type="button" variant="outline" size="icon" className="rounded-full" onClick={() => setQuantity((current) => Math.max(1, current - 1))}>
                            <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-10 text-center text-lg font-bold text-gray-900 dark:text-white">{quantity}</span>
                        <Button type="button" variant="outline" size="icon" className="rounded-full" onClick={() => setQuantity((current) => Math.min(bundle.currentStock || current + 1, current + 1))}>
                            <Plus className="h-4 w-4" />
                        </Button>
                        <span className="text-sm text-gray-500 dark:text-zinc-400">Available stock: {bundle.currentStock}</span>
                    </div>

                    <Button className="rounded-full bg-[#F58220] px-8 hover:bg-[#d86a12]" onClick={() => addToCart({
                        id: bundle.productId,
                        image: bundle.cardMediaUrl,
                        merchantId: bundle.merchantId,
                        name: bundle.title,
                        price: bundle.bundlePriceKobo,
                        quantity,
                        stock_level: bundle.currentStock,
                    })} disabled={bundle.currentStock < 1}>
                        <ShoppingCart className="mr-2 h-5 w-5" />
                        {bundle.currentStock > 0 ? "Add bundle to cart" : "Sold out"}
                    </Button>

                    <div className="rounded-[1.75rem] border border-gray-100 bg-gray-50/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/40">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Included products</h2>
                        <div className="mt-4 space-y-3">
                            {bundle.items.map((item) => (
                                <div key={item.productId} className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="relative h-14 w-14 overflow-hidden rounded-2xl bg-gray-100 dark:bg-zinc-800">
                                            {item.productImageUrl ? <Image src={item.productImageUrl} alt={item.productName} fill className="object-cover" sizes="56px" /> : null}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-gray-900 dark:text-white">{item.productName}</p>
                                            <p className="text-sm text-gray-500 dark:text-zinc-400">{formatKobo(item.productPriceKobo)}</p>
                                        </div>
                                    </div>
                                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-gray-400">x{item.quantity}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {relatedBundles.length > 0 ? (
                <section className="space-y-5">
                    <div className="flex items-center justify-between gap-4">
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white">Related bundles</h2>
                        <Link href="/discount-bundles" className="text-sm font-bold uppercase tracking-[0.18em] text-[#F58220]">
                            View all
                        </Link>
                    </div>
                    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                        {relatedBundles.map((relatedBundle) => (
                            <Link key={relatedBundle.id} href={`/discount-bundles/${relatedBundle.slug}`} className="overflow-hidden rounded-[1.75rem] border border-gray-100 bg-white shadow-sm transition hover:-translate-y-1 dark:border-zinc-800 dark:bg-zinc-900">
                                <div className="relative aspect-[4/3] overflow-hidden bg-gray-100 dark:bg-zinc-800">
                                    {relatedBundle.cardMediaType === "video" ? (
                                        <video src={relatedBundle.cardMediaUrl} muted loop playsInline className="h-full w-full object-cover" />
                                    ) : (
                                        <Image src={relatedBundle.cardMediaUrl} alt={relatedBundle.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 25vw" />
                                    )}
                                </div>
                                <div className="p-4">
                                    <p className="font-semibold text-gray-900 dark:text-white">{relatedBundle.title}</p>
                                    <p className="mt-2 text-sm font-bold text-[#F58220]">{formatKobo(relatedBundle.bundlePriceKobo)}</p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>
            ) : null}
        </div>
    )
}
