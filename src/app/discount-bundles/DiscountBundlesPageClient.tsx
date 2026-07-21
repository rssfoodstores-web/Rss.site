"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Box, Check, Layers3, PackageCheck, ShoppingCart, Tag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCart } from "@/context/CartContext"
import { formatKobo } from "@/lib/money"
import type { PublicDiscountBundle, PublicDiscountBundlePageContent } from "./data"

function renderMedia(type: "image" | "video", url: string | null, alt: string) {
    if (!url) {
        return <div className="h-full w-full bg-gray-100 dark:bg-zinc-800" />
    }

    if (type === "video") {
        return <video src={url} autoPlay muted loop playsInline className="h-full w-full object-cover" />
    }

    return <Image src={url} alt={alt} fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" />
}

function getStockLabel(stock: number) {
    if (stock < 1) {
        return "Sold out"
    }

    if (stock <= 5) {
        return `${stock} left`
    }

    return "In stock"
}

function BundleCard({ bundle }: { bundle: PublicDiscountBundle }) {
    const { addToCart } = useCart()
    const previewItems = bundle.items.slice(0, 4)

    return (
        <article className="group flex h-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
            <div className="relative aspect-[5/4] overflow-hidden bg-gray-100 dark:bg-zinc-800">
                {renderMedia(bundle.cardMediaType, bundle.cardMediaUrl, bundle.title)}
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-4 text-white">
                    <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/75">Bundle deal</p>
                        <p className="mt-1 truncate text-lg font-black">{formatKobo(bundle.bundlePriceKobo)}</p>
                    </div>
                    {bundle.compareAtPriceKobo > bundle.bundlePriceKobo ? (
                        <span className="shrink-0 rounded-md bg-emerald-500 px-2.5 py-1 text-xs font-black text-white">
                            Save {bundle.savingsPercent}%
                        </span>
                    ) : null}
                </div>
                {bundle.badgeText ? (
                    <div className="absolute left-3 top-3 rounded-md bg-[#F58220] px-2.5 py-1 text-xs font-bold uppercase tracking-[0.12em] text-white">
                        {bundle.badgeText}
                    </div>
                ) : null}
            </div>

            <div className="flex flex-1 flex-col p-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h2 className="line-clamp-2 text-lg font-black leading-tight text-gray-950 dark:text-white">{bundle.title}</h2>
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-gray-600 dark:text-zinc-300">
                            {bundle.summary ?? bundle.description ?? "Curated essentials bundled for recurring shopping."}
                        </p>
                    </div>
                    <span className="shrink-0 rounded-md border border-gray-200 px-2 py-1 text-xs font-bold text-gray-600 dark:border-zinc-700 dark:text-zinc-300">
                        {getStockLabel(bundle.currentStock)}
                    </span>
                </div>

                <div className="mt-4 flex flex-wrap items-end gap-2 border-y border-gray-100 py-3 text-sm dark:border-zinc-800">
                    <span className="text-2xl font-black text-[#F58220]">{formatKobo(bundle.bundlePriceKobo)}</span>
                    {bundle.compareAtPriceKobo > bundle.bundlePriceKobo ? (
                        <span className="pb-1 text-sm text-gray-400 line-through">{formatKobo(bundle.compareAtPriceKobo)}</span>
                    ) : null}
                </div>

                <div className="mt-4 flex-1 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-gray-400">
                        <Layers3 className="h-3.5 w-3.5" />
                        Includes
                    </div>
                    <div className="space-y-2">
                        {previewItems.map((item) => (
                            <div key={item.productId} className="grid grid-cols-[1fr_auto] items-center gap-3 text-sm">
                                <span className="truncate text-gray-700 dark:text-zinc-200">{item.productName}</span>
                                <span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-black text-gray-500 dark:bg-zinc-800 dark:text-zinc-300">x{item.quantity}</span>
                            </div>
                        ))}
                    </div>
                    {bundle.items.length > previewItems.length ? (
                        <p className="text-xs font-semibold text-gray-500 dark:text-zinc-400">+ {bundle.items.length - previewItems.length} more items inside</p>
                    ) : null}
                </div>

                <div className="mt-5 grid grid-cols-[1fr_auto] gap-2">
                    <Button
                        className="h-11 rounded-md bg-[#F58220] font-bold text-white hover:bg-[#d86a12]"
                        onClick={() => addToCart({
                            id: bundle.productId,
                            image: bundle.cardMediaUrl,
                            merchantId: bundle.merchantId,
                            name: bundle.title,
                            price: bundle.bundlePriceKobo,
                            quantity: 1,
                            stock_level: bundle.currentStock,
                        })}
                        disabled={bundle.currentStock < 1}
                    >
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        {bundle.currentStock > 0 ? "Add" : "Sold out"}
                    </Button>
                    <Button asChild variant="outline" className="h-11 rounded-md px-3">
                        <Link href={`/discount-bundles/${bundle.slug}`} aria-label={`View ${bundle.title}`}>
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </Button>
                </div>
            </div>
        </article>
    )
}

function FeaturedBundle({ bundle }: { bundle: PublicDiscountBundle }) {
    const { addToCart } = useCart()
    const previewItems = bundle.items.slice(0, 5)

    return (
        <article className="grid overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="relative min-h-[280px] bg-gray-100 dark:bg-zinc-800">
                {renderMedia(bundle.cardMediaType, bundle.cardMediaUrl, bundle.title)}
                {bundle.badgeText ? (
                    <span className="absolute left-4 top-4 rounded-md bg-[#F58220] px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-white">
                        {bundle.badgeText}
                    </span>
                ) : null}
            </div>
            <div className="flex flex-col justify-between gap-6 p-5 md:p-7">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-violet-950 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-white">
                            <Tag className="h-3.5 w-3.5" />
                            Featured bundle
                        </span>
                        <span className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-600 dark:border-zinc-700 dark:text-zinc-300">
                            {getStockLabel(bundle.currentStock)}
                        </span>
                    </div>
                    <h2 className="mt-4 text-3xl font-black leading-tight text-gray-950 dark:text-white">{bundle.title}</h2>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600 dark:text-zinc-300">
                        {bundle.description ?? bundle.summary ?? "A ready-to-shop bundle curated from approved store items."}
                    </p>
                    <div className="mt-5 flex flex-wrap items-end gap-3">
                        <span className="text-3xl font-black text-[#F58220]">{formatKobo(bundle.bundlePriceKobo)}</span>
                        {bundle.compareAtPriceKobo > bundle.bundlePriceKobo ? (
                            <>
                                <span className="pb-1 text-base text-gray-400 line-through">{formatKobo(bundle.compareAtPriceKobo)}</span>
                                <span className="mb-1 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-black uppercase tracking-[0.14em] text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                                    Save {bundle.savingsPercent}%
                                </span>
                            </>
                        ) : null}
                    </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                    {previewItems.map((item) => (
                        <div key={item.productId} className="flex items-center justify-between gap-3 rounded-md bg-gray-50 px-3 py-2 text-sm dark:bg-zinc-950/60">
                            <span className="truncate text-gray-700 dark:text-zinc-200">{item.productName}</span>
                            <span className="text-xs font-black uppercase tracking-[0.12em] text-gray-400">x{item.quantity}</span>
                        </div>
                    ))}
                    {bundle.items.length > previewItems.length ? (
                        <div className="flex items-center rounded-md bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-500 dark:bg-zinc-950/60 dark:text-zinc-400">
                            + {bundle.items.length - previewItems.length} more items
                        </div>
                    ) : null}
                </div>

                <div className="flex flex-wrap gap-3">
                    <Button className="h-11 rounded-md bg-[#F58220] px-5 font-bold text-white hover:bg-[#d86a12]" onClick={() => addToCart({
                        id: bundle.productId,
                        image: bundle.cardMediaUrl,
                        merchantId: bundle.merchantId,
                        name: bundle.title,
                        price: bundle.bundlePriceKobo,
                        quantity: 1,
                        stock_level: bundle.currentStock,
                    })} disabled={bundle.currentStock < 1}>
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        {bundle.currentStock > 0 ? "Add to cart" : "Sold out"}
                    </Button>
                    <Button asChild variant="outline" className="h-11 rounded-md px-5 font-bold">
                        <Link href={`/discount-bundles/${bundle.slug}`}>
                            View details
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                </div>
            </div>
        </article>
    )
}

export function DiscountBundlesPageClient({
    bundles,
    pageContent,
}: {
    bundles: PublicDiscountBundle[]
    pageContent: PublicDiscountBundlePageContent
}) {
    const featuredBundle = bundles[0]
    const remainingBundles = featuredBundle ? bundles.slice(1) : bundles

    return (
        <div className="space-y-8 pb-12">
            <section className="bg-white dark:bg-zinc-950">
                <div className="container mx-auto grid gap-6 px-4 py-8 md:px-8 lg:grid-cols-[1fr_auto] lg:items-end">
                    <div className="max-w-3xl">
                        <p className="text-xs font-black uppercase tracking-[0.24em] text-[#F58220]">{pageContent.eyebrowText}</p>
                        <h1 className="mt-3 text-4xl font-black leading-tight text-gray-950 dark:text-white md:text-5xl">
                            {pageContent.title}
                            {pageContent.highlightText ? <span className="block text-[#F58220]">{pageContent.highlightText}</span> : null}
                        </h1>
                        {pageContent.description ? <p className="mt-4 max-w-2xl text-base leading-7 text-gray-600 dark:text-zinc-300">{pageContent.description}</p> : null}
                    </div>
                    <div className="grid grid-cols-3 gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-zinc-800 dark:bg-zinc-900">
                        <div className="rounded-md bg-white px-4 py-3 text-center dark:bg-zinc-950">
                            <p className="text-2xl font-black text-gray-950 dark:text-white">{bundles.length}</p>
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400">Live</p>
                        </div>
                        <div className="rounded-md bg-white px-4 py-3 text-center dark:bg-zinc-950">
                            <p className="text-2xl font-black text-gray-950 dark:text-white">{bundles.reduce((sum, bundle) => sum + Math.max(bundle.currentStock, 0), 0)}</p>
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400">Stock</p>
                        </div>
                        <div className="rounded-md bg-white px-4 py-3 text-center dark:bg-zinc-950">
                            <p className="text-2xl font-black text-[#F58220]">{Math.max(...bundles.map((bundle) => bundle.savingsPercent), 0)}%</p>
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400">Top save</p>
                        </div>
                    </div>
                </div>
            </section>

            {pageContent.featurePoints.length > 0 ? (
                <section className="container mx-auto grid gap-3 px-4 md:grid-cols-3 md:px-8">
                    {pageContent.featurePoints.map((point) => (
                        <div key={point.title} className="flex gap-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#F58220]" />
                            <div>
                                <p className="text-sm font-black text-gray-950 dark:text-white">{point.title}</p>
                                <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-zinc-300">{point.body}</p>
                            </div>
                        </div>
                    ))}
                </section>
            ) : null}

            <section className="container mx-auto space-y-5 px-4 md:px-8">
                <div className="flex flex-col gap-3 border-b border-gray-200 pb-4 dark:border-zinc-800 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-gray-950 dark:text-white">{pageContent.secondaryHeading}</h2>
                        {pageContent.secondaryDescription ? <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500 dark:text-zinc-400">{pageContent.secondaryDescription}</p> : null}
                    </div>
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-gray-400">
                        <PackageCheck className="h-4 w-4" />
                        Ready-made savings
                    </div>
                </div>

                {bundles.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
                        <Box className="mx-auto h-8 w-8 text-gray-300" />
                        <p className="mt-3 text-sm font-semibold text-gray-500 dark:text-zinc-400">No active bundles are available right now.</p>
                    </div>
                ) : (
                    <div className="space-y-5">
                        {featuredBundle ? <FeaturedBundle bundle={featuredBundle} /> : null}
                        {remainingBundles.length > 0 ? (
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                {remainingBundles.map((bundle) => (
                            <BundleCard key={bundle.id} bundle={bundle} />
                        ))}
                            </div>
                        ) : null}
                    </div>
                )}
            </section>

            <section className="container mx-auto px-4 md:px-8">
                <div className="flex flex-col gap-4 rounded-lg border border-violet-950 bg-violet-950 px-5 py-6 text-white md:flex-row md:items-center md:justify-between md:px-7">
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-200">Savings</p>
                        <h2 className="mt-2 text-2xl font-black">{pageContent.closingTitle}</h2>
                        {pageContent.closingBody ? <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">{pageContent.closingBody}</p> : null}
                    </div>
                    <Button asChild className="h-11 rounded-md bg-[#F58220] px-5 font-bold text-white hover:bg-[#d86a12]">
                        <Link href={pageContent.closingCtaUrl}>
                            {pageContent.closingCtaText}
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                </div>
            </section>
        </div>
    )
}
