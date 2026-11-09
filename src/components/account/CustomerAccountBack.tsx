"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowLeft } from "lucide-react"

export function CustomerAccountBack() {
    const pathname = usePathname()
    if (!pathname || pathname === "/account" || pathname === "/account/") return null

    return (
        <div className="container mx-auto px-4 pt-4 sm:px-6">
            <Link href="/account" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-foreground hover:underline">
                <ArrowLeft className="size-4" aria-hidden="true" /> My Account
            </Link>
        </div>
    )
}
