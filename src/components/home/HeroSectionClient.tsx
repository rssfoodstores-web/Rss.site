"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useCategory } from "@/context/CategoryContext"
import { categories } from "@/lib/categories"
import { useSearchParams } from "next/navigation"

export interface HeroSlide {
    bodyText: string | null
    buttonText: string | null
    buttonUrl: string | null
    eyebrowText: string | null
    highlightText: string | null
    id: string
    marketingMode: string
    mediaType: "image" | "video"
    mediaUrl: string
    title: string
}

function getCallToAction(slide: HeroSlide) {
    if (slide.marketingMode === "cook_off") {
        return {
            label: slide.buttonText?.trim() || "Cook-Off Page",
            url: "/cook-off",
        }
    }

    if (slide.marketingMode === "discount_bundles") {
        return {
            label: slide.buttonText?.trim() || "View Bundles",
            url: "/discount-bundles",
        }
    }

    return {
        label: slide.buttonText?.trim() || "Shop now",
        url: slide.buttonUrl?.trim() || "/retail",
    }
}

function renderBackgroundMedia(slide: HeroSlide) {
    if (slide.mediaType === "video") {
        return (
            <video
                autoPlay
                loop
                muted
                playsInline
                className="absolute inset-0 h-full w-full object-cover opacity-90"
                src={slide.mediaUrl}
            />
        )
    }

    return (
        <Image
            src={slide.mediaUrl}
            alt={slide.title}
            fill
            sizes="(max-width: 768px) 100vw, 70vw"
            className="object-cover opacity-90"
            priority
        />
    )
}

export function HeroSectionClient({ slides }: { slides: HeroSlide[] }) {
    const { isOpen } = useCategory()
    const searchParams = useSearchParams()
    const currentCategory = searchParams.get("category")
    const [currentSlide, setCurrentSlide] = React.useState(0)

    React.useEffect(() => {
        if (slides.length <= 1) {
            return
        }

        const timer = window.setInterval(() => {
            setCurrentSlide((previous) => (previous + 1) % slides.length)
        }, 7000)

        return () => window.clearInterval(timer)
    }, [slides.length])

    const activeSlide = slides[currentSlide] ?? slides[0]
    const cta = getCallToAction(activeSlide)

    return (
        <section className="container mx-auto px-4 py-6 md:px-8">
            <div className="flex flex-col gap-6 transition-all duration-300 ease-in-out md:flex-row">
                <div className={`${isOpen ? "w-64 translate-x-0 opacity-100" : "hidden w-0 -translate-x-full opacity-0"} hidden flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out md:block`}>
                    <Card className="h-full rounded-none border-none bg-white shadow-sm dark:bg-card">
                        <div className="flex h-[500px] flex-col overflow-y-auto pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gray-200 dark:scrollbar-thumb-zinc-700">
                            {categories.map((category, index) => {
                                const categoryParam = category.href.split("category=")[1]
                                const isActive = currentCategory === categoryParam || (!currentCategory && category.name === "Home Page")

                                return (
                                    <Link
                                        key={`${category.name}-${index}`}
                                        href={category.href}
                                        className={`flex flex-shrink-0 items-center gap-3 px-6 py-3 text-sm font-medium transition-colors hover:bg-orange-50 hover:text-primary dark:hover:bg-accent ${isActive ? "sticky top-0 z-10 bg-[#F58220] text-white hover:bg-[#F58220]/90 hover:text-white" : "text-[#555555] dark:text-gray-300"}`}
                                    >
                                        <category.icon className={`h-5 w-5 flex-shrink-0 ${isActive ? "text-white" : "text-[#888888]"}`} />
                                        <span className="truncate">{category.name}</span>
                                    </Link>
                                )
                            })}
                        </div>
                    </Card>
                </div>

                <div className="relative flex min-h-[430px] flex-1 items-center overflow-hidden rounded-[2rem] bg-[#0F392B] shadow-lg">
                    <div className="absolute inset-0 z-0 h-full w-full">
                        {renderBackgroundMedia(activeSlide)}
                        <div className="absolute inset-0 z-10 bg-gradient-to-r from-[#0F392B] via-[#0F392B]/84 to-[#0F392B]/20" />
                    </div>

                    <div className="relative z-20 max-w-xl px-8 md:px-16">
                        <motion.div
                            key={activeSlide.id}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.45 }}
                        >
                            <span className="mb-3 block text-sm font-bold uppercase tracking-[0.24em] text-primary">
                                {activeSlide.eyebrowText || "Fresh picks for today"}
                            </span>

                            <h1 className="text-4xl font-bold leading-tight text-white md:text-5xl">
                                {activeSlide.title}
                                {activeSlide.highlightText ? (
                                    <>
                                        <br />
                                        <span className="text-green-400">{activeSlide.highlightText}</span>
                                    </>
                                ) : null}
                            </h1>

                            {activeSlide.bodyText ? (
                                <p className="mt-5 max-w-lg text-base leading-7 text-white/85 md:text-lg">
                                    {activeSlide.bodyText}
                                </p>
                            ) : null}

                            <Button
                                size="lg"
                                className="mt-8 rounded-full bg-primary px-8 py-6 text-lg text-white group hover:bg-primary/90"
                                asChild
                            >
                                <a href={cta.url}>
                                    {cta.label}
                                    <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                                </a>
                            </Button>
                        </motion.div>

                        {slides.length > 1 ? (
                            <div className="mt-12 flex gap-2">
                                {slides.map((slide, index) => (
                                    <button
                                        key={slide.id}
                                        type="button"
                                        onClick={() => setCurrentSlide(index)}
                                        className={`h-3 rounded-full transition-all ${index === currentSlide ? "w-8 bg-white opacity-100" : "w-3 bg-white opacity-30"}`}
                                        aria-label={`Go to slide ${index + 1}`}
                                    />
                                ))}
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
        </section>
    )
}
