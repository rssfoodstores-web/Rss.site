"use client"

import Link from "next/link"
import { Facebook, Instagram, Twitter, Mail, Phone } from "lucide-react"
import { SocialMediaFooter } from "./SocialMediaFooter"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { usePathname } from "next/navigation"

export function Footer() {
    const pathname = usePathname()
    if (pathname?.startsWith('/merchant')) return null;

    return (
        <footer className="w-full font-sans">
            {/* Newsletter Section - Light Background */}
            <div className="bg-[#F7F7F7] dark:bg-zinc-900 py-12 px-4 md:px-8 border-t dark:border-zinc-800">
                <div className="container mx-auto flex flex-col lg:flex-row items-center justify-between gap-8">
                    <div className="flex flex-col gap-2 max-w-xl text-center lg:text-left">
                        <h3 className="text-2xl font-bold text-[#1A1A1A] dark:text-white">Subcribe our Newsletter</h3>
                        <p className="text-gray-500 text-sm leading-relaxed">
                            Stay updated with the latest products, special offers, and helpful tips. Join our community and never miss an update.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-6 w-full lg:w-auto mt-4 lg:mt-0">
                        <div className="relative w-full sm:w-[450px]">
                            <Input
                                type="email"
                                placeholder="Your email address"
                                className="h-[52px] w-full rounded-full pl-6 pr-28 sm:pr-32 border-transparent bg-white shadow-sm focus-visible:ring-0 placeholder:text-gray-400 text-black dark:text-white"
                            />
                            <Button className="absolute right-1 top-1 bottom-1 px-4 sm:px-8 rounded-full bg-[#F58220] hover:bg-[#F58220]/90 text-white font-bold h-auto z-10 text-sm sm:text-base">
                                Subscribe
                            </Button>
                        </div>

                        <div className="flex gap-3 shrink-0">
                            {/* Social Media Links */}
                            <SocialMediaFooter />
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Footer - Dark Background */}
            <div className="bg-[#1A1A1A] text-white pt-16 pb-8">
                <div className="container mx-auto px-4 md:px-8">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 mb-16">

                        {/* Column 1: Brand & Contact (Width: 4/12) */}
                        <div className="lg:col-span-4 space-y-6 lg:pr-12 text-center lg:text-left">
                            <Link href="/" className="inline-block mb-2">
                                <div className="flex flex-col items-center lg:items-start">
                                    <img src="/logo.png" alt="RSS Foods" className="h-12 w-auto object-contain brightness-0 invert" />
                                </div>
                            </Link>
                            <p className="text-gray-400 text-sm leading-relaxed max-w-md mx-auto lg:mx-0">
                                Your trusted partner for quality food items — rice, pasta, semovita, and detergents — delivered fresh and fast. Shop early and save big this season!
                            </p>

                            <div className="flex flex-col gap-4 pt-4 items-center lg:items-start">
                                <div className="flex flex-col sm:flex-row items-center gap-2">
                                    <span className="font-semibold text-lg text-white">+234 903 019 8544</span>
                                    <span className="text-gray-500 hidden sm:inline">or</span>
                                    <span className="font-semibold text-lg text-white border-b-2 border-[#F58220] pb-0.5">hello@myrss.com.ng</span>
                                </div>
                            </div>
                        </div>

                        {/* Spacer Column (Width: 1/12) - hidden on mobile */}
                        <div className="hidden lg:block lg:col-span-1"></div>

                        {/* Links Columns (Remaining 7/12 distributed) */}
                        <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-8 text-center sm:text-left">
                            {/* Categories */}
                            <div className="space-y-6">
                                <h3 className="text-white font-bold text-base">Categories</h3>
                                <ul className="space-y-4 text-sm text-gray-400">
                                    <li><Link href="/category/african-food" className="hover:text-white transition-colors">African Food</Link></li>
                                    <li><Link href="/category/vegetables" className="hover:text-white transition-colors">Vegetables</Link></li>
                                    <li><Link href="/category/beverages" className="hover:text-white transition-colors">Beverages</Link></li>
                                    <li><Link href="/category/frozen" className="hover:text-white transition-colors">Frozen Food</Link></li>
                                </ul>
                            </div>

                            {/* My Account */}
                            <div className="space-y-6">
                                <h3 className="text-white font-bold text-base">Account</h3>
                                <ul className="space-y-4 text-sm text-gray-400">
                                    <li><Link href="/account" className="hover:text-white transition-colors">My Account</Link></li>
                                    <li><Link href="/orders" className="hover:text-white transition-colors">Order History</Link></li>
                                    <li><Link href="/cart" className="hover:text-white transition-colors">Shopping Cart</Link></li>
                                    <li><Link href="/wishlist" className="hover:text-white transition-colors">Wishlist</Link></li>
                                </ul>
                            </div>

                            {/* Register */}
                            <div className="space-y-6">
                                <h3 className="text-white font-bold text-base">Register</h3>
                                <ul className="space-y-4 text-sm text-gray-400">
                                    <li><Link href="/join/rider" className="hover:text-white transition-colors">Delivery Partner</Link></li>
                                    <li><Link href="/join/agent" className="hover:text-white transition-colors">Become an Agent</Link></li>
                                    <li><Link href="/join/merchant" className="hover:text-white transition-colors">Merchant Sign Up</Link></li>
                                </ul>
                            </div>

                            {/* Proxy */}
                            <div className="space-y-6">
                                <h3 className="text-white font-bold text-base">Company</h3>
                                <ul className="space-y-4 text-sm text-gray-400">
                                    <li><Link href="/about" className="hover:text-white transition-colors">About Us</Link></li>
                                    <li><Link href="/shop" className="hover:text-white transition-colors">Shop</Link></li>
                                    <li><Link href="/products" className="hover:text-white transition-colors">Products</Link></li>
                                    <li><Link href="/track" className="hover:text-white transition-colors">Track Order</Link></li>
                                </ul>
                            </div>

                            {/* Helps */}
                            <div className="space-y-6">
                                <h3 className="text-white font-bold text-base">Help</h3>
                                <ul className="space-y-4 text-sm text-gray-400">
                                    <li><Link href="/contact" className="hover:text-white transition-colors">Contact Us</Link></li>
                                    <li><Link href="/faqs" className="hover:text-white transition-colors">FAQs</Link></li>
                                    <li><Link href="/terms" className="hover:text-white transition-colors">Terms & Conditions</Link></li>
                                    <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Copyright & Payment */}
                    <div className="pt-8 border-t border-gray-800 flex flex-col md:flex-row justify-between items-center gap-4">
                        <p className="text-gray-500 text-xs">
                            RSS FOODS &copy;2025. All Rights Reserved
                        </p>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 opacity-80">
                                <span className="bg-white/10 px-1 py-0.5 rounded text-[10px] font-bold">Pay</span>
                                <span className="bg-white/10 px-1 py-0.5 rounded text-[10px] font-bold">VISA</span>
                                <span className="bg-white/10 px-1 py-0.5 rounded text-[10px] font-bold text-orange-500">Discover</span>
                                <span className="bg-white/10 px-1 py-0.5 rounded text-[10px] font-bold text-red-500">Mastercard</span>
                            </div>
                            <div className="text-[10px] text-gray-500 border border-gray-700 rounded px-2 py-1 ml-2">
                                Secure Payment
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    )
}
