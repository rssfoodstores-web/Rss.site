"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, Suspense, ReactNode } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { type Session, type User } from "@supabase/supabase-js"
import { buildNotificationPathCounts, matchesNotificationDestination } from "@/lib/notifications"
import { createEmptyProfileRow } from "@/lib/profile"

interface UserProfile {
    id: string
    full_name: string | null
    state: string | null
    phone: string | null
    avatar_url: string | null
    address?: string | null
    location?: unknown | null
}

interface UserContextType {
    user: User | null
    profile: UserProfile | null
    roleNames: string[]
    workspaceStatuses: {
        merchant: string | null
        agent: string | null
        rider: string | null
    }
    roles: {
        isMerchant: boolean
        isAgent: boolean
        isRider: boolean
        isAdmin: boolean
    }
    unreadCount: number
    unreadNotificationIds: ReadonlySet<string> | null
    notificationPathCounts: Record<string, number>
    isLoading: boolean
    refreshProfile: () => Promise<void>
    refreshUnreadCount: (targetUserId?: string) => Promise<void>
    markNotificationsRead: (ids: string[]) => Promise<boolean>
}

const UserContext = createContext<UserContextType | undefined>(undefined)

interface UserRoleRow {
    role: string
}

function isAbortLike(error: unknown) {
    return error instanceof Error && (error.name === "AbortError" || error.message.includes("aborted"))
}

type UnreadNotification = { id: string; action_url: string | null; type: string | null }

function NotificationRouteObserver({ onVisit }: { onVisit: (url: string) => void }) {
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const search = searchParams.toString()

    useEffect(() => {
        if (pathname) onVisit(window.location.href)
        const handleHash = () => onVisit(window.location.href)
        window.addEventListener("hashchange", handleHash)
        return () => window.removeEventListener("hashchange", handleHash)
    }, [onVisit, pathname, search])

    return null
}

export function UserProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [profile, setProfile] = useState<UserProfile | null>(null)
    const [roleNames, setRoleNames] = useState<string[]>([])
    const [workspaceStatuses, setWorkspaceStatuses] = useState({
        merchant: null as string | null,
        agent: null as string | null,
        rider: null as string | null,
    })
    const [roles, setRoles] = useState({ isMerchant: false, isAgent: false, isRider: false, isAdmin: false })
    const [unreadNotifications, setUnreadNotifications] = useState<UnreadNotification[] | null>(null)
    const unreadRevision = useRef(0)
    const [isLoading, setIsLoading] = useState(true)

    const [supabase] = useState(() => createClient())
    const unreadRefreshTimeoutRef = useRef<number | null>(null)
    const authRefreshTimeoutRef = useRef<number | null>(null)

    // Load cached profile from localStorage on mount (Optimistic Load)
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const cached = localStorage.getItem("rssa_user_profile")
            if (cached) {
                try {
                    setProfile(JSON.parse(cached))
                } catch (e) {
                    console.error("Failed to parse cached profile", e)
                }
            }
        }
    }, [])

    const fetchUnreadNotifications = useCallback(async (userId: string) => {
        const { data, error } = await supabase.from("notifications")
            .select("id,action_url,type").eq("user_id", userId).or("read.is.null,read.eq.false")
        if (error) {
            console.error("Error refreshing unread notifications:", error)
            return null
        }
        return (data ?? []) as UnreadNotification[]
    }, [supabase])

    const refreshUnreadCount = useCallback(async (targetUserId?: string) => {
        const userId = targetUserId ?? user?.id
        const revision = ++unreadRevision.current
        if (!userId) {
            setUnreadNotifications(null)
            return
        }

        const rows = await fetchUnreadNotifications(userId)
        if (rows && revision === unreadRevision.current) setUnreadNotifications(rows)
    }, [fetchUnreadNotifications, user?.id])

    const markNotificationsRead = useCallback(async (ids: string[]) => {
        if (!user?.id || ids.length === 0) return false

        const { data, error } = await supabase.from("notifications").update({ read: true })
            .eq("user_id", user.id).in("id", ids).or("read.is.null,read.eq.false").select("id")
        if (error) {
            console.error("Error marking notifications as read:", error)
            return false
        }

        ++unreadRevision.current
        const readIds = new Set((data ?? []).map((row: { id: string }) => row.id))
        setUnreadNotifications((rows) => rows?.filter((row) => !readIds.has(row.id)) ?? null)
        if (readIds.size !== ids.length) await refreshUnreadCount(user.id)
        return readIds.size > 0
    }, [refreshUnreadCount, supabase, user?.id])

    const visitNotificationDestination = useCallback(async (url: string) => {
        if (!user?.id) return
        const revision = ++unreadRevision.current
        const rows = await fetchUnreadNotifications(user.id)
        if (!rows || revision !== unreadRevision.current) return

        const pathname = new URL(url).pathname
        const ids = pathname === "/account/notifications" ? [] : rows
            .filter((row) => row.type !== "order_message" && matchesNotificationDestination(url, row.action_url)).map((row) => row.id)
        setUnreadNotifications(rows)
        if (ids.length && window.location.href === url) {
            await markNotificationsRead(ids)
        }
    }, [fetchUnreadNotifications, markNotificationsRead, user?.id])

    const resetUserState = useCallback(() => {
        setProfile(null)
        setRoleNames([])
        setWorkspaceStatuses({ merchant: null, agent: null, rider: null })
        setRoles({ isMerchant: false, isAgent: false, isRider: false, isAdmin: false })
        ++unreadRevision.current
        setUnreadNotifications(null)
        localStorage.removeItem("rssa_user_profile")
    }, [])

    const fetchUserData = useCallback(async (currentUser: User) => {
        try {
            // Parallelize fetching of dependent data
            const [profileResult, rolesResult, merchantResult, agentResult, riderResult] = await Promise.all([
                // 1. Fetch Profile
                supabase
                    .from('profiles')
                    .select('id, full_name, state, phone, avatar_url, address, location')
                    .eq('id', currentUser.id)
                    .maybeSingle(),

                // 2. Fetch Roles
                supabase
                    .from('user_roles')
                    .select('role')
                    .eq('user_id', currentUser.id),

                supabase
                    .from('merchants')
                    .select('status')
                    .eq('id', currentUser.id)
                    .maybeSingle(),

                supabase
                    .from('agent_profiles')
                    .select('status')
                    .eq('id', currentUser.id)
                    .maybeSingle(),

                supabase
                    .from('rider_profiles')
                    .select('status')
                    .eq('id', currentUser.id)
                    .maybeSingle(),
            ])

            // Process Profile
            if (profileResult.error) {
                console.error("Error fetching profile data:", profileResult.error)
            }

            const nextProfile = profileResult.data ?? createEmptyProfileRow(
                currentUser.id,
                currentUser.user_metadata?.full_name || currentUser.email?.split("@")[0] || "Customer"
            )

            if (nextProfile) {
                setProfile(nextProfile)
                localStorage.setItem("rssa_user_profile", JSON.stringify(nextProfile))
            }

            // Process Roles
            const merchantProfile = merchantResult.data
            const agentProfile = agentResult.data
            const riderProfile = riderResult.data
            const merchantStatus = merchantProfile?.status ?? null
            const agentStatus = agentProfile?.status ?? null
            const riderStatus = riderProfile?.status ?? null
            const rawRoleNames = (rolesResult.data ?? []).map((roleRow: UserRoleRow) => roleRow.role)
            const derivedRoleNames = Array.from(
                new Set([
                    ...rawRoleNames,
                    ...(merchantProfile ? ["merchant"] : []),
                    ...(agentProfile ? ["agent"] : []),
                    ...(riderProfile ? ["rider"] : []),
                ])
            )
            const userRoles = {
                isMerchant: derivedRoleNames.includes("merchant"),
                isAgent: derivedRoleNames.includes("agent"),
                isRider: derivedRoleNames.includes("rider"),
                isAdmin: rawRoleNames.some((role: string) => ['admin', 'supa_admin', 'sub_admin'].includes(role)),
            }

            setRoles(userRoles)
            setRoleNames(derivedRoleNames)
            setWorkspaceStatuses({
                merchant: merchantStatus,
                agent: agentStatus,
                rider: riderStatus,
            })

        } catch (error: unknown) {
            if (isAbortLike(error)) {
                return
            }
            console.error("Error fetching user data:", error)
        }
    }, [supabase])

    useEffect(() => {
        let mounted = true

        const initAuth = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser()

                if (mounted) {
                    setUser(user)
                    if (user) {
                        await fetchUserData(user)
                    } else {
                        resetUserState()
                    }
                }
            } catch (error: unknown) {
                // Ignore AbortError / cancellation errors which are common in React Strict Mode
                if (isAbortLike(error)) {
                    return
                }
                console.error("Auth check failed:", error)
            } finally {
                if (mounted) setIsLoading(false)
            }
        }

        initAuth()

        // Auth State Listener
        const { data: authListener } = supabase.auth.onAuthStateChange((event: string, session: Session | null) => {
            if (!mounted) {
                return
            }

            if (session?.user) {
                setUser(session.user)

                if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
                    if (authRefreshTimeoutRef.current !== null) {
                        window.clearTimeout(authRefreshTimeoutRef.current)
                    }

                    // Run after the auth callback returns so Supabase can release its internal auth lock first.
                    authRefreshTimeoutRef.current = window.setTimeout(() => {
                        authRefreshTimeoutRef.current = null

                        if (mounted) {
                            void fetchUserData(session.user)
                        }
                    }, 0)
                }
            } else if (event === 'SIGNED_OUT') {
                setUser(null)
                resetUserState()
            }
        })

        return () => {
            mounted = false
            if (authRefreshTimeoutRef.current !== null) {
                window.clearTimeout(authRefreshTimeoutRef.current)
                authRefreshTimeoutRef.current = null
            }
            authListener.subscription.unsubscribe()
        }
    }, [fetchUserData, resetUserState, supabase])

    useEffect(() => {
        if (!user?.id) {
            return
        }

        const scheduleUnreadRefresh = () => {
            if (unreadRefreshTimeoutRef.current !== null) {
                window.clearTimeout(unreadRefreshTimeoutRef.current)
            }

            unreadRefreshTimeoutRef.current = window.setTimeout(() => {
                unreadRefreshTimeoutRef.current = null
                void visitNotificationDestination(window.location.href)
            }, 100)
        }

        const channel = supabase
            .channel(`user-notifications-${user.id}`)
            .on("postgres_changes", {
                event: "*",
                schema: "public",
                table: "notifications",
                filter: `user_id=eq.${user.id}`,
            }, scheduleUnreadRefresh)
            .subscribe()

        return () => {
            if (unreadRefreshTimeoutRef.current !== null) {
                window.clearTimeout(unreadRefreshTimeoutRef.current)
                unreadRefreshTimeoutRef.current = null
            }
            supabase.removeChannel(channel)
        }
    }, [supabase, user?.id, visitNotificationDestination])

    const refreshProfile = useCallback(async () => {
        if (user) {
            await fetchUserData(user)
        }
    }, [fetchUserData, user])

    const unreadNotificationIds = useMemo(() => unreadNotifications
        ? new Set(unreadNotifications.map((row) => row.id))
        : null, [unreadNotifications])

    return (
        <UserContext.Provider value={{ user, profile, roleNames, workspaceStatuses, roles, unreadCount: unreadNotifications?.length ?? 0, unreadNotificationIds, notificationPathCounts: buildNotificationPathCounts(unreadNotifications ?? []), isLoading, refreshProfile, refreshUnreadCount, markNotificationsRead }}>
            <Suspense fallback={null}><NotificationRouteObserver onVisit={visitNotificationDestination} /></Suspense>
            {children}
        </UserContext.Provider>
    )
}

export function useUser() {
    const context = useContext(UserContext)
    if (context === undefined) {
        throw new Error("useUser must be used within a UserProvider")
    }
    return context
}
