"use client"

import { FormEvent, useState, useTransition } from "react"
import Image from "next/image"
import Link from "next/link"
import { Mail, Phone } from "lucide-react"
import { usePathname } from "next/navigation"
import { toast } from "sonner"
import { subscribeToNewsletter } from "@/app/actions/newsletterActions"
import { buildContactMethodHref, getContactMethodByType } from "@/lib/contactPage"
import { usePublicContactPageContent } from "@/hooks/usePublicContactPageContent"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SocialMediaFooter } from "./SocialMediaFooter"

export function Footer() {
    const pathname = usePathname()
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

            <div className="bg-[#171717] pb-8 pt-12 text-white md:pt-16">
                <div className="container mx-auto px-4 md:px-8">
                    <div className="mb-10 grid grid-cols-1 gap-8 lg:mb-12 lg:grid-cols-12 lg:gap-10">
                        <div className="space-y-5 lg:col-span-4 lg:pr-10">
                            <Link href="/" className="inline-flex">
                                <Image src="/logo.png" alt="RSS Foods" width={180} height={48} className="h-11 w-auto object-contain brightness-0 invert" />
                            </Link>
                            <p className="max-w-md text-[15px] leading-6 text-gray-400">
                                Quality food and household essentials, delivered to your door.
                            </p>

                            <div className="grid gap-3 min-[520px]:grid-cols-2 lg:grid-cols-1">
                                {primaryPhoneMethod ? (
                                    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F58220]/15 text-[#F58220]"><Phone aria-hidden="true" className="h-4 w-4" /></span>
                                        <span className="min-w-0">
                                            <span className="block text-xs font-medium uppercase tracking-wider text-gray-500">Call us</span>
                                            {phoneHref ? (
                                                <a href={phoneHref} className="block truncate text-[15px] font-semibold text-white transition-colors hover:text-[#F58220]">{primaryPhoneMethod.value}</a>
                                            ) : (
                                                <span className="block truncate text-[15px] font-semibold text-white">{primaryPhoneMethod.value}</span>
                                            )}
                                        </span>
                                    </div>
                                ) : null}
                                {primaryEmailMethod ? (
                                    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F58220]/15 text-[#F58220]"><Mail aria-hidden="true" className="h-4 w-4" /></span>
                                        <span className="min-w-0">
                                            <span className="block text-xs font-medium uppercase tracking-wider text-gray-500">Email us</span>
                                            {emailHref ? (
                                                <a href={emailHref} className="block truncate text-[15px] font-semibold text-white transition-colors hover:text-[#F58220]">{primaryEmailMethod.value}</a>
                                            ) : (
                                                <span className="block truncate text-[15px] font-semibold text-white">{primaryEmailMethod.value}</span>
                                            )}
                                        </span>
                                    </div>
                                ) : null}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:gap-x-10 lg:col-span-8 lg:grid-cols-4 lg:gap-8">
                            <div className="border-t border-white/10 pt-4">
                                <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-[#F58220]">Account</h3>
                                <ul className="space-y-2.5 text-[15px] leading-6 text-gray-400">
                                    <li><Link href="/account" className="transition-colors hover:text-white">My Account</Link></li>
                                    <li><Link href="/account/orders" className="transition-colors hover:text-white">Order History</Link></li>
                                    <li><Link href="/cart" className="transition-colors hover:text-white">Shopping Cart</Link></li>
                                    <li><Link href="/wishlist" className="transition-colors hover:text-white">Wishlist</Link></li>
                                </ul>
                            </div>

                            <div className="border-t border-white/10 pt-4">
                                <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-[#F58220]">Register</h3>
                                <ul className="space-y-2.5 text-[15px] leading-6 text-gray-400">
                                    <li><Link href="/join/rider" className="transition-colors hover:text-white">Delivery Partner</Link></li>
                                    <li><Link href="/join/agent" className="transition-colors hover:text-white">Become an Agent</Link></li>
                                    <li><Link href="/join/merchant" className="transition-colors hover:text-white">Merchant Sign Up</Link></li>
                                </ul>
                            </div>

                            <div className="border-t border-white/10 pt-4">
                                <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-[#F58220]">Company</h3>
                                <ul className="space-y-2.5 text-[15px] leading-6 text-gray-400">
                                    <li><Link href="/about" className="transition-colors hover:text-white">About Us</Link></li>
                                    <li><Link href="/retail" className="transition-colors hover:text-white">Shop</Link></li>
                                    <li><Link href="/wholesale" className="transition-colors hover:text-white">Products</Link></li>
                                    <li><Link href="/account/track-order" className="transition-colors hover:text-white">Track Order</Link></li>
                                </ul>
                            </div>

                            <div className="border-t border-white/10 pt-4">
                                <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-[#F58220]">Help</h3>
                                <ul className="space-y-2.5 text-[15px] leading-6 text-gray-400">
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
