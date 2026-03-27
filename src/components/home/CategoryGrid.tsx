"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import {
    createStorefrontHref,
    getStorefrontCategoryLabel,
    storefrontNavigationCategories,
} from "@/lib/categories"

export function CategoryGrid() {
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const activeCategory = searchParams.get("category")

    return (
        <section className="container mx-auto px-4 py-8 md:px-8 md:py-12">
            <div className="mb-6 flex items-center justify-between md:mb-10">
                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#F58220]">Browse faster</p>
                    <h2 className="mt-3 text-2xl font-bold text-gray-900 dark:text-white md:text-[3rem] md:leading-none">
                        Shop by category
                    </h2>
                </div>
                <div className="hidden items-center gap-2 text-sm font-semibold text-gray-500 md:flex">
                    <span>{getStorefrontCategoryLabel(activeCategory)}</span>
                    <ArrowRight className="h-4 w-4" />
                </div>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar md:grid md:grid-cols-2 md:gap-6 lg:grid-cols-4">
                {storefrontNavigationCategories.map((category) => {
                    const isActive = category.slug === null ? !activeCategory : activeCategory === category.slug
                    const href = createStorefrontHref({
                        pathname,
                        searchParams,
                        patch: {
                            category: category.slug,
                        },
                        hash: "product-grid",
                    })
                    const Icon = category.icon

                    return (
                        <Link
                            key={category.label}
                            href={href}
                            className={cn(
                                "group min-w-[220px] rounded-[28px] border p-5 transition-all duration-200 md:min-w-0 md:min-h-[270px] md:p-7",
                                isActive
                                    ? "border-[#F58220] bg-orange-50 text-gray-900 shadow-sm shadow-orange-500/10 dark:border-orange-500/60 dark:bg-orange-950/20 dark:text-white"
                                    : "border-gray-200 bg-white text-gray-900 hover:border-orange-200 hover:bg-orange-50/70 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:hover:border-zinc-700 dark:hover:bg-zinc-900/80"
                            )}
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className={cn(
                                    "flex h-[72px] w-[72px] items-center justify-center rounded-[22px] transition-colors",
                                    isActive
                                        ? "bg-[#F58220] text-white"
                                        : "bg-gray-100 text-gray-700 group-hover:bg-[#F58220] group-hover:text-white dark:bg-zinc-800 dark:text-zinc-200"
                                )}>
                                    <Icon className="h-7 w-7" />
                                </div>
                                <ArrowRight className={cn(
                                    "mt-1 h-5 w-5 transition-transform group-hover:translate-x-1",
                                    isActive ? "text-[#F58220]" : "text-gray-400"
                                )} />
                            </div>
                            <h3 className="mt-7 text-xl font-bold leading-tight">{category.label}</h3>
                            <p className="mt-4 text-base leading-9 text-gray-500 dark:text-zinc-400">
                                {category.description}
                            </p>
                        </Link>
                    )
                })}
            </div>
        </section>
    )
}
