"use client"

import Link from "next/link"
import { Home, Check, Users, Leaf, Store, Headset } from "lucide-react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"

const stats = [
    { icon: Users, label: "Happy Customers", value: "Growing" },
    { icon: Leaf, label: "Quality Products", value: "Premium" },
    { icon: Store, label: "Delivery Hubs", value: "Regional" },
    { icon: Headset, label: "Customer Support", value: "Daily" },
]

export default function AboutPage() {
    return (
        <div className="min-h-screen bg-white dark:bg-black font-sans overflow-x-hidden">
            {/* Decorative Background Elements */}
            <div className="fixed top-0 right-0 -mr-40 -mt-40 w-[500px] h-[500px] bg-gradient-to-br from-[#F58220] to-[#FFD700] rounded-full blur-[120px] opacity-10 pointer-events-none" />
            <div className="fixed bottom-0 left-0 -ml-40 -mb-40 w-[500px] h-[500px] bg-gradient-to-tr from-[#9333EA] to-[#F58220] rounded-full blur-[120px] opacity-[0.07] pointer-events-none" />

            {/* Breadcrumb - Glassy look */}
            <div className="container mx-auto px-4 md:px-8 py-6 relative z-20">
                <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-2 text-sm text-gray-500 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm w-fit px-4 py-2 rounded-full border border-gray-100 dark:border-zinc-800"
                >
                    <Link href="/" className="hover:text-[#F58220] transition-colors flex items-center gap-1.5">
                        <Home className="h-3.5 w-3.5" />
                        <span>Home</span>
                    </Link>
                    <span className="text-gray-300">/</span>
                    <span className="text-[#F58220] font-medium">About Us</span>
                </motion.div>
            </div>

            <div className="container mx-auto px-4 md:px-8 pb-20 relative z-10">

                {/* Hero Section - Refined Design */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 mb-32 items-center">
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="space-y-10"
                    >
                        <div className="space-y-6">
                            <motion.span 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-[#F58220]/10 text-[#F58220] text-xs font-bold rounded-full uppercase tracking-[0.2em]"
                            >
                                <span className="h-1.5 w-1.5 rounded-full bg-[#F58220] animate-pulse" />
                                WHO WE ARE
                            </motion.span>
                            <h1 className="text-5xl md:text-6xl lg:text-7xl leading-[1.1] font-bold text-[#001903] dark:text-white tracking-tight">
                                Your trusted <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F58220] to-[#FF9D4D]">online food</span> marketplace.
                            </h1>
                            <p className="text-gray-500 dark:text-gray-400 text-lg md:text-xl leading-relaxed max-w-xl">
                                RSS FOODS is a premium marketplace committed to bringing fresh ingredients and everyday essentials straight to your doorstep with unmatched reliability.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
                            {[
                                "Reliable support team",
                                "Skilled local partners",
                                "Fast growing network",
                                "Selected food essentials"
                            ].map((item, i) => (
                                <motion.div 
                                    key={i} 
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.4 + i * 0.1 }}
                                    className="flex items-center gap-3 p-4 rounded-xl bg-gray-50/50 dark:bg-zinc-900/50 border border-gray-100 dark:border-zinc-800 hover:border-[#F58220]/30 transition-colors"
                                >
                                    <div className="h-8 w-8 rounded-full bg-[#F58220] flex items-center justify-center shrink-0 shadow-lg shadow-[#F58220]/20">
                                        <Check className="h-4 w-4 text-white" strokeWidth={3} />
                                    </div>
                                    <span className="text-[#191C1F] dark:text-gray-200 font-semibold text-sm">{item}</span>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>

                    {/* Hero Images - Enhanced Visuals */}
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="relative h-[450px] md:h-[600px] w-full"
                    >
                        {/* Abstract background shapes */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-gradient-to-r from-[#F58220]/5 to-transparent rounded-full blur-[100px]" />
                        
                        {/* Large Back Image */}
                        <div className="absolute top-0 right-0 w-[90%] h-[85%] rounded-[40px] bg-gray-100 overflow-hidden shadow-2xl border-4 border-white dark:border-zinc-800">
                            <div className="w-full h-full bg-cover bg-center transition-transform duration-1000 hover:scale-110" style={{
                                backgroundImage: "url('/images/about/hero-1.png')",
                            }} />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                        </div>
                        
                        {/* Small Front Image */}
                        <motion.div
                            initial={{ opacity: 0, y: 40 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5, duration: 0.8 }}
                            className="absolute bottom-[5%] left-0 w-[60%] h-[55%] rounded-[30px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] bg-gray-200 overflow-hidden border-[8px] border-white dark:border-black z-10"
                        >
                            <div className="w-full h-full bg-cover bg-center" style={{
                                backgroundImage: "url('/images/about/hero-2.png')",
                            }} />
                        </motion.div>

                        {/* Floating elements for depth */}
                        <motion.div 
                            animate={{ y: [0, -15, 0] }}
                            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                            className="absolute -top-6 -left-6 bg-white dark:bg-zinc-800 p-4 rounded-2xl shadow-xl z-20 border border-gray-100 dark:border-zinc-700 hidden md:block"
                        >
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 bg-green-500 rounded-lg flex items-center justify-center">
                                    <Leaf className="text-white h-6 w-6" />
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Quality</p>
                                    <p className="text-sm font-bold text-gray-900 dark:text-white">100% Organic</p>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                </div>

                {/* Impact / Stats Section - Carousel on Mobile */}
                <div className="mb-32">
                    {/* Desktop View (Grid) */}
                    <div className="hidden md:grid grid-cols-4 gap-8">
                        {stats.map((stat, i) => (
                            <motion.div 
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                                className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-10 border border-gray-100 dark:border-zinc-800 text-center hover:shadow-xl hover:shadow-[#F58220]/5 transition-all duration-300 group"
                            >
                                <div className="h-20 w-20 mx-auto bg-gray-50 dark:bg-zinc-800 rounded-3xl flex items-center justify-center mb-6 group-hover:bg-[#F58220]/10 group-hover:rotate-6 transition-all duration-300">
                                    <stat.icon className="h-10 w-10 text-[#F58220]" />
                                </div>
                                <h3 className="text-4xl font-black text-[#1A1A1A] dark:text-white mb-2">{stat.value}</h3>
                                <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">{stat.label}</p>
                            </motion.div>
                        ))}
                    </div>

                    {/* Mobile View (Carousel) */}
                    <div className="md:hidden overflow-x-auto hide-scrollbar snap-x snap-mandatory flex gap-4 px-2 pb-8">
                        {stats.map((stat, i) => (
                            <div 
                                key={i}
                                className="min-w-[280px] snap-center bg-white dark:bg-zinc-900 rounded-[2rem] p-8 border border-gray-100 dark:border-zinc-800 text-center shadow-lg"
                            >
                                <div className="h-16 w-16 mx-auto bg-[#F58220]/10 rounded-2xl flex items-center justify-center mb-6">
                                    <stat.icon className="h-8 w-8 text-[#F58220]" />
                                </div>
                                <h3 className="text-3xl font-black text-[#1A1A1A] dark:text-white mb-1">{stat.value}</h3>
                                <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">{stat.label}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Journey Section - Premium Refinement */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center mb-40"
                >
                    <div className="space-y-8 order-2 lg:order-1">
                        <div className="h-1 w-20 bg-[#F58220] rounded-full" />
                        <h2 className="text-5xl md:text-6xl font-bold text-[#001943] dark:text-white leading-[1.05]">
                            Our journey began with a <span className="text-[#F58220]">simple idea</span>.
                        </h2>
                        <div className="space-y-6 text-gray-500 dark:text-gray-400 text-lg leading-relaxed">
                            <p>
                                We set out to build a platform that brings convenience, trust, and freshness together in one place. In a world where food shopping is often stressful, RSS FOODS stands as a beacon of reliability.
                            </p>
                            <p className="border-l-4 border-[#F58220] pl-6 italic text-zinc-600 dark:text-zinc-300">
                                "Everyone deserves access to safe, affordable, and reliable food products. That belief drives everything we do."
                            </p>
                        </div>
                    </div>
                    <div className="h-[400px] md:h-[550px] w-full bg-gray-100 rounded-[3rem] overflow-hidden order-1 lg:order-2 relative group shadow-2xl">
                        <div className="w-full h-full bg-cover bg-center transition-transform duration-1000 group-hover:scale-110" style={{
                            backgroundImage: "url('/images/about/journey.png')",
                        }} />
                        <div className="absolute inset-0 bg-gradient-to-br from-[#F58220]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    </div>
                </motion.div>

                {/* Vision Section - Elegant Finish */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center mb-20"
                >
                    <div className="h-[400px] md:h-[550px] w-full bg-gray-100 rounded-[3rem] overflow-hidden relative group shadow-2xl">
                        <div className="w-full h-full bg-cover bg-center transition-transform duration-1000 group-hover:scale-110" style={{
                            backgroundImage: "url('/images/about/vision.png')",
                        }} />
                        <div className="absolute inset-0 bg-gradient-to-tr from-[#9333EA]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    </div>
                    <div className="space-y-8">
                        <div className="h-1 w-20 bg-[#F58220] rounded-full" />
                        <h2 className="text-5xl md:text-6xl font-bold text-[#001943] dark:text-white leading-[1.05]">
                            The Vision for the Future.
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400 text-lg leading-relaxed">
                            Our vision is to redefine the food shopping experience by using technology to connect people with safe, reliable, and affordable food products—anytime, anywhere.
                        </p>
                        <Button className="h-14 px-10 rounded-full bg-[#F58220] hover:bg-[#F58220]/90 text-white font-bold text-lg shadow-lg shadow-[#F58220]/20 transition-all hover:scale-105">
                            Join Our Mission
                        </Button>
                    </div>
                </motion.div>

            </div>
        </div>
    )
}
