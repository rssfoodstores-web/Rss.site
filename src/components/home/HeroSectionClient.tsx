"use client"

import * as React from "react"
import Image from "next/image"
import { ArrowRight, Pause, Play } from "lucide-react"
import { motion, useReducedMotion } from "framer-motion"
import { Button } from "@/components/ui/button"

export interface HeroSlide {
    bodyText: string | null
    buttonText: string | null
    buttonUrl: string | null
    displayDurationSeconds: number
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

function renderBackgroundMedia(slide: HeroSlide, reduceMotion: boolean) {
    if (slide.mediaType === "video") {
        return (
            <video
                autoPlay={!reduceMotion}
                loop
                muted
                playsInline
                preload="metadata"
                aria-hidden="true"
                className="absolute inset-0 h-full w-full object-cover object-right"
                src={slide.mediaUrl}
            />
        )
    }

    return (
        <Image
            src={slide.mediaUrl}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 58vw"
            className="object-cover object-right"
            priority
        />
    )
}

export function HeroSectionClient({ slides }: { slides: HeroSlide[] }) {
    const reduceMotion = useReducedMotion() ?? false
    const [currentSlide, setCurrentSlide] = React.useState(0)
    const [isPaused, setIsPaused] = React.useState(false)
    const activeSlide = slides[currentSlide] ?? slides[0]

    React.useEffect(() => {
        if (currentSlide < slides.length) return
        setCurrentSlide(0)
    }, [currentSlide, slides.length])

    React.useEffect(() => {
        if (slides.length <= 1 || isPaused || reduceMotion) return

        const timer = window.setTimeout(() => {
            setCurrentSlide((previous) => (previous + 1) % slides.length)
        }, Math.max(activeSlide?.displayDurationSeconds ?? 7, 2) * 1000)

        return () => window.clearTimeout(timer)
    }, [activeSlide?.displayDurationSeconds, currentSlide, isPaused, reduceMotion, slides.length])

    if (!activeSlide) return null

    const cta = getCallToAction(activeSlide)

    return (
        <section className="mx-auto w-full md:container md:px-4 md:py-6 lg:px-8" aria-label="Featured offers">
            <div className="relative flex min-h-[420px] w-full flex-col overflow-hidden bg-[#0F392B] shadow-lg shadow-green-950/10 sm:rounded-[2rem] md:min-h-[450px] md:flex-row">
                <div className="relative h-[190px] w-full shrink-0 overflow-hidden bg-[#173F31] sm:h-[230px] md:h-auto md:min-h-[450px] md:w-[56%]">
                    {renderBackgroundMedia(activeSlide, reduceMotion)}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0F392B]/20 to-transparent md:bg-gradient-to-r md:from-transparent md:to-[#0F392B]/20" />
                </div>

                <div className="relative z-10 flex w-full flex-col justify-center bg-[#0F392B] px-5 py-6 sm:px-9 sm:py-8 md:min-h-[450px] md:w-[44%] md:px-8 md:py-10 lg:px-12">
                    <motion.div
                        key={activeSlide.id}
                        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: reduceMotion ? 0 : 0.35, ease: "easeOut" }}
                        className="flex flex-col items-start text-left"
                    >
                        <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-orange-200 backdrop-blur-sm sm:text-xs">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#F58220]" aria-hidden="true" />
                            {activeSlide.eyebrowText || "Fresh picks for today"}
                        </span>

                        <h1 className="line-clamp-4 max-w-2xl text-[1.9rem] font-bold leading-[1.05] tracking-tight text-white drop-shadow-md sm:text-4xl md:line-clamp-4 md:text-[2.35rem] lg:text-[2.5rem]">
                            {activeSlide.title}
                            {activeSlide.highlightText ? (
                                <>
                                    <span className="hidden md:inline"> </span>
                                    <span className="block text-orange-300 md:inline">{activeSlide.highlightText}</span>
                                </>
                            ) : null}
                        </h1>

                        {activeSlide.bodyText ? (
                            <p className="mt-3 line-clamp-2 max-w-xl text-sm leading-relaxed text-white/90 sm:text-base">
                                {activeSlide.bodyText}
                            </p>
                        ) : null}

                        <Button
                            size="lg"
                            className="group mt-5 min-h-12 w-full rounded-xl bg-[#F58220] px-6 text-base font-semibold text-white shadow-lg shadow-orange-950/20 transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#E57210] hover:shadow-xl sm:w-auto"
                            asChild
                        >
                            <a href={cta.url}>
                                {cta.label}
                                <ArrowRight className="ml-2 h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" />
                            </a>
                        </Button>
                    </motion.div>

                    {slides.length > 1 ? (
                        <div className="mt-4 flex min-h-11 items-center justify-between gap-4 sm:justify-start">
                            <div className="flex items-center gap-1" role="group" aria-label="Choose a featured offer">
                                {slides.map((slide, index) => (
                                    <button
                                        key={slide.id}
                                        type="button"
                                        onClick={() => {
                                            setCurrentSlide(index)
                                            setIsPaused(true)
                                        }}
                                        className="flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F392B]"
                                        aria-label={`Show featured offer ${index + 1}`}
                                        aria-pressed={index === currentSlide}
                                    >
                                        <span className={`h-1.5 rounded-full transition-all duration-300 ${index === currentSlide ? "w-7 bg-white" : "w-1.5 bg-white/50"}`} />
                                    </button>
                                ))}
                            </div>
                            {!reduceMotion ? (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsPaused((paused) => !paused)}
                                    className="min-h-11 rounded-full px-3 text-white hover:bg-white/10 hover:text-white"
                                    aria-label={isPaused ? "Play featured offers" : "Pause featured offers"}
                                >
                                    {isPaused ? <Play className="mr-2 h-4 w-4" /> : <Pause className="mr-2 h-4 w-4" />}
                                    {isPaused ? "Play" : "Pause"}
                                </Button>
                            ) : null}
                        </div>
                    ) : null}
                </div>
            </div>
        </section>
    )
}
