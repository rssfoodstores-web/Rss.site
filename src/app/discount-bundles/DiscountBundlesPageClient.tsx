"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowRight, ShoppingCart } from "lucide-react"
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

    return <Image src={url} alt={alt} fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" />
}

function BundleCard({ bundle }: { bundle: PublicDiscountBundle }) {
    const { addToCart } = useCart()

    return (
        <article className="overflow-hidden rounded-[2rem] border border-gray-100 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="relative aspect-[4/3] overflow-hidden bg-gray-100 dark:bg-zinc-800">
                {renderMedia(bundle.cardMediaType, bundle.cardMediaUrl, bundle.title)}
                {bundle.badgeText ? (
                    <div className="absolute left-4 top-4 rounded-full bg-[#F58220] px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-white">
                        {bundle.badgeText}
                    </div>
                ) : null}
            </div>

            <div className="space-y-4 p-5">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">{bundle.title}</h2>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{bundle.summary ?? bundle.description ?? "Curated essentials bundled for recurring shopping."}</p>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="text-xl font-extrabold text-[#F58220]">{formatKobo(bundle.bundlePriceKobo)}</span>
                    {bundle.compareAtPriceKobo > bundle.bundlePriceKobo ? (
                        <>
                            <span className="text-gray-400 line-through">{formatKobo(bundle.compareAtPriceKobo)}</span>
                            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">
                                Save {bundle.savingsPercent}%
                            </span>
                        </>
                    ) : null}
                </div>

                <div className="space-y-2 rounded-[1.5rem] border border-gray-100 bg-gray-50/80 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950/40">
                    {bundle.items.slice(0, 3).map((item) => (
                        <div key={item.productId} className="flex items-center justify-between gap-3">
                            <span className="text-gray-700 dark:text-zinc-200">{item.productName}</span>
                            <span className="text-xs font-bold uppercase tracking-[0.14em] text-gray-400">x{item.quantity}</span>
                        </div>
                    ))}
                    {bundle.items.length > 3 ? (
                        <p className="text-xs font-medium uppercase tracking-[0.14em] text-gray-400">+ {bundle.items.length - 3} more items</p>
                    ) : null}
                </div>

                <div className="flex flex-wrap gap-3">
                    <Button className="rounded-full bg-[#F58220] hover:bg-[#d86a12]" onClick={() => addToCart({
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
                    <Button asChild variant="outline" className="rounded-full">
                        <Link href={`/discount-bundles/${bundle.slug}`}>
                            {bundle.buttonText}
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
    return (
        <div className="space-y-10 pb-12">
            <section className="container mx-auto px-4 md:px-8">
                <div className="grid gap-6 overflow-hidden rounded-[2rem] border border-gray-100 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 lg:grid-cols-[1.05fr_0.95fr]">
                    <div className="px-6 py-10 md:px-10 md:py-14">
                        <p className="text-sm font-bold uppercase tracking-[0.24em] text-[#F58220]">{pageContent.eyebrowText}</p>
                        <h1 className="mt-4 text-4xl font-black leading-tight text-gray-900 dark:text-white md:text-5xl">
                            {pageContent.title}
                            {pageContent.highlightText ? <span className="block text-[#F58220]">{pageContent.highlightText}</span> : null}
                        </h1>
                        {pageContent.description ? <p className="mt-5 max-w-2xl text-base leading-7 text-gray-600 dark:text-zinc-300">{pageContent.description}</p> : null}
                        <div className="mt-8 flex flex-wrap gap-3">
                            <Button asChild className="rounded-full bg-[#F58220] px-7 hover:bg-[#d86a12]">
                                <Link href={pageContent.primaryCtaUrl}>
                                    {pageContent.primaryCtaText}
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Link>
                            </Button>
                        </div>
                    </div>
                    <div className="relative min-h-[320px] bg-gray-100 dark:bg-zinc-800">
                        {renderMedia(pageContent.heroMediaType, pageContent.heroMediaUrl, pageContent.title)}
                    </div>
                </div>
            </section>

            {pageContent.featurePoints.length > 0 ? (
                <section className="container mx-auto grid gap-4 px-4 md:grid-cols-3 md:px-8">
                    {pageContent.featurePoints.map((point) => (
                        <div key={point.title} className="rounded-[1.75rem] border border-gray-100 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#F58220]">{point.title}</p>
                            <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-zinc-300">{point.body}</p>
                        </div>
                    ))}
                </section>
            ) : null}

            <section className="container mx-auto space-y-6 px-4 md:px-8">
                <div>
                    <h2 className="text-3xl font-black text-gray-900 dark:text-white">{pageContent.secondaryHeading}</h2>
                    {pageContent.secondaryDescription ? <p className="mt-2 text-gray-500 dark:text-zinc-400">{pageContent.secondaryDescription}</p> : null}
                </div>

                {bundles.length === 0 ? (
                    <div className="rounded-[2rem] border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center text-sm text-gray-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                        No active bundles are available right now.
                    </div>
                ) : (
                    <div className="grid gap-6 lg:grid-cols-3">
                        {bundles.map((bundle) => (
                            <BundleCard key={bundle.id} bundle={bundle} />
                        ))}
                    </div>
                )}
            </section>

            <section className="container mx-auto px-4 md:px-8">
                <div className="rounded-[2rem] bg-gradient-to-r from-[#1b1b1b] via-[#2d2d2d] to-[#5b5b5b] px-6 py-12 text-white shadow-xl md:px-10">
                    <p className="text-sm font-bold uppercase tracking-[0.22em] text-orange-200">Savings</p>
                    <h2 className="mt-4 text-3xl font-black md:text-4xl">{pageContent.closingTitle}</h2>
                    {pageContent.closingBody ? <p className="mt-4 max-w-2xl text-white/80">{pageContent.closingBody}</p> : null}
                    <Button asChild className="mt-8 rounded-full bg-[#F58220] px-7 hover:bg-[#d86a12]">
                        <Link href={pageContent.closingCtaUrl}>{pageContent.closingCtaText}</Link>
                    </Button>
                </div>
            </section>
        </div>
    )
}
