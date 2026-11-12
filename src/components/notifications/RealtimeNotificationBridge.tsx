"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/context/UserContext"
import { getSafeNotificationHref, matchesNotificationDestination, type AppNotification } from "@/lib/notifications"

export function RealtimeNotificationBridge() {
    const { user, markNotificationsRead, refreshUnreadCount } = useUser()
    const router = useRouter()
    const [supabase] = useState(() => createClient())
    const seenIds = useRef<Set<string>>(new Set())

    useEffect(() => {
        const userId = user?.id
        if (!userId) return
        let disposed = false
        let connected = false
        let recovering = false
        let recoverFrom = new Date(Date.now() - 5000).toISOString()

        function present(notification: AppNotification) {
            if (disposed || !notification.id || notification.user_id !== userId || seenIds.current.has(notification.id)) return
            seenIds.current.add(notification.id)
            if (seenIds.current.size > 250) {
                const oldest = seenIds.current.values().next().value
                if (oldest) seenIds.current.delete(oldest)
            }

            const href = getSafeNotificationHref(notification.action_url)
            const markRead = () => {
                if (notification.type !== "order_message") void markNotificationsRead([notification.id])
            }
            const alreadyViewing = !document.hidden && matchesNotificationDestination(window.location.href, notification.action_url)
            if (alreadyViewing) {
                if (notification.type === "order_message") return
                markRead()
                router.refresh()
            }
            const open = href ? () => { markRead(); router.push(href) } : undefined
            toast(notification.title, {
                description: notification.message,
                duration: 6000,
                action: open && !alreadyViewing ? { label: "Open", onClick: open } : undefined,
            })
            if (document.hidden && "Notification" in window && Notification.permission === "granted") {
                try {
                    const native = new Notification(notification.title, { body: notification.message, tag: notification.id })
                    native.onclick = () => { window.focus(); open?.() }
                } catch {
                    // The in-app alert is already queued if this browser requires a service worker.
                }
            }
        }

        async function recover() {
            if (disposed || document.hidden || recovering) return
            recovering = true
            try {
                const { data, error } = await supabase.from("notifications")
                    .select("id,user_id,title,message,type,action_url,read,created_at,metadata")
                    .eq("user_id", userId).gte("created_at", recoverFrom)
                    .order("created_at", { ascending: false }).limit(50)
                if (disposed || error) return
                const rows = (data ?? []) as AppNotification[]
                const newest = rows[0]?.created_at
                if (newest) recoverFrom = newest
                for (const notification of rows.reverse()) present(notification)
                void refreshUnreadCount(userId)
            } catch {
                // The next reconnect or recovery interval will retry.
            } finally {
                recovering = false
            }
        }

        const channel = supabase.channel(`live-notifications-${userId}`)
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
                (payload: RealtimePostgresChangesPayload<AppNotification>) => present(payload.new as AppNotification))
            .subscribe((status: string) => {
                connected = status === "SUBSCRIBED"
                void recover()
            })
        const catchUp = () => { void recover() }
        window.addEventListener("online", catchUp)
        document.addEventListener("visibilitychange", catchUp)
        const recovery = window.setInterval(() => {
            if (!connected) catchUp()
        }, 15000)

        return () => {
            disposed = true
            window.clearInterval(recovery)
            window.removeEventListener("online", catchUp)
            document.removeEventListener("visibilitychange", catchUp)
            void supabase.removeChannel(channel)
        }
    }, [markNotificationsRead, refreshUnreadCount, router, supabase, user?.id])

    return null
}
