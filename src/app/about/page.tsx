"use client"

import Link from "next/link"
import { Home, Check, Users, Leaf, Store, Headset } from "lucide-react"
import { motion } from "framer-motion"

const stats = [
    { icon: Users, label: "Happy Customers", value: "Growing" },
    { icon: Leaf, label: "Quality Products", value: "Premium" },
    { icon: Store, label: "Delivery Hubs", value: "Regional" },
    { icon: Headset, label: "Customer Support", value: "Daily" },
]

export default function AboutPage() {
    return (
        <div className="min-h-screen bg-white dark:bg-black font-sans overflow-hidden">
            {/* Decorative Background Blobs */}
            <div className="fixed top-0 right-0 -mr-40 -mt-40 w-96 h-96 bg-[#F58220] rounded-full blur-[150px] opacity-10 pointer-events-none" />
            <div className="fixed bottom-0 left-0 -ml-40 -mb-40 w-96 h-96 bg-[#F58220] rounded-full blur-[150px] opacity-10 pointer-events-none" />

            {/* Breadcrumb */}
            <div className="container mx-auto px-4 md:px-8 py-6 relative z-10">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Link href="/" className="hover:text-[#F58220] transition-colors">
                        <Home className="h-4 w-4" />
                    </Link>
                    <span>{">"}</span>
                    <span className="text-[#F58220]">About Us</span>
                </div>
            </div>

            <div className="container mx-auto px-4 md:px-8 pb-20 relative z-10">

                {/* Hero Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 mb-32 items-center"
                >
                    <div className="space-y-8">
                        <span className="inline-block px-4 py-2 bg-[#F58220]/10 text-[#F58220] text-sm font-bold rounded uppercase tracking-wider">
                            WHO WE ARE
                        </span>
                        <h1 className="text-[40px] leading-[1.2] font-semibold text-[#001903] dark:text-white">
                            RSS FOODS – Your trusted online food marketplace for everyday essentials.
                        </h1>
                        <p className="text-gray-500 text-base leading-relaxed max-w-lg">
                            RSS FOODS is a modern online food marketplace committed to making quality food products accessible, affordable, and effortlessly available to everyone. From fresh ingredients to everyday essentials, we bring trusted food items from reliable suppliers straight to your doorstep.
                        </p>

                        <div className="space-y-4 pt-2">
                            {[
                                "Reliable customer support team.",
                                "Skilled local delivery partners.",
                                "Fast growing network in Nigeria.",
                                "Carefully selected food essentials."
                            ].map((item, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <div className="h-6 w-6 rounded-full bg-[#F58220]/10 flex items-center justify-center shrink-0">
                                        <Check className="h-4 w-4 text-[#F58220]" strokeWidth={3} />
                                    </div>
                                    <span className="text-[#191C1F] dark:text-gray-300 font-medium">{item}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Hero Images - Overlapping Grid */}
                    <div className="relative h-[500px] w-full hidden lg:block">
                        {/* Large Back Image (Meeting) */}
                        <div className="absolute top-0 right-0 w-[85%] h-[85%] rounded-[20px] bg-gray-200 overflow-hidden shadow-lg">
                            <div className="w-full h-full bg-gray-200" style={{
                                backgroundImage: "url('/images/about/hero-1.png')",
                                backgroundSize: "cover",
                                backgroundPosition: "center"
                            }} />
                        </div>
                        {/* Small Front Image (Handshake/Office) */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, x: -20 }}
                            animate={{ opacity: 1, scale: 1, x: 0 }}
                            transition={{ delay: 0.3, duration: 0.6 }}
                            className="absolute bottom-0 left-0 w-[55%] h-[55%] rounded-[20px] shadow-2xl bg-gray-300 overflow-hidden border-[6px] border-white dark:border-black"
                        >
                            <div className="w-full h-full bg-gray-300" style={{
                                backgroundImage: "url('/images/about/hero-2.png')",
                                backgroundSize: "cover",
                                backgroundPosition: "center"
                            }} />
                        </motion.div>
                    </div>
                </motion.div>

                {/* Impact / Stats Section (Replaces Partners) */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="bg-gray-50 dark:bg-zinc-900 rounded-3xl p-12 mb-32 border border-gray-100 dark:border-zinc-800"
                >
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12">
                        {stats.map((stat, i) => (
                            <div key={i} className="text-center group">
                                <div className="h-16 w-16 mx-auto bg-white dark:bg-black rounded-full flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform duration-300 border border-gray-100 dark:border-zinc-800">
                                    <stat.icon className="h-8 w-8 text-[#F58220]" />
                                </div>
                                <h3 className="text-3xl md:text-4xl font-bold text-[#1A1A1A] dark:text-white mb-2">{stat.value}</h3>
                                <p className="text-gray-500 font-medium uppercase tracking-wide text-sm">{stat.label}</p>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* Journey Section */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center mb-32"
                >
                    <div className="space-y-8 order-2 lg:order-1">
                        <h2 className="text-[48px] md:text-[55px] leading-none font-semibold text-[#001943] dark:text-white">
                            Our journey began with a simple idea
                        </h2>
                        <div className="space-y-6 text-gray-500 text-lg leading-relaxed">
                            <p>
                                Our journey began with a simple idea — to make quality food easily accessible to every home. In a world where food shopping is often stressful, time-consuming, and unpredictable, we set out to build a platform that brings convenience, trust, and freshness together in one place.
                            </p>
                            <p>
                                At RSS FOODS, we believe that everyone deserves access to safe, affordable, and reliable food products. That belief drives us to work with trusted suppliers, maintain high quality standards, and create a seamless online shopping experience for individuals, families, and businesses.
                            </p>
                        </div>
                    </div>
                    <div className="h-[400px] md:h-[500px] w-full bg-gray-100 rounded-[20px] overflow-hidden order-1 lg:order-2 relative group shadow-lg">
                        <div className="w-full h-full bg-gray-200 transition-transform duration-700 group-hover:scale-105" style={{
                            backgroundImage: "url('/images/about/journey.png')",
                            backgroundSize: "cover",
                            backgroundPosition: "center"
                        }} />
                    </div>
                </motion.div>

                {/* Vision Section */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center mb-10"
                >
                    <div className="h-[400px] md:h-[500px] w-full bg-gray-100 rounded-[20px] overflow-hidden relative group shadow-lg">
                        <div className="w-full h-full bg-gray-200 transition-transform duration-700 group-hover:scale-105" style={{
                            backgroundImage: "url('/images/about/vision.png')",
                            backgroundSize: "cover",
                            backgroundPosition: "center"
                        }} />
                    </div>
                    <div className="space-y-8">
                        <h2 className="text-[48px] md:text-[55px] leading-none font-semibold text-[#001943] dark:text-white">
                            Our Vision
                        </h2>
                        <div className="space-y-6 text-gray-500 text-lg leading-relaxed">
                            <p>
                                Our vision is to become the most trusted and accessible online food marketplace, bringing quality, freshness, and convenience to every home. We aim to redefine the food shopping experience by using technology to connect people with safe, reliable, and affordable food products—anytime, anywhere.
                            </p>
                            <p>
                                At RSS FOODS, we envision a future where food shopping is effortless, quality is guaranteed, and every customer can confidently access the products they need with just a few clicks. Our goal is to create a platform that empowers families, strengthens communities, and supports a healthier, more sustainable food ecosystem.
                            </p>
                        </div>
                    </div>
                </motion.div>

            </div>
        </div>
    )
}
