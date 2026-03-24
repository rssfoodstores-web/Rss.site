"use client"

import { useState } from "react"
import { ProfileSidebar } from "@/components/account/ProfileSidebar"
import { MapPin, Plus, Home, Briefcase, Trash2, Edit2, CheckCircle2, CreditCard, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function AddressPage() {
    const [addresses] = useState([
        { id: 1, type: "Home", street: "123 RSS Street", city: "Lagos", state: "Lagos", isDefault: true },
        { id: 2, type: "Office", street: "45 Business Ave", city: "Ikeja", state: "Lagos", isDefault: false },
    ])

    return (
        <div className="min-h-screen bg-gray-50/50 py-6 dark:bg-black sm:py-8 lg:py-12">
            <div className="container mx-auto px-4 sm:px-6">
                <div className="mb-6 sm:mb-8">
                    <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">Addresses & Payments</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 sm:text-base">Manage your shipping addresses and saved payment methods.</p>
                </div>

                <div className="flex flex-col gap-5 sm:gap-6 lg:flex-row lg:gap-8">
                    <aside className="w-full flex-shrink-0 lg:sticky lg:top-4 lg:z-10 lg:w-80">
                        <ProfileSidebar />
                    </aside>
                    <main className="flex-1 space-y-8">
                        {/* Shipping Addresses */}
                        <section>
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                    <MapPin className="h-5 w-5 text-[#F58220]" /> Shipping Addresses
                                </h3>
                                <Button variant="outline" size="sm" className="rounded-xl font-bold border-gray-200 hover:bg-gray-50">
                                    <Plus className="h-4 w-4 mr-1" /> Add New
                                </Button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {addresses.map((address) => (
                                    <div
                                        key={address.id}
                                        className={cn(
                                            "bg-white dark:bg-zinc-900 p-6 rounded-3xl border transition-all relative overflow-hidden group",
                                            address.isDefault ? "border-[#F58220] ring-1 ring-[#F58220]/20" : "border-gray-100 dark:border-zinc-800"
                                        )}
                                    >
                                        <div className="flex justify-between items-start mb-4">
                                            <div className={cn(
                                                "h-10 w-10 rounded-xl flex items-center justify-center",
                                                address.type === 'Home' ? "bg-blue-50 text-blue-500" : "bg-purple-50 text-purple-500"
                                            )}>
                                                {address.type === 'Home' ? <Home className="h-5 w-5" /> : <Briefcase className="h-5 w-5" />}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button className="h-8 w-8 rounded-lg bg-gray-50 dark:bg-zinc-800 flex items-center justify-center text-gray-400 hover:text-[#F58220] transition-colors"><Edit2 className="h-4 w-4" /></button>
                                                {!address.isDefault && <button className="h-8 w-8 rounded-lg bg-red-50 flex items-center justify-center text-red-400 hover:text-red-500 transition-colors"><Trash2 className="h-4 w-4" /></button>}
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-bold text-gray-900 dark:text-white">{address.type}</h4>
                                                {address.isDefault && <span className="text-[10px] font-bold uppercase text-[#F58220] bg-orange-50 px-2 py-0.5 rounded-full">Default</span>}
                                            </div>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">{address.street}</p>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">{address.city}, {address.state}</p>
                                        </div>

                                        {/* Decorative checkmark for default */}
                                        {address.isDefault && <CheckCircle2 className="absolute -bottom-2 -right-2 h-12 w-12 text-[#F58220]/10" />}
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* Payment Methods */}
                        <section>
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                    <CreditCard className="h-5 w-5 text-[#F58220]" /> Payment Methods
                                </h3>
                                <Button variant="outline" size="sm" className="rounded-xl font-bold border-gray-200 hover:bg-gray-50">
                                    <Plus className="h-4 w-4 mr-1" /> Add Card
                                </Button>
                            </div>

                            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-zinc-800 divide-y divide-gray-50 dark:divide-zinc-800 overflow-hidden shadow-sm">
                                <div className="p-6 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer group">
                                    <div className="flex items-center gap-4">
                                        <div className="h-12 w-16 bg-zinc-900 rounded-lg flex items-center justify-center text-white shrink-0">
                                            <span className="font-black italic text-xs">VISA</span>
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900 dark:text-white">Visa Ending in 8891</p>
                                            <p className="text-xs text-gray-400">Expires 12/26 • Secondary Card</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-[#F58220] transition-colors" />
                                </div>
                                <div className="p-6 flex items-center justify-center py-12 text-center text-gray-400 group cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                                    <div>
                                        <div className="h-12 w-12 rounded-full border-2 border-dashed border-gray-200 flex items-center justify-center mx-auto mb-3 group-hover:border-[#F58220] group-hover:text-[#F58220] transition-colors">
                                            <Plus className="h-5 w-5" />
                                        </div>
                                        <p className="text-sm font-bold">Add a new payment method</p>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </main>
                </div>
            </div>
        </div>
    )
}
