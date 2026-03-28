"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { ArrowUpRight } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AdPlacement, LiveAdCampaign } from "@/lib/adCampaigns"

interface AdPlacementSectionClientProps {
    campaigns: LiveAdCampaign[]
    placement: AdPlacement
    title?: string
    description?: string
}

function AdImpressionTracker({
    adId,
    placement,
}: {
    adId: string
    placement: AdPlacement
}) {
    const pathname = usePathname()
    const ref = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        const element = ref.current
        if (!element) {
            return
        }

        const storageKey = `ad-impression:${pathname}:${placement}:${adId}`
        if (window.sessionStorage.getItem(storageKey)) {
            return
        }

        const observer = new IntersectionObserver(
            (entries) => {
                const isVisible = entries.some((entry) => entry.isIntersecting)
                if (!isVisible) {
                    return
                }

                window.sessionStorage.setItem(storageKey, "1")
                const payload = JSON.stringify({ adId, placement, path: pathname })

                if (navigator.sendBeacon) {
                    navigator.sendBeacon("/api/ads/impression", payload)
                } else {
                    void fetch("/api/ads/impression", {
                        method: "POST",
                        body: payload,
                        headers: {
                            "Content-Type": "application/json",
                        },
                        keepalive: true,
                    })
                }

                observer.disconnect()
            },
            {
                threshold: 0.55,
            }
        )

        observer.observe(element)

        return () => {
            observer.disconnect()
        }
    }, [adId, pathname, placement])

    return <div ref={ref} className="absolute inset-0 pointer-events-none" aria-hidden="true" />
}

export function AdPlacementSectionClient({
    campaigns,
    placement,
    title,
    description,
}: AdPlacementSectionClientProps) {
    const pathname = usePathname()

    return (
        <section className="py-2">
            <div className="container mx-auto px-4 md:px-8">
                <div className="rounded-[2rem] border border-orange-100 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:p-6">
                    {title || description ? (
                        <div className="mb-5 flex flex-col gap-2">
                            {title ? (
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h2>
                            ) : null}
                            {description ? (
                                <p className="max-w-3xl text-sm text-gray-500 dark:text-gray-400">{description}</p>
                            ) : null}
                        </div>
                    ) : null}

                    <div className={cn(
                        "grid gap-4",
                        campaigns.length === 1
                            ? "grid-cols-1"
                            : campaigns.length === 2
                                ? "grid-cols-1 lg:grid-cols-2"
                                : "grid-cols-1 lg:grid-cols-3"
                    )}>
                        {campaigns.map((campaign) => (
                            <Link
                                key={campaign.id}
                                href={`/ads/redirect/${campaign.id}?from=${encodeURIComponent(pathname)}&placement=${placement}`}
                                prefetch={false}
                                className="group relative overflow-hidden rounded-[1.75rem] border border-gray-100 bg-[#FFFDFC] transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950/70"
                            >
                                <AdImpressionTracker adId={campaign.id} placement={placement} />

                                <div className="relative aspect-[16/9] bg-gray-100 dark:bg-zinc-900">
                                    {campaign.mediaType === "video" ? (
                                        <video
                                            src={campaign.mediaUrl}
                                            className="h-full w-full object-cover"
                                            muted
                                            playsInline
                                            autoPlay
                                            loop
                                        />
                                    ) : (
                                        <Image
                                            src={campaign.mediaUrl}
                                            alt={campaign.title}
                                            fill
                                            sizes="(min-width: 1024px) 33vw, 100vw"
                                            className="object-cover transition duration-300 group-hover:scale-[1.02]"
                                        />
                                    )}

                                    <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#F58220]">
                                        Sponsored
                                    </div>
                                </div>

                                <div className="space-y-4 p-5">
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                            {campaign.title}
                                        </h3>
                                        <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
                                            {campaign.body ?? "Open this campaign to learn more."}
                                        </p>
                                    </div>

                                    <div className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-4 py-2 text-sm font-bold text-[#C25F14] dark:bg-orange-950/20 dark:text-orange-200">
                                        <span>{campaign.ctaLabel}</span>
                                        <ArrowUpRight className="h-4 w-4" />
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    )
}
