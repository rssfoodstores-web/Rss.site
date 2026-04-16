"use client"

import { Shield, Zap, Heart, Leaf } from "lucide-react"
import { motion } from "framer-motion"

const coreValues = [
    { 
        icon: Shield, 
        title: "Integrity", 
        description: "We are committed to honesty and transparency in all our dealings with customers and partners." 
    },
    { 
        icon: Zap, 
        title: "Quality", 
        description: "We source only the freshest ingredients and highest quality products for our marketplace." 
    },
    { 
        icon: Heart, 
        title: "Customer First", 
        description: "Everything we do is focused on providing the best possible experience for our users." 
    },
    { 
        icon: Leaf, 
        title: "Sustainability", 
        description: "We support local suppliers and sustainable practices to protect our environment." 
    },
]

export default function AboutPage() {
    return (
        <div className="min-h-screen bg-white dark:bg-[#0A0A0A] font-sans overflow-x-hidden">
            <div className="container mx-auto px-4 md:px-8 py-16 md:py-24">
                {/* Hero Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 mb-32 items-center">
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8 }}
                        className="space-y-8"
                    >
                        <div className="space-y-6">
                            <span className="inline-block px-3 py-1 bg-[#F58220] text-white text-[10px] font-bold rounded-sm uppercase tracking-wider">
                                WHO WE ARE
                            </span>
                            <h1 className="text-4xl md:text-5xl lg:text-5xl font-extrabold text-[#1A1A1A] dark:text-white leading-[1.2] tracking-tight max-w-xl">
                                RSS FOODS – The largest online food marketplace for everyday essentials.
                            </h1>
                            <p className="text-gray-500 dark:text-gray-400 text-base md:text-lg leading-relaxed max-w-xl font-normal">
                                RSS FOODS is a modern online food marketplace committed to bringing quality food products accessible, affordable, and effortlessly available to everyone. 
                                From fresh ingredients to everyday essentials, we bring trusted food items from reliable suppliers straight to your doorstep.
                            </p>
                        </div>

                        <div className="space-y-4">
                            {[
                                "Great 24/7 customer services.",
                                "600+ Dedicated employees.",
                                "50+ Branches all over the world.",
                                "Over 1 Million Quality Products"
                            ].map((item, i) => (
                                <motion.div 
                                    key={i} 
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.4 + i * 0.1 }}
                                    className="flex items-center"
                                >
                                    <span className="text-gray-700 dark:text-gray-300 text-sm font-medium">{item}</span>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>

                    {/* Hero Images Grid Layout - Fixed & Responsive */}
                    <div className="relative h-[400px] sm:h-[450px] md:h-[550px] lg:h-[600px] w-full max-w-[500px] lg:max-w-none mx-auto lg:mx-0">
                        {/* Background Decoration */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-orange-50/50 dark:bg-orange-500/[0.02] rounded-full blur-[100px] -z-10" />

                        {/* Large Main Image (Right Side) */}
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 1 }}
                            className="absolute right-0 top-0 w-[80%] sm:w-[85%] h-[70%] sm:h-[75%] rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.1)] z-10"
                        >
                            <img src="/images/about/hero-1.png" alt="RSS Foods Marketplace" className="w-full h-full object-cover" />
                        </motion.div>
                        
                        {/* Overlapping Bottom-Left Image */}
                        <motion.div 
                            initial={{ opacity: 0, x: -30, y: 30 }}
                            animate={{ opacity: 1, x: 0, y: 0 }}
                            transition={{ delay: 0.3, duration: 0.8 }}
                            className="absolute left-0 bottom-4 w-[60%] sm:w-[65%] h-[50%] sm:h-[55%] rounded-2xl sm:rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.15)] border-[6px] sm:border-[12px] border-white dark:border-zinc-900 z-20"
                        >
                            <img src="/images/about/hero-2.png" alt="Our Team" className="w-full h-full object-cover" />
                        </motion.div>
                    </div>
                </div>

                {/* Core Values Section (Formerly Partners) */}
                <div className="mb-40">
                    <div className="text-center mb-16 space-y-4">
                        <span className="text-[#F58220] font-bold text-xs uppercase tracking-[0.2em]">Our Values</span>
                        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">Why RSS FOODS?</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {coreValues.map((value, i) => (
                            <motion.div
                                key={value.title}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                                className="p-8 rounded-[32px] bg-[#F8F9FA] dark:bg-zinc-900/50 border border-transparent hover:border-[#F58220]/20 hover:bg-white dark:hover:bg-zinc-900 transition-all duration-300 group"
                            >
                                <div className="h-14 w-14 rounded-2xl bg-white dark:bg-zinc-800 shadow-sm flex items-center justify-center mb-6 text-[#F58220] group-hover:bg-[#F58220] group-hover:text-white transition-all duration-300">
                                    <value.icon className="h-7 w-7" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">{value.title}</h3>
                                <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">{value.description}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* Journey Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 mb-40 items-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="space-y-8"
                    >
                        <h2 className="text-4xl md:text-5xl font-bold text-[#1A1A1A] dark:text-white leading-tight underline-offset-8 decoration-4 decoration-[#F58220]/20 underline">
                            Our journey began with a simple idea
                        </h2>
                        <div className="space-y-6 text-gray-500 dark:text-gray-400 text-base md:text-lg leading-relaxed">
                            <p>
                                Our journey began with a simple idea — to make quality food easily accessible to every home.
                                In a world where food shopping is often stressful, time-consuming, and unpredictable, we set out to build a platform that brings convenience, trust, and freshness together in one place.
                            </p>
                            <p>
                                At RSS FOODS, we believe that everyone deserves access to safe, affordable, and reliable food products. That belief drives us to work with trusted suppliers, maintain high quality standards, and create a seamless online shopping experience for individuals, families, and businesses.
                            </p>
                        </div>
                    </motion.div>
                    <div className="relative h-[400px] md:h-[500px] rounded-[32px] overflow-hidden shadow-2xl">
                        <img src="/images/about/journey.png" alt="Our Journey" className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-700" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                    </div>
                </div>

                {/* Vision Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 mb-32 items-center">
                    <div className="relative h-[400px] md:h-[500px] rounded-[32px] overflow-hidden shadow-2xl lg:order-1 order-2">
                        <img src="/images/about/vision.png" alt="Our Vision" className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-700" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                    </div>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="space-y-8 lg:order-2 order-1"
                    >
                        <h2 className="text-4xl md:text-5xl font-bold text-[#1A1A1A] dark:text-white leading-tight underline-offset-8 decoration-4 decoration-[#F58220]/20 underline">
                            Our Vision
                        </h2>
                        <div className="space-y-6 text-gray-500 dark:text-gray-400 text-base md:text-lg leading-relaxed font-normal">
                            <p>
                                Our vision is to become the most trusted and accessible online food marketplace, bringing quality, freshness, and convenience to every home.
                                We aim to redefine the food shopping experience by using technology to connect people with safe, reliable, and affordable food products—anytime, anywhere.
                            </p>
                            <p>
                                At RSS FOODS, we envision a future where food shopping is effortless, quality is guaranteed, and every customer can confidently access the products they need with just a few clicks.
                                Our goal is to create a platform that empowers families, strengthens communities, and supports a healthier, more sustainable food ecosystem.
                            </p>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    )
}
