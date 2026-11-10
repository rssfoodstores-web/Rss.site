"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/context/UserContext"
import { getSafeNotificationHref, matchesNotificationDestination, type AppNotification } from "@/lib/notifications"

export function RealtimeNotificationBridge() {
    const { user, markNotificationsRead } = useUser()
    const router = useRouter()
    const pathname = usePathname()
    const [supabase] = useState(() => createClient())
    const seenIds = useRef<Set<string>>(new Set())

    useEffect(() => {
        if (!user) {
            return
        }

        const channel = supabase
            .channel(`live-notifications-${user.id}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "notifications",
                    filter: `user_id=eq.${user.id}`,
                },
                (payload: RealtimePostgresChangesPayload<AppNotification>) => {
                    const notification = payload.new as AppNotification

                    if (seenIds.current.has(notification.id)) {
                        return
                    }

                    seenIds.current.add(notification.id)

                    const href = getSafeNotificationHref(notification.action_url)
                    const markNotificationAsRead = () => markNotificationsRead([notification.id])

                    if (matchesNotificationDestination(window.location.href, notification.action_url)) {
                        void markNotificationAsRead()
                        router.refresh()
                        return
                    }

                    toast(notification.title, {
                        description: notification.message,
                        duration: 6000,
                        action: href
                            ? {
                                label: pathname === href ? "Refresh" : "Open",
                                onClick: () => {
                                    if (href) {
                                        void markNotificationAsRead()
                                        router.push(href)
                                    }
                                },
                            }
                            : undefined,
                    })

                    if (typeof window !== "undefined" && document.hidden && "Notification" in window && Notification.permission === "granted") {
                        const nativeNotification = new Notification(notification.title, {
                            body: notification.message,
                            tag: notification.id,
                        })

                        nativeNotification.onclick = () => {
                            window.focus()
                            if (href) {
                                void markNotificationAsRead()
                                router.push(href)
                            }
                        }
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [markNotificationsRead, pathname, router, supabase, user])

    return null
}
