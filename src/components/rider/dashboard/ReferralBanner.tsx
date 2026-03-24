"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Facebook, Twitter, Instagram, Linkedin, Phone } from "lucide-react"

export function ReferralBanner() {
    return (
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm flex flex-col md:flex-row gap-8 items-center justify-between">
            <div className="space-y-4 max-w-xl">
                <h2 className="text-2xl font-bold text-[#191970] dark:text-white">Earn More with Referrals!</h2>
                <p className="text-gray-500">
                    Share your link and earn <span className="font-bold text-[#F58220]">₦500</span> for each new rider who completes 5 deliveries
                </p>

                <div className="flex gap-2">
                    <Input
                        value="https://refer&earn-michaelobong"
                        readOnly
                        className="bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 h-12 text-gray-600"
                    />
                    <Button className="h-12 px-8 bg-[#F58220] hover:bg-[#E57210] text-white font-bold rounded-lg shrink-0">
                        Copy
                    </Button>
                </div>
            </div>

            <div className="flex gap-4">
                <SocialIcon icon={Facebook} />
                <SocialIcon icon={Twitter} /> {/* X icon usually represented by Twitter in generic sets or custom SVG */}
                <SocialIcon icon={Instagram} color="text-pink-600" />
                <SocialIcon icon={Phone} color="text-green-500" /> {/* Whatsapp placeholder */}
                <SocialIcon icon={Linkedin} color="text-blue-700" />
            </div>
        </div>
    )
}

function SocialIcon({ icon: Icon, color = "text-blue-600" }: { icon: any, color?: string }) {
    return (
        <button className="h-10 w-10 rounded-full bg-gray-50 dark:bg-zinc-800 flex items-center justify-center hover:scale-110 transition-transform">
            <Icon className={`h-5 w-5 ${color}`} />
        </button>
    )
}
