
"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"

export interface Slide {
    id: number
    image: string
    quote: string
    author: string
    role: string
}

interface SlideshowProps {
    slides: Slide[]
}

export function Slideshow({ slides }: SlideshowProps) {
    const [currentSlide, setCurrentSlide] = useState(0)

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % slides.length)
        }, 5000)
        return () => clearInterval(timer)
    }, [])

    return (
        <div className="relative h-full w-full overflow-hidden bg-zinc-900 text-white">
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentSlide}
                    initial={{ opacity: 0, scale: 1.1 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    className="absolute inset-0"
                >
                    <Image
                        src={slides[currentSlide].image}
                        alt="Background"
                        fill
                        className="object-cover opacity-60"
                        priority
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                </motion.div>
            </AnimatePresence>

            <div className="absolute bottom-0 left-0 right-0 p-12 z-10">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentSlide}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                    >
                        <h2 className="text-3xl md:text-4xl font-bold leading-tight mb-6">
                            "{slides[currentSlide].quote}"
                        </h2>
                        <div>
                            <p className="text-xl font-semibold">{slides[currentSlide].author}</p>
                            <p className="text-white/60">{slides[currentSlide].role}</p>
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Pagination Dits */}
            <div className="absolute bottom-12 right-12 z-20 flex gap-2">
                {slides.map((_, index) => (
                    <div
                        key={index}
                        className={`h-2 rounded-full transition-all duration-300 ${index === currentSlide ? "w-8 bg-[#F58220]" : "w-2 bg-white/30"
                            }`}
                    />
                ))}
            </div>
        </div>
    )
}
