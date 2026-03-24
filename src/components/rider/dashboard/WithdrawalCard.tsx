"use client"

import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

export function WithdrawalCard() {
    return (
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm h-full">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-gray-500 text-sm font-medium">Withdrawal Method</h3>
                <Button variant="ghost" className="h-8 px-3 text-red-500 bg-red-50 hover:bg-red-100 hover:text-red-600 rounded-lg text-xs font-bold">
                    Deactivate
                </Button>
            </div>

            <div className="flex flex-col xl:flex-row gap-6">
                {/* Credit Card Mockup */}
                <div className="relative w-full xl:w-64 h-40 rounded-2xl overflow-hidden shrink-0">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-teal-700"></div>

                    {/* Abstract Shapes */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full -ml-12 -mb-12 blur-xl"></div>

                    <div className="relative h-full p-5 flex flex-col justify-between text-white">
                        <div className="flex justify-between items-start">
                            <span className="font-bold text-lg tracking-wider opacity-90">Finaci</span>
                            <div className="flex -space-x-3">
                                <div className="w-8 h-8 rounded-full bg-white/30 backdrop-blur-sm"></div>
                                <div className="w-8 h-8 rounded-full bg-white/30 backdrop-blur-sm"></div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="text-lg font-mono tracking-widest opacity-90">**** **** **** 2345</div>
                            <div className="flex justify-between items-end text-xs opacity-75">
                                <div>
                                    <div className="text-[10px] uppercase mb-0.5">Card Holder</div>
                                    <div className="font-bold">Noman Manzoor</div>
                                </div>
                                <div>
                                    <div className="text-[10px] uppercase mb-0.5">Expires</div>
                                    <div className="font-bold">02/30</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Details & Actions */}
                <div className="flex-1 flex flex-col justify-between">
                    <div className="space-y-3 mb-4">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-500">Status</span>
                            <span className="text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-full text-xs">Active</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-500">Transactions</span>
                            <span className="font-bold text-gray-900 dark:text-gray-200">1,250</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-500">Revenue</span>
                            <span className="font-bold text-gray-900 dark:text-gray-200">₦5,000,000</span>
                        </div>

                        <Button variant="outline" className="w-full text-xs h-8 border-dashed text-gray-500 gap-1 mt-2">
                            <Plus className="h-3 w-3" /> Add Card
                        </Button>
                    </div>

                    <Button className="w-full bg-[#F58220] hover:bg-[#E57210] text-white font-bold h-11 rounded-xl shadow-lg shadow-orange-500/20">
                        Withdraw
                    </Button>
                </div>
            </div>
        </div>
    )
}
