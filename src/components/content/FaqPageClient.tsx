"use client"

import { useState } from "react"
import Link from "next/link"
import { Home, Minus, Plus } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import { cn } from "@/lib/utils"
import type { FaqPageContent } from "@/lib/contentPages"

interface FaqPageClientProps {
    content: FaqPageContent
}

export function FaqPageClient({ content }: FaqPageClientProps) {
    const [openIndex, setOpenIndex] = useState<number | null>(0)

    return (
        <div className="min-h-screen bg-white font-sans dark:bg-black">
            <div className="container mx-auto px-4 py-6 md:px-8">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Link href="/" className="transition-colors hover:text-[#F58220]">
                        <Home className="h-4 w-4" />
                    </Link>
                    <span>{">"}</span>
                    <span className="text-[#F58220]">{content.pageTitle}</span>
                </div>
            </div>

            <div className="container mx-auto max-w-4xl px-4 py-8 pb-20 md:px-8">
                <div className="mb-12 text-center">
                    <h1 className="text-[40px] font-bold text-[#1A1A1A] dark:text-white">
                        {content.pageTitle}
                    </h1>
                    <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-gray-500 dark:text-gray-400">
                        {content.introDescription}
                    </p>
                </div>

                <div className="space-y-4">
                    {content.items.map((faq, index) => (
                        <div
                            key={faq.id}
                            className="overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                        >
                            <button
                                type="button"
                                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                                className="flex w-full items-center justify-between p-6 text-left transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800/50"
                            >
                                <span
                                    className={cn(
                                        "text-lg font-medium transition-colors",
                                        openIndex === index ? "text-[#F58220]" : "text-[#1A1A1A] dark:text-white"
                                    )}
                                >
                                    {faq.question}
                                </span>
                                <div
                                    className={cn(
                                        "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                                        openIndex === index
                                            ? "bg-[#F58220]/10 text-[#F58220]"
                                            : "bg-gray-100 text-gray-500 dark:bg-zinc-800"
                                    )}
                                >
                                    {openIndex === index ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                </div>
                            </button>

                            <AnimatePresence initial={false}>
                                {openIndex === index ? (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2, ease: "easeInOut" }}
                                    >
                                        <div className="px-6 pb-6 leading-relaxed text-gray-500 dark:text-gray-400">
                                            {faq.answer}
                                        </div>
                                    </motion.div>
                                ) : null}
                            </AnimatePresence>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
