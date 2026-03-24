"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/context/UserContext"
import type { AppNotification } from "@/lib/notifications"

export function RealtimeNotificationBridge() {
    const { user } = useUser()
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

                    toast(notification.title, {
                        description: notification.message,
                        duration: 6000,
                        action: notification.action_url
                            ? {
                                label: pathname === notification.action_url ? "Refresh" : "Open",
                                onClick: () => {
                                    if (notification.action_url) {
                                        router.push(notification.action_url)
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
                            if (notification.action_url) {
                                router.push(notification.action_url)
                            }
                        }
                    }

                    if (notification.action_url && pathname === notification.action_url) {
                        router.refresh()
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [pathname, router, supabase, user])

    return null
}
