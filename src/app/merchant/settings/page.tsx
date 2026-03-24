"use client"

import {
    Store,
    Bell,
    Shield,
    CreditCard,
    MapPin,
    Mail,
    Smartphone,
    Save,
    Camera
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export default function MerchantSettingsPage() {
    return (
        <div className="space-y-10">
            <div>
                <h1 className="mb-2 text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl">Settings</h1>
                <p className="text-gray-500 font-medium">Manage your store profile, security, and preferences.</p>
            </div>

            <div className="flex flex-col gap-8 lg:flex-row lg:gap-12">
                {/* Navigation */}
                <aside className="w-full lg:w-72 space-y-2">
                    {[
                        { label: "Store Profile", icon: Store, active: true },
                        { label: "Notifications", icon: Bell },
                        { label: "Security", icon: Shield },
                        { label: "Bank Details", icon: CreditCard },
                    ].map((item) => (
                        <button
                            key={item.label}
                            className={cn(
                                "w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-bold transition-all",
                                item.active
                                    ? "bg-white dark:bg-zinc-900 border border-[#F58220]/20 text-[#F58220] shadow-sm"
                                    : "text-gray-400 hover:bg-white dark:hover:bg-zinc-900 hover:text-gray-900"
                            )}
                        >
                            <item.icon className="h-5 w-5" />
                            {item.label}
                        </button>
                    ))}
                </aside>

                {/* Main Form */}
                <main className="flex-1 space-y-8">
                    <div className="space-y-8 rounded-[3rem] border border-gray-100 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8 lg:p-12 lg:space-y-10">
                        {/* Avatar */}
                        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
                            <div className="relative group">
                                <div className="h-32 w-32 bg-gray-50 dark:bg-zinc-800 rounded-[2.5rem] flex items-center justify-center text-[#F58220] border-4 border-white dark:border-zinc-700 shadow-xl overflow-hidden">
                                    <Store className="h-12 w-12" />
                                </div>
                                <button className="absolute -bottom-2 -right-2 h-10 w-10 bg-[#F58220] text-white rounded-xl flex items-center justify-center border-4 border-white dark:border-zinc-900 shadow-lg">
                                    <Camera className="h-5 w-5" />
                                </button>
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold mb-1">Store Logo</h3>
                                <p className="text-gray-400 font-medium">Upload a profile picture for your store.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-3">
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                    <Store className="h-4 w-4" /> Store Name
                                </label>
                                <Input defaultValue="RSS Merchant Store" className="h-14 rounded-2xl bg-gray-50/50 border-gray-100 px-6 font-bold" />
                            </div>
                            <div className="space-y-3">
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                    <Mail className="h-4 w-4" /> Business Email
                                </label>
                                <Input defaultValue="business@rssfoods.com" className="h-14 rounded-2xl bg-gray-50/50 border-gray-100 px-6 font-bold" />
                            </div>
                            <div className="space-y-3">
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                    <Smartphone className="h-4 w-4" /> Store Phone
                                </label>
                                <Input defaultValue="+234 800 123 4567" className="h-14 rounded-2xl bg-gray-50/50 border-gray-100 px-6 font-bold" />
                            </div>
                            <div className="space-y-3">
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                    <MapPin className="h-4 w-4" /> Store Address
                                </label>
                                <Input defaultValue="123 RSS Avenue, Ikeja, Lagos" className="h-14 rounded-2xl bg-gray-50/50 border-gray-100 px-6 font-bold" />
                            </div>
                        </div>

                        <div className="flex justify-end border-t border-gray-50 pt-6 dark:border-zinc-800">
                            <Button className="h-14 w-full rounded-2xl bg-[#F58220] px-8 text-base font-bold text-white shadow-xl shadow-orange-500/20 hover:bg-[#E57210] sm:h-16 sm:w-auto sm:px-12 sm:text-lg">
                                <Save className="h-5 w-5 mr-3" /> Save Changes
                            </Button>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}
