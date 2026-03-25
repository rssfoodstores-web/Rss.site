"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

// Hardcoded Categories for demo
const categories = [
    { name: "Grains", image: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?q=80&w=400&auto=format&fit=crop", count: 20 },
    { name: "Frozen Food", image: "https://images.unsplash.com/photo-1627483262769-04d0a1401487?q=80&w=400&auto=format&fit=crop", count: 12 },
    { name: "Vegetables", image: "https://images.unsplash.com/photo-1597362925123-77861d3fbac7?q=80&w=400&auto=format&fit=crop", count: 45 },
    { name: "Soft drinks", image: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?q=80&w=400&auto=format&fit=crop", count: 10 },
    { name: "Dairy Products", image: "https://images.unsplash.com/photo-1628088062854-d1870b4553da?q=80&w=400&auto=format&fit=crop", count: 18 },
    { name: "Seafood", image: "https://images.unsplash.com/photo-1534939561126-855b8675edd7?q=80&w=400&auto=format&fit=crop", count: 8 },
]

export function CategoryGrid() {
    return (
        <section className="container mx-auto px-4 md:px-8 py-4 md:py-12">
            <div className="flex items-center justify-between mb-4 md:mb-8">
                <h2 className="text-lg md:text-3xl font-bold text-gray-900 dark:text-white">Shop with Categories</h2>
            </div>

            <div className="flex overflow-x-auto snap-x py-2 md:py-4 gap-3 md:grid md:grid-cols-3 lg:grid-cols-6 md:gap-6 no-scrollbar">
                {categories.map((cat, idx) => (
                    <Link key={idx} href={`/category/${cat.name.toLowerCase().replace(' ', '-')}`} className="group min-w-[110px] md:min-w-0 snap-start">
                        <div className="bg-white dark:bg-card rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all border border-transparent hover:border-primary/20 h-full">
                            <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
                                <Image
                                    src={cat.image}
                                    alt={cat.name}
                                    width={400}
                                    height={300}
                                    className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-500"
                                />
                            </div>
                            <div className="p-2 md:p-4 text-center">
                                <h3 className="font-bold text-xs md:text-base group-hover:text-primary transition-colors">{cat.name}</h3>
                                <span className="text-xs text-muted-foreground hidden">{cat.count} items</span>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </section>
    )
}
