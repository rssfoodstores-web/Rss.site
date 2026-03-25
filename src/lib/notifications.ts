import type { LucideIcon } from "lucide-react"
import {
    AlertTriangle,
    Bell,
    Box,
    CreditCard,
    Gift,
    MessageSquare,
    PackageCheck,
    Truck,
    Users,
    Wallet,
} from "lucide-react"
import type { Database } from "@/types/database.types"

export type AppNotification = Database["public"]["Tables"]["notifications"]["Row"]

const exactOnlyNotificationHrefs = new Set(["/account", "/merchant", "/agent", "/rider"])

export interface NotificationPresentation {
    category: "order" | "wallet" | "system"
    label: string
    icon: LucideIcon
    iconClassName: string
    badgeClassName: string
    cardClassName: string
}

export function getNotificationPresentation(type: string | null | undefined): NotificationPresentation {
    if (!type) {
        return {
            category: "system",
            label: "System",
            icon: Bell,
            iconClassName: "bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-200",
            badgeClassName: "border-gray-200 bg-gray-50 text-gray-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
            cardClassName: "border-gray-100 dark:border-zinc-800",
        }
    }

    if (type.startsWith("gift_card")) {
        return {
            category: "wallet",
            label: "Gift Card",
            icon: Gift,
            iconClassName: "bg-violet-100 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300",
            badgeClassName: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-300",
            cardClassName: "border-violet-100 dark:border-violet-900/40",
        }
    }

    if (type?.startsWith("cook_off")) {
        return {
            category: "system",
            label: "Cook-Off",
            icon: Gift,
            iconClassName: "bg-orange-100 text-[#F58220] dark:bg-orange-950/30 dark:text-orange-300",
            badgeClassName: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-300",
            cardClassName: "border-orange-100 dark:border-orange-900/40",
        }
    }

    if (type === "referral_reward") {
        return {
            category: "wallet",
            label: "Referral",
            icon: Users,
            iconClassName: "bg-orange-100 text-[#F58220] dark:bg-orange-950/30 dark:text-orange-300",
            badgeClassName: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-300",
            cardClassName: "border-orange-100 dark:border-orange-900/40",
        }
    }

    if (type.startsWith("wallet")) {
        const isIssue = type === "wallet_issue"

        return {
            category: "wallet",
            label: isIssue ? "Wallet issue" : "Wallet",
            icon: isIssue ? AlertTriangle : Wallet,
            iconClassName: isIssue
                ? "bg-red-100 text-red-600 dark:bg-red-950/30 dark:text-red-300"
                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
            badgeClassName: isIssue
                ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
                : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300",
            cardClassName: isIssue ? "border-red-100 dark:border-red-900/40" : "border-emerald-100 dark:border-emerald-900/40",
        }
    }

    if (type === "dispatch_update" || type === "rider_assignment") {
        return {
            category: "order",
            label: "Dispatch",
            icon: Truck,
            iconClassName: "bg-orange-100 text-[#F58220] dark:bg-orange-950/30 dark:text-orange-300",
            badgeClassName: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-300",
            cardClassName: "border-orange-100 dark:border-orange-900/40",
        }
    }

    if (type === "order_update" || type === "order_assignment") {
        return {
            category: "order",
            label: "Order",
            icon: PackageCheck,
            iconClassName: "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300",
            badgeClassName: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300",
            cardClassName: "border-blue-100 dark:border-blue-900/40",
        }
    }

    if (type === "order_message") {
        return {
            category: "order",
            label: "Message",
            icon: MessageSquare,
            iconClassName: "bg-orange-100 text-[#F58220] dark:bg-orange-950/30 dark:text-orange-300",
            badgeClassName: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-300",
            cardClassName: "border-orange-100 dark:border-orange-900/40",
        }
    }

    if (type === "order_issue") {
        return {
            category: "order",
            label: "Issue",
            icon: AlertTriangle,
            iconClassName: "bg-red-100 text-red-600 dark:bg-red-950/30 dark:text-red-300",
            badgeClassName: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300",
            cardClassName: "border-red-100 dark:border-red-900/40",
        }
    }

    if (type === "wallet_pending") {
        return {
            category: "wallet",
            label: "Finance",
            icon: CreditCard,
            iconClassName: "bg-violet-100 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300",
            badgeClassName: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-300",
            cardClassName: "border-violet-100 dark:border-violet-900/40",
        }
    }

    return {
        category: "system",
        label: "System",
        icon: Box,
        iconClassName: "bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-200",
        badgeClassName: "border-gray-200 bg-gray-50 text-gray-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
        cardClassName: "border-gray-100 dark:border-zinc-800",
    }
}

export function isNotificationRead(notification: Pick<AppNotification, "read"> | null | undefined) {
    return Boolean(notification?.read)
}

export function normalizeNotificationPath(path: string | null | undefined) {
    if (!path) {
        return null
    }

    const [normalizedPath] = path.split(/[?#]/)
    const trimmedPath = normalizedPath?.trim()

    if (!trimmedPath) {
        return null
    }

    if (trimmedPath.length > 1) {
        return trimmedPath.replace(/\/+$/, "")
    }

    return trimmedPath
}

export function matchesNotificationPath(pathname: string | null | undefined, href: string) {
    const normalizedPath = normalizeNotificationPath(pathname)
    const normalizedHref = normalizeNotificationPath(href)

    if (!normalizedPath || !normalizedHref) {
        return false
    }

    if (exactOnlyNotificationHrefs.has(normalizedHref)) {
        return normalizedPath === normalizedHref
    }

    return normalizedPath === normalizedHref || normalizedPath.startsWith(`${normalizedHref}/`)
}

export function buildNotificationPathCounts(notifications: Array<{ action_url: string | null }>) {
    return notifications.reduce<Record<string, number>>((counts, notification) => {
        const normalizedPath = normalizeNotificationPath(notification.action_url)

        if (!normalizedPath) {
            return counts
        }

        counts[normalizedPath] = (counts[normalizedPath] ?? 0) + 1
        return counts
    }, {})
}

export function getNotificationCountForHrefs(hrefs: string[], pathCounts: Record<string, number>) {
    const uniqueHrefs = Array.from(
        new Set(
            hrefs
                .map((href) => normalizeNotificationPath(href))
                .filter((href): href is string => Boolean(href))
        )
    )

    if (uniqueHrefs.length === 0) {
        return 0
    }

    return Object.entries(pathCounts).reduce((total, [path, count]) => {
        if (uniqueHrefs.some((href) => matchesNotificationPath(path, href))) {
            return total + count
        }

        return total
    }, 0)
}

export function getNotificationFilters(notifications: AppNotification[]) {
    return {
        all: notifications.length,
        unread: notifications.filter((notification) => !isNotificationRead(notification)).length,
        orders: notifications.filter((notification) => getNotificationPresentation(notification.type).category === "order").length,
        wallet: notifications.filter((notification) => getNotificationPresentation(notification.type).category === "wallet").length,
    }
}
