"use client"

import { startTransition, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

type RealtimeEvent = "*" | "INSERT" | "UPDATE" | "DELETE"

export interface RouteRefreshSubscription {
    event?: RealtimeEvent
    schema?: string
    table: string
    filter?: string
}

interface RouteRefreshBridgeProps {
    channelName: string
    subscriptions: RouteRefreshSubscription[]
    refreshDelayMs?: number
}

export function RouteRefreshBridge({
    channelName,
    subscriptions,
    refreshDelayMs = 200,
}: RouteRefreshBridgeProps) {
    const router = useRouter()
    const [supabase] = useState(() => createClient())
    const subscriptionKey = JSON.stringify(subscriptions)

    useEffect(() => {
        const activeSubscriptions = JSON.parse(subscriptionKey) as RouteRefreshSubscription[]
        if (!activeSubscriptions.length) return

        let timer: number | undefined
        let connected = false
        let disposed = false

        const scheduleRefresh = () => {
            if (disposed || document.hidden) return
            window.clearTimeout(timer)
            timer = window.setTimeout(() => {
                if (!document.hidden) startTransition(() => router.refresh())
            }, refreshDelayMs)
        }

        const channel = activeSubscriptions.reduce((builder, subscription) => (
            builder.on("postgres_changes", {
                event: subscription.event ?? "*",
                schema: subscription.schema ?? "public",
                table: subscription.table,
                filter: subscription.filter,
            }, scheduleRefresh)
        ), supabase.channel(channelName))

        channel.subscribe((status: string) => {
            connected = status === "SUBSCRIBED"
            scheduleRefresh()
        })
        window.addEventListener("focus", scheduleRefresh)
        window.addEventListener("online", scheduleRefresh)
        document.addEventListener("visibilitychange", scheduleRefresh)
        const recovery = window.setInterval(() => {
            if (!connected) scheduleRefresh()
        }, 15000)

        return () => {
            disposed = true
            window.clearTimeout(timer)
            window.clearInterval(recovery)
            window.removeEventListener("focus", scheduleRefresh)
            window.removeEventListener("online", scheduleRefresh)
            document.removeEventListener("visibilitychange", scheduleRefresh)
            void supabase.removeChannel(channel)
        }
    }, [channelName, refreshDelayMs, router, subscriptionKey, supabase])

    return null
}
