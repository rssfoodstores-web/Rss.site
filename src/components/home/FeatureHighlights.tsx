"use client"

import { Truck, Headphones, ShoppingBag, Package } from "lucide-react"
import { useState } from "react"

const initialFeatures = [
    {
        icon: Truck,
        title: "Free Shipping",
        description: "Free shipping with discount",
    },
    {
        icon: Headphones,
        title: "Great Support 24/7",
        description: "Instant access to Contact",
    },
    {
        icon: ShoppingBag,
        title: "100% Secure Payment",
        description: "We ensure your money is save",
    },
    {
        icon: Package,
        title: "Money-Back Guarantee",
        description: "30 days money-back",
    }
]

export function FeatureHighlights() {
    // Start with index 2 (100% Secure Payment) as highlighted, like the image
    const [highlightedIndex, setHighlightedIndex] = useState<number | null>(2)

    return (
        <section className="container mx-auto px-4 md:px-8 py-8 md:py-12 border-b border-gray-100 dark:border-zinc-800">
            {/* 
              Mobile: Horizontal Scroll
              Desktop: Grid 
              Hide scrollbar rigorously with multiple browser support classes
            */}
            <div className="flex overflow-x-auto md:grid md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 pb-4 md:pb-0 scroll-smooth snap-x [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {initialFeatures.map((feature, idx) => {
                    const isHighlighted = highlightedIndex === idx
                    return (
                        <div
                            key={idx}
                            onClick={() => setHighlightedIndex(idx)}
                            className="flex items-center gap-4 min-w-[280px] md:min-w-0 snap-start cursor-pointer group select-none transition-all"
                        >
                            <div className={`
                                h-16 w-16 rounded-full flex items-center justify-center shrink-0 transition-all duration-300
                                ${isHighlighted
                                    ? 'bg-[#F58220] text-white shadow-lg shadow-orange-500/20'
                                    : 'bg-gray-100 dark:bg-zinc-800 text-[#F58220]'
                                }
                            `}>
                                <feature.icon className="h-7 w-7" strokeWidth={isHighlighted ? 2 : 1.5} />
                            </div>
                            <div>
                                <h3 className={`font-bold text-base leading-tight transition-colors ${isHighlighted ? 'text-[#F58220]' : 'text-[#1A1A1A] dark:text-white'}`}>
                                    {feature.title}
                                </h3>
                                <p className="text-xs text-gray-500 mt-1">
                                    {feature.description}
                                </p>
                            </div>
                        </div>
                    )
                })}
            </div>
        </section>
    )
}
