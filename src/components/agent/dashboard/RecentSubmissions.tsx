"use client"

import { Edit, Eye, Trash, ArrowRight } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"

const submissions = [
    {
        id: 1,
        product: "Bag of Rice",
        category: "Grains",
        price: "₦20,000",
        stock: 120,
        status: "Approved",
        date: "Feb 5, 2020",
        image: "/images/rice.png" // Placeholder
    },
    {
        id: 2,
        product: "Frozen Meat",
        category: "Frozen Food",
        price: "₦20,000",
        stock: 45,
        status: "Pending",
        date: "Sep 8, 2020",
        image: "/images/meat.png"
    },
    {
        id: 3,
        product: "Carrot",
        category: "Vegetables",
        price: "₦20,000",
        stock: 0,
        status: "Rejected",
        date: "Dec 21, 2020",
        image: "/images/carrot.png"
    },
    {
        id: 4,
        product: "Bag of Beans",
        category: "Grain",
        price: "₦20,000",
        stock: 500,
        status: "Approved",
        date: "Aug 13, 2020",
        image: "/images/beans.png"
    }
]

export function RecentSubmissions() {
    return (
        <div className="bg-white dark:bg-zinc-900 p-6 lg:p-8 rounded-[24px] border border-gray-100 dark:border-zinc-800 shadow-sm">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-xl font-bold text-[#1A1A1A] dark:text-white">Latest Submission</h3>
                <Link href="/agent/products" className="flex items-center gap-1 text-sm font-bold text-gray-400 hover:text-[#F58220] transition-colors">
                    More <ArrowRight className="h-4 w-4" />
                </Link>
            </div>

            <div className="space-y-3 md:hidden">
                {submissions.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-gray-100 p-4 dark:border-zinc-800">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500 dark:bg-zinc-800">
                                    {item.product[0]}
                                </div>
                                <div className="min-w-0">
                                    <p className="truncate font-bold text-[#1A1A1A] dark:text-white">{item.product}</p>
                                    <p className="text-sm text-gray-500">{item.category}</p>
                                </div>
                            </div>
                            <Badge variant="secondary" className={`
                                ${item.status === 'Approved' ? 'bg-green-100 text-green-700 hover:bg-green-100' : ''}
                                ${item.status === 'Pending' ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100' : ''}
                                ${item.status === 'Rejected' ? 'bg-red-100 text-red-700 hover:bg-red-100' : ''}
                                font-bold border-none
                             `}>
                                {item.status}
                            </Badge>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <div>
                                <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Price</p>
                                <p className="mt-1 text-sm font-bold text-[#1A1A1A] dark:text-white">{item.price}</p>
                            </div>
                            <div>
                                <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Stock</p>
                                <p className="mt-1 text-sm text-gray-500">{item.stock}</p>
                            </div>
                            <div>
                                <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Date</p>
                                <p className="mt-1 text-sm text-gray-500">{item.date}</p>
                            </div>
                        </div>
                        <div className="mt-4 flex items-center justify-end gap-2 text-gray-400">
                            <button className="rounded-lg p-2 transition-colors hover:bg-gray-50 hover:text-[#F58220] dark:hover:bg-zinc-800"><Edit className="h-4 w-4" /></button>
                            <button className="rounded-lg p-2 transition-colors hover:bg-gray-50 hover:text-[#F58220] dark:hover:bg-zinc-800"><Eye className="h-4 w-4" /></button>
                            {item.status === 'Rejected' ? <button className="rounded-lg p-2 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30"><Trash className="h-4 w-4" /></button> : null}
                        </div>
                    </div>
                ))}
            </div>

            <div className="hidden overflow-x-auto pb-4 md:block">
                <table className="w-full min-w-[800px]">
                    <thead>
                        <tr className="text-left text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-50 dark:border-zinc-800">
                            <th className="pb-4 pl-2">Products</th>
                            <th className="pb-4 hidden sm:table-cell">Categories</th>
                            <th className="pb-4 hidden md:table-cell">Price</th>
                            <th className="pb-4 hidden lg:table-cell">Stock</th>
                            <th className="pb-4">Status</th>
                            <th className="pb-4 hidden xl:table-cell">Date</th>
                            <th className="pb-4 text-right pr-2">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                        {submissions.map((item) => (
                            <tr key={item.id} className="group hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                                <td className="py-4 pl-2 flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden shrink-0">
                                        {/* Using div placeholder instead of Next Image for simplicity if image missing */}
                                        <div className="h-full w-full bg-gray-200 flex items-center justify-center text-xs text-gray-500 font-bold">
                                            {item.product[0]}
                                        </div>
                                    </div>
                                    <span className="font-bold text-sm text-[#1A1A1A] dark:text-white">{item.product}</span>
                                </td>
                                <td className="py-4 text-sm font-medium text-gray-500 hidden sm:table-cell">{item.category}</td>
                                <td className="py-4 text-sm font-bold text-[#1A1A1A] dark:text-white hidden md:table-cell">{item.price}</td>
                                <td className="py-4 text-sm font-medium text-gray-500 hidden lg:table-cell">{item.stock}</td>
                                <td className="py-4">
                                    <Badge variant="secondary" className={`
                                        ${item.status === 'Approved' ? 'bg-green-100 text-green-700 hover:bg-green-100' : ''}
                                        ${item.status === 'Pending' ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100' : ''}
                                        ${item.status === 'Rejected' ? 'bg-red-100 text-red-700 hover:bg-red-100' : ''}
                                        font-bold border-none
                                     `}>
                                        {item.status}
                                    </Badge>
                                </td>
                                <td className="py-4 text-sm text-gray-500 hidden xl:table-cell">{item.date}</td>
                                <td className="py-4 text-right pr-2">
                                    <div className="flex items-center justify-end gap-2 text-gray-400">
                                        <button className="hover:text-[#F58220] transition-colors"><Edit className="h-4 w-4" /></button>
                                        <button className="hover:text-[#F58220] transition-colors"><Eye className="h-4 w-4" /></button>
                                        {item.status === 'Rejected' && <button className="hover:text-red-500 transition-colors"><Trash className="h-4 w-4" /></button>}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
