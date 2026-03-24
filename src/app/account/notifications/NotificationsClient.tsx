"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js"
import { ProfileSidebar } from "@/components/account/ProfileSidebar"
import { Bell, Check, Trash2, Clock, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { markAsRead, markAllAsRead, deleteNotification } from "./actions"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/context/UserContext"
import { getNotificationFilters, getNotificationPresentation, isNotificationRead, type AppNotification } from "@/lib/notifications"

type NotificationFilter = "all" | "unread" | "orders" | "wallet"

interface NotificationsClientProps {
    initialNotifications: AppNotification[]
    currentUserId: string
}

export function NotificationsClient({
    initialNotifications,
    currentUserId,
}: NotificationsClientProps) {
    const [notifications, setNotifications] = useState<AppNotification[]>(() =>
        initialNotifications.map((notification) => ({ ...notification, read: true }))
    )
    const [activeFilter, setActiveFilter] = useState<NotificationFilter>("all")
    const { refreshUnreadCount, setUnreadCountLocal } = useUser()
    const [supabase] = useState(() => createClient())
    const router = useRouter()
    const hadUnreadOnOpen = useMemo(
        () => initialNotifications.some((notification) => !isNotificationRead(notification)),
        [initialNotifications]
    )

    const markVisibleNotificationsAsRead = useCallback(async () => {
        if (!hadUnreadOnOpen) {
            await refreshUnreadCount(currentUserId)
            return
        }

        await markAllAsRead()
        await refreshUnreadCount(currentUserId)
    }, [currentUserId, hadUnreadOnOpen, refreshUnreadCount])

    const autoReadNotification = useCallback(async (notification: AppNotification) => {
        if (isNotificationRead(notification)) {
            setUnreadCountLocal(0)
            await refreshUnreadCount(currentUserId)
            return
        }

        setNotifications((current) =>
            current.map((entry) =>
                entry.id === notification.id ? { ...entry, read: true } : entry
            )
        )
        setUnreadCountLocal(0)

        const { success } = await markAsRead(notification.id)
        if (!success) {
            setNotifications((current) =>
                current.map((entry) =>
                    entry.id === notification.id ? notification : entry
                )
            )
        }
        await refreshUnreadCount(currentUserId)
    }, [currentUserId, refreshUnreadCount, setUnreadCountLocal])

    useEffect(() => {
        void markVisibleNotificationsAsRead()
    }, [markVisibleNotificationsAsRead])

    useEffect(() => {
        const channel = supabase
            .channel(`notifications-page-${currentUserId}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "notifications",
                    filter: `user_id=eq.${currentUserId}`,
                },
                (payload: RealtimePostgresChangesPayload<AppNotification>) => {
                    if (payload.eventType === "INSERT") {
                        const nextNotification = payload.new as AppNotification
                        setNotifications((current) => {
                            const filtered = current.filter((notification) => notification.id !== nextNotification.id)
                            return [{ ...nextNotification, read: true }, ...filtered]
                        })
                        void autoReadNotification(nextNotification)
                    }

                    if (payload.eventType === "UPDATE") {
                        const nextNotification = payload.new as AppNotification
                        setNotifications((current) =>
                            current.map((notification) =>
                                notification.id === nextNotification.id ? nextNotification : notification
                            )
                        )
                    }

                    if (payload.eventType === "DELETE") {
                        const previousNotification = payload.old as AppNotification
                        setNotifications((current) =>
                            current.filter((notification) => notification.id !== previousNotification.id)
                        )
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [autoReadNotification, currentUserId, supabase])

    const handleMarkAsRead = async (id: string) => {
        const { success } = await markAsRead(id)
        if (success) {
            setNotifications((current) => current.map((notification) => (
                notification.id === id ? { ...notification, read: true } : notification
            )))
            setUnreadCountLocal(0)
            await refreshUnreadCount(currentUserId)
        }
    }

    const handleMarkAllAsRead = async () => {
        const previousNotifications = notifications
        setNotifications((current) => current.map((notification) => ({ ...notification, read: true })))
        setUnreadCountLocal(0)

        const { success } = await markAllAsRead()
        if (!success) {
            setNotifications(previousNotifications)
        }
        await refreshUnreadCount(currentUserId)
    }

    const handleDelete = async (id: string) => {
        const deletedNotification = notifications.find((notification) => notification.id === id) ?? null
        const { success } = await deleteNotification(id)
        if (success) {
            setNotifications((current) => current.filter((notification) => notification.id !== id))
            if (deletedNotification && !isNotificationRead(deletedNotification)) {
                setUnreadCountLocal(0)
                await refreshUnreadCount(currentUserId)
            }
        }
    }

    const handleOpen = async (notification: AppNotification) => {
        if (!isNotificationRead(notification)) {
            await markAsRead(notification.id)
            setNotifications((current) =>
                current.map((entry) =>
                    entry.id === notification.id ? { ...entry, read: true } : entry
                )
            )
            setUnreadCountLocal(0)
            await refreshUnreadCount(currentUserId)
        }

        if (notification.action_url) {
            router.push(notification.action_url)
        }
    }

    const filterCounts = useMemo(() => getNotificationFilters(notifications), [notifications])
    const filteredNotifications = useMemo(() => {
        if (activeFilter === "unread") {
            return notifications.filter((notification) => !isNotificationRead(notification))
        }

        if (activeFilter === "orders") {
            return notifications.filter((notification) => getNotificationPresentation(notification.type).category === "order")
        }

        if (activeFilter === "wallet") {
            return notifications.filter((notification) => getNotificationPresentation(notification.type).category === "wallet")
        }

        return notifications
    }, [activeFilter, notifications])

    const filterOptions: Array<{ key: NotificationFilter; label: string; count: number }> = [
        { key: "all", label: "All", count: filterCounts.all },
        { key: "unread", label: "Unread", count: filterCounts.unread },
        { key: "orders", label: "Orders", count: filterCounts.orders },
        { key: "wallet", label: "Wallet", count: filterCounts.wallet },
    ]

    return (
        <div className="min-h-screen bg-gray-50/50 py-6 dark:bg-black sm:py-8 lg:py-12">
            <div className="container mx-auto px-4 sm:px-6">
                <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">Notifications</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 sm:text-base">View your latest alerts and messages.</p>
                    </div>
                    {notifications.some((notification) => !isNotificationRead(notification)) ? (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleMarkAllAsRead}
                            className="border-[#F58220] text-[#F58220] hover:bg-[#F58220]/10"
                        >
                            Mark all as read
                        </Button>
                    ) : null}
                </div>

                <div className="flex flex-col gap-5 sm:gap-6 lg:flex-row lg:gap-8">
                    <aside className="w-full flex-shrink-0 lg:sticky lg:top-4 lg:z-10 lg:w-80">
                        <ProfileSidebar />
                    </aside>
                    <main className="min-w-0 flex-1">
                        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                            <div className="flex gap-3 overflow-x-auto border-b border-gray-100 px-4 py-4 [scrollbar-width:none] dark:border-zinc-800 sm:flex-wrap sm:px-6 [&::-webkit-scrollbar]:hidden">
                                {filterOptions.map((filterOption) => (
                                    <button
                                        key={filterOption.key}
                                        type="button"
                                        onClick={() => setActiveFilter(filterOption.key)}
                                        className={cn(
                                            "inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition",
                                            activeFilter === filterOption.key
                                                ? "border-[#F58220] bg-[#F58220]/10 text-[#F58220]"
                                                : "border-gray-200 text-gray-600 hover:border-[#F58220]/40 hover:text-[#F58220] dark:border-zinc-700 dark:text-zinc-300"
                                        )}
                                    >
                                        <span>{filterOption.label}</span>
                                        <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs dark:bg-zinc-950">
                                            {filterOption.count}
                                        </span>
                                    </button>
                                ))}
                            </div>
                            {filteredNotifications.length === 0 ? (
                                <div className="flex min-h-[320px] flex-col items-center justify-center p-8 text-center sm:min-h-[400px] sm:p-12">
                                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-zinc-800">
                                        <Bell className="h-8 w-8" />
                                    </div>
                                    <h2 className="mb-2 text-xl font-bold text-gray-900 dark:text-white">No notifications in this view</h2>
                                    <p className="mx-auto max-w-md text-gray-500">
                                        You&apos;re caught up here. New order and wallet updates will appear live.
                                    </p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-50 dark:divide-zinc-800">
                                    {filteredNotifications.map((notification) => {
                                        const presentation = getNotificationPresentation(notification.type)
                                        const Icon = presentation.icon

                                        return (
                                            <div
                                                key={notification.id}
                                                className={cn(
                                                    "group flex gap-3 border-l-4 p-4 transition-colors sm:gap-4 sm:p-6",
                                                    isNotificationRead(notification) ? "border-l-transparent bg-transparent opacity-80" : "border-l-[#F58220] bg-[#F58220]/5",
                                                    presentation.cardClassName
                                                )}
                                            >
                                                <div className={cn(
                                                    "flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl",
                                                    presentation.iconClassName
                                                )}>
                                                    <Icon className="h-5 w-5" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="mb-1 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                        <div className="min-w-0">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <h3
                                                                    className={cn(
                                                                        "text-base font-bold sm:truncate",
                                                                        isNotificationRead(notification) ? "text-gray-600 dark:text-zinc-200" : "text-gray-900 dark:text-white"
                                                                    )}
                                                                >
                                                                    {notification.title}
                                                                </h3>
                                                                <Badge variant="outline" className={presentation.badgeClassName}>
                                                                    {presentation.label}
                                                                </Badge>
                                                                {!isNotificationRead(notification) ? (
                                                                    <Badge variant="outline" className="border-[#F58220]/30 bg-[#F58220]/10 text-[#F58220]">
                                                                        New
                                                                    </Badge>
                                                                ) : null}
                                                            </div>
                                                        </div>
                                                        <span className="flex items-center gap-1 text-xs text-gray-400 sm:whitespace-nowrap">
                                                            <Clock className="h-3 w-3" />
                                                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                                                        </span>
                                                    </div>
                                                    <p className="leading-relaxed text-sm text-gray-500 dark:text-gray-400">
                                                        {notification.message}
                                                    </p>
                                                    <div className="mt-4 flex flex-wrap items-center gap-4 opacity-100 transition-opacity md:opacity-0 group-hover:opacity-100">
                                                        {notification.action_url ? (
                                                            <button
                                                                onClick={() => handleOpen(notification)}
                                                                className="flex items-center gap-1 text-xs font-bold text-[#F58220] hover:underline"
                                                            >
                                                                <ArrowRight className="h-3 w-3" /> Open
                                                            </button>
                                                        ) : null}
                                                        {!isNotificationRead(notification) ? (
                                                            <button
                                                                onClick={() => handleMarkAsRead(notification.id)}
                                                                className="flex items-center gap-1 text-xs font-bold text-[#F58220] hover:underline"
                                                            >
                                                                <Check className="h-3 w-3" /> Mark as read
                                                            </button>
                                                        ) : null}
                                                        <button
                                                            onClick={() => handleDelete(notification.id)}
                                                            className="flex items-center gap-1 text-xs font-bold text-red-500 hover:underline"
                                                        >
                                                            <Trash2 className="h-3 w-3" /> Delete
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </main>
                </div>
            </div>
        </div>
    )
}
