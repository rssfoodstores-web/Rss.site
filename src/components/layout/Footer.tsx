"use client"

import { FormEvent, useState, useTransition } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { toast } from "sonner"
import { subscribeToNewsletter } from "@/app/actions/newsletterActions"
import { createStorefrontHref, storefrontCategories } from "@/lib/categories"
import { buildContactMethodHref, getContactMethodByType } from "@/lib/contactPage"
import { usePublicContactPageContent } from "@/hooks/usePublicContactPageContent"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SocialMediaFooter } from "./SocialMediaFooter"

export function Footer() {
    const pathname = usePathname()
    const featuredFooterCategories = storefrontCategories.slice(0, 4)
    const content = usePublicContactPageContent()
    const [email, setEmail] = useState("")
    const [isPending, startTransition] = useTransition()
    const primaryPhoneMethod = getContactMethodByType(content.methods, "phone")
    const primaryEmailMethod = getContactMethodByType(content.methods, "email")
    const phoneHref = primaryPhoneMethod ? buildContactMethodHref(primaryPhoneMethod) : null
    const emailHref = primaryEmailMethod ? buildContactMethodHref(primaryEmailMethod) : null

    if (pathname?.startsWith("/merchant")) return null

    const handleSubscribe = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        startTransition(async () => {
            try {
                const result = await subscribeToNewsletter({
                    email,
                    source: "footer",
                })

                setEmail("")
                toast.success(result.created ? "Newsletter subscription saved." : "This email is already subscribed.")
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Unable to save your email right now.")
            }
        })
    }

    return (
        <footer className="w-full font-sans">
            <div className="border-t bg-[#F7F7F7] px-4 py-12 dark:border-zinc-800 dark:bg-zinc-900 md:px-8">
                <div className="container mx-auto flex flex-col items-center justify-between gap-8 lg:flex-row">
                    <div className="max-w-xl text-center lg:text-left">
                        <h3 className="text-2xl font-bold text-[#1A1A1A] dark:text-white">{content.newsletter.title}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-gray-500">{content.newsletter.description}</p>
                    </div>

                    <div className="mt-4 flex w-full flex-col items-center gap-6 sm:flex-row lg:mt-0 lg:w-auto">
                        <form className="relative w-full sm:w-[450px]" onSubmit={handleSubscribe}>
                            <Input
                                type="email"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                placeholder={content.newsletter.emailPlaceholder}
                                required
                                className="h-[52px] w-full rounded-full border-transparent bg-white pl-6 pr-28 text-black shadow-sm placeholder:text-gray-400 focus-visible:ring-0 dark:text-white sm:pr-32"
                            />
                            <Button
                                type="submit"
                                disabled={isPending}
                                className="absolute bottom-1 right-1 top-1 z-10 h-auto rounded-full bg-[#F58220] px-4 text-sm font-bold text-white hover:bg-[#F58220]/90 sm:px-8 sm:text-base"
                            >
                                {isPending ? "Saving..." : content.newsletter.buttonText}
                            </Button>
                        </form>

                        <div className="shrink-0">
                            <SocialMediaFooter />
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-[#1A1A1A] pb-8 pt-16 text-white">
                <div className="container mx-auto px-4 md:px-8">
                    <div className="mb-16 grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-8">
                        <div className="space-y-6 text-center lg:col-span-4 lg:pr-12 lg:text-left">
                            <Link href="/" className="mb-2 inline-block">
                                <div className="flex flex-col items-center lg:items-start">
                                    <Image src="/logo.png" alt="RSS Foods" width={180} height={48} className="h-12 w-auto object-contain brightness-0 invert" />
                                </div>
                            </Link>
                            <p className="mx-auto max-w-md text-sm leading-relaxed text-gray-400 lg:mx-0">
                                Your trusted partner for quality food items - rice, pasta, semovita, and detergents - delivered fresh and fast. Shop early and save big this season!
                            </p>

                            <div className="flex flex-col items-center gap-4 pt-4 lg:items-start">
                                <div className="flex flex-col items-center gap-2 sm:flex-row">
                                    {phoneHref && primaryPhoneMethod ? (
                                        <a href={phoneHref} className="text-lg font-semibold text-white transition-colors hover:text-[#F58220]">
                                            {primaryPhoneMethod.value}
                                        </a>
                                    ) : (
                                        <span className="text-lg font-semibold text-white">{primaryPhoneMethod?.value ?? ""}</span>
                                    )}
                                    <span className="hidden text-gray-500 sm:inline">or</span>
                                    {emailHref && primaryEmailMethod ? (
                                        <a href={emailHref} className="border-b-2 border-[#F58220] pb-0.5 text-lg font-semibold text-white transition-colors hover:text-[#F58220]">
                                            {primaryEmailMethod.value}
                                        </a>
                                    ) : (
                                        <span className="border-b-2 border-[#F58220] pb-0.5 text-lg font-semibold text-white">
                                            {primaryEmailMethod?.value ?? ""}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="hidden lg:col-span-1 lg:block" />

                        <div className="grid grid-cols-2 gap-8 text-center sm:grid-cols-3 sm:text-left md:grid-cols-5 lg:col-span-7">
                            <div className="space-y-6">
                                <h3 className="text-base font-bold text-white">Categories</h3>
                                <ul className="space-y-4 text-sm text-gray-400">
                                    {featuredFooterCategories.map((category) => (
                                        <li key={category.slug}>
                                            <Link
                                                href={createStorefrontHref({
                                                    pathname,
                                                    patch: {
                                                        category: category.slug,
                                                    },
                                                    hash: "product-grid",
                                                })}
                                                className="transition-colors hover:text-white"
                                            >
                                                {category.label}
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="space-y-6">
                                <h3 className="text-base font-bold text-white">Account</h3>
                                <ul className="space-y-4 text-sm text-gray-400">
                                    <li><Link href="/account" className="transition-colors hover:text-white">My Account</Link></li>
                                    <li><Link href="/account/orders" className="transition-colors hover:text-white">Order History</Link></li>
                                    <li><Link href="/cart" className="transition-colors hover:text-white">Shopping Cart</Link></li>
                                    <li><Link href="/wishlist" className="transition-colors hover:text-white">Wishlist</Link></li>
                                </ul>
                            </div>

                            <div className="space-y-6">
                                <h3 className="text-base font-bold text-white">Register</h3>
                                <ul className="space-y-4 text-sm text-gray-400">
                                    <li><Link href="/join/rider" className="transition-colors hover:text-white">Delivery Partner</Link></li>
                                    <li><Link href="/join/agent" className="transition-colors hover:text-white">Become an Agent</Link></li>
                                    <li><Link href="/join/merchant" className="transition-colors hover:text-white">Merchant Sign Up</Link></li>
                                </ul>
                            </div>

                            <div className="space-y-6">
                                <h3 className="text-base font-bold text-white">Company</h3>
                                <ul className="space-y-4 text-sm text-gray-400">
                                    <li><Link href="/about" className="transition-colors hover:text-white">About Us</Link></li>
                                    <li><Link href="/retail" className="transition-colors hover:text-white">Shop</Link></li>
                                    <li><Link href="/wholesale" className="transition-colors hover:text-white">Products</Link></li>
                                    <li><Link href="/account/track-order" className="transition-colors hover:text-white">Track Order</Link></li>
                                </ul>
                            </div>

                            <div className="space-y-6">
                                <h3 className="text-base font-bold text-white">Help</h3>
                                <ul className="space-y-4 text-sm text-gray-400">
                                    <li><Link href="/contact" className="transition-colors hover:text-white">Contact Us</Link></li>
                                    <li><Link href="/faqs" className="transition-colors hover:text-white">FAQs</Link></li>
                                    <li><Link href="/terms" className="transition-colors hover:text-white">Terms & Conditions</Link></li>
                                    <li><Link href="/privacy" className="transition-colors hover:text-white">Privacy Policy</Link></li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col items-center justify-between gap-4 border-t border-gray-800 pt-8 md:flex-row">
                        <p className="text-xs text-gray-500">RSS FOODS &copy;2025. All Rights Reserved</p>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 opacity-80">
                                <span className="rounded bg-white/10 px-1 py-0.5 text-[10px] font-bold">Apple Pay</span>
                                <span className="rounded bg-white/10 px-1 py-0.5 text-[10px] font-bold">VISA</span>
                                <span className="rounded bg-white/10 px-1 py-0.5 text-[10px] font-bold text-orange-500">Discover</span>
                                <span className="rounded bg-white/10 px-1 py-0.5 text-[10px] font-bold text-red-500">Mastercard</span>
                            </div>
                            <div className="ml-2 rounded border border-gray-700 px-2 py-1 text-[10px] text-gray-500">
                                Secure Payment
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    )
}
