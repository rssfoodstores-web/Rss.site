"use client"

import { startTransition, useEffect, useMemo, useRef, useState } from "react"
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
    const refreshTimeoutRef = useRef<number | null>(null)
    const serializedSubscriptions = useMemo(() => JSON.stringify(subscriptions), [subscriptions])

    useEffect(() => {
        if (!subscriptions.length) {
            return
        }

        const scheduleRefresh = () => {
            if (refreshTimeoutRef.current !== null) {
                window.clearTimeout(refreshTimeoutRef.current)
            }

            refreshTimeoutRef.current = window.setTimeout(() => {
                refreshTimeoutRef.current = null
                startTransition(() => {
                    router.refresh()
                })
            }, refreshDelayMs)
        }

        const channel = subscriptions.reduce((builder, subscription) => (
            builder.on("postgres_changes", {
                event: subscription.event ?? "*",
                schema: subscription.schema ?? "public",
                table: subscription.table,
                filter: subscription.filter,
            }, scheduleRefresh)
        ), supabase.channel(channelName))

        channel.subscribe()

        return () => {
            if (refreshTimeoutRef.current !== null) {
                window.clearTimeout(refreshTimeoutRef.current)
            }

            supabase.removeChannel(channel)
        }
    }, [channelName, refreshDelayMs, router, serializedSubscriptions, subscriptions, supabase])

    return null
}
