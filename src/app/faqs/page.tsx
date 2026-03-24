"use client"

import { useState } from "react"
import Link from "next/link"
import { Home, Plus, Minus } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

const faqs = [
    {
        question: "How long does delivery take?",
        answer: "Delivery typically takes 1-3 business days within major cities and 3-5 business days for other locations. We strive to process all orders within 24 hours of confirmation."
    },
    {
        question: "What payment methods do you accept?",
        answer: "We accept all major debit/credit cards (Visa, Mastercard, Verve), bank transfers, and secure online payments via our payment partners."
    },
    {
        question: "Can I return a product if I'm not satisfied?",
        answer: "Yes, we have a return policy for damaged or incorrect items. Please inspect your goods upon delivery. If you find any issues, contact our support team immediately within 24 hours of receipt."
    },
    {
        question: "Do you offer bulk or wholesale pricing?",
        answer: "Absolutely! We specialize in both retail and wholesale. You can visit our 'RSS Wholesales' section for bulk pricing or contact our sales team for large corporate orders."
    },
    {
        question: "How can I track my order?",
        answer: "Once your order is dispatched, you will receive a tracking number via email or SMS. You can also track your order status in real-time from your account dashboard."
    }
]

export default function FaqsPage() {
    const [openIndex, setOpenIndex] = useState<number | null>(0)

    return (
        <div className="min-h-screen bg-white dark:bg-black font-sans">
            {/* Breadcrumb */}
            <div className="container mx-auto px-4 md:px-8 py-6">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Link href="/" className="hover:text-[#F58220] transition-colors">
                        <Home className="h-4 w-4" />
                    </Link>
                    <span>{">"}</span>
                    <span className="text-[#F58220]">FAQs</span>
                </div>
            </div>

            <div className="container mx-auto px-4 md:px-8 py-8 pb-20 max-w-4xl">
                <h1 className="text-[40px] font-bold text-center text-[#1A1A1A] dark:text-white mb-12">
                    FAQs
                </h1>

                <div className="space-y-4">
                    {faqs.map((faq, index) => (
                        <div
                            key={index}
                            className="border border-gray-100 dark:border-zinc-800 rounded-lg overflow-hidden bg-white dark:bg-zinc-900 shadow-sm"
                        >
                            <button
                                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                                className="w-full flex items-center justify-between p-6 text-left transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800/50"
                            >
                                <span className={cn(
                                    "text-lg font-medium transition-colors",
                                    openIndex === index ? "text-[#F58220]" : "text-[#1A1A1A] dark:text-white"
                                )}>
                                    {faq.question}
                                </span>
                                <div className={cn(
                                    "h-8 w-8 rounded-full flex items-center justify-center transition-colors",
                                    openIndex === index ? "bg-[#F58220]/10 text-[#F58220]" : "bg-gray-100 dark:bg-zinc-800 text-gray-500"
                                )}>
                                    {openIndex === index ? (
                                        <Minus className="h-4 w-4" />
                                    ) : (
                                        <Plus className="h-4 w-4" />
                                    )}
                                </div>
                            </button>

                            <AnimatePresence>
                                {openIndex === index && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2, ease: "easeInOut" }}
                                    >
                                        <div className="px-6 pb-6 text-gray-500 dark:text-gray-400 leading-relaxed">
                                            {faq.answer}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
