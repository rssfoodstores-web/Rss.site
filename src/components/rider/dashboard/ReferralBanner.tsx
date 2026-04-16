"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Facebook,
    Instagram,
    Linkedin,
    Phone,
    Twitter,
    type LucideIcon,
} from "lucide-react"

export function ReferralBanner() {
    return (
        <div className="flex flex-col items-center justify-between gap-8 rounded-2xl border border-gray-100 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:flex-row">
            <div className="max-w-xl space-y-4">
                <h2 className="text-2xl font-bold text-[#191970] dark:text-white">Earn More with Referrals!</h2>
                <p className="text-gray-500">
                    Share your link and earn <span className="font-bold text-[#F58220]">N500</span> for each new rider who completes 5 deliveries.
                </p>

                <div className="flex gap-2">
                    <Input
                        value="https://refer&earn-michaelobong"
                        readOnly
                        className="h-12 border-gray-200 bg-gray-50 text-gray-600 dark:border-zinc-700 dark:bg-zinc-800"
                    />
                    <Button className="h-12 shrink-0 rounded-lg bg-[#F58220] px-8 font-bold text-white hover:bg-[#E57210]">
                        Copy
                    </Button>
                </div>
            </div>

            <div className="flex gap-4">
                <SocialIcon icon={Facebook} />
                <SocialIcon icon={Twitter} />
                <SocialIcon icon={Instagram} color="text-pink-600" />
                <SocialIcon icon={Phone} color="text-green-500" />
                <SocialIcon icon={Linkedin} color="text-blue-700" />
            </div>
        </div>
    )
}

function SocialIcon({ icon: Icon, color = "text-blue-600" }: { icon: LucideIcon; color?: string }) {
    return (
        <button className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-50 transition-transform hover:scale-110 dark:bg-zinc-800">
            <Icon className={`h-5 w-5 ${color}`} />
        </button>
    )
}
