"use client"

import { useEffect } from "react"

export function KeepMerchantOrderSelected({ href }: { href: string }) {
    useEffect(() => {
        const current = new URL(window.location.href)
        const selected = new URL(href, current)
        if (current.pathname === selected.pathname && !current.searchParams.has("order")) {
            // Keep the first visible order selected if its priority changes during a live update.
            window.history.replaceState(null, "", selected)
        }
    }, [href])
    return null
}
