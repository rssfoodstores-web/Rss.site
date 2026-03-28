"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import { type Session, type User } from "@supabase/supabase-js"
import { buildNotificationPathCounts } from "@/lib/notifications"
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
    notificationPathCounts: Record<string, number>
    isLoading: boolean
    refreshProfile: () => Promise<void>
    refreshUnreadCount: (targetUserId?: string) => Promise<void>
    setUnreadCountLocal: (count: number) => void
}

const UserContext = createContext<UserContextType | undefined>(undefined)

interface UserRoleRow {
    role: string
}

function isAbortLike(error: unknown) {
    return error instanceof Error && (error.name === "AbortError" || error.message.includes("aborted"))
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
    const [unreadCount, setUnreadCount] = useState(0)
    const [notificationPathCounts, setNotificationPathCounts] = useState<Record<string, number>>({})
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

    const refreshUnreadCount = useCallback(async (targetUserId?: string) => {
        const nextUserId = targetUserId ?? user?.id

        if (!nextUserId) {
            setUnreadCount(0)
            setNotificationPathCounts({})
            return
        }

        const { data, error } = await supabase
            .from("notifications")
            .select("action_url")
            .eq("user_id", nextUserId)
            .eq("read", false)

        if (error) {
            console.error("Error refreshing unread count:", error)
            return
        }

        const unreadNotifications = data ?? []
        setUnreadCount(unreadNotifications.length)
        setNotificationPathCounts(buildNotificationPathCounts(unreadNotifications))
    }, [supabase, user?.id])

    const resetUserState = useCallback(() => {
        setProfile(null)
        setRoleNames([])
        setWorkspaceStatuses({ merchant: null, agent: null, rider: null })
        setRoles({ isMerchant: false, isAgent: false, isRider: false, isAdmin: false })
        setUnreadCount(0)
        setNotificationPathCounts({})
        localStorage.removeItem("rssa_user_profile")
    }, [])

    const fetchUserData = useCallback(async (currentUser: User) => {
        try {
            // Parallelize fetching of dependent data
            const [profileResult, rolesResult, notificationsResult, merchantResult, agentResult, riderResult] = await Promise.all([
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

                // 3. Fetch Notifications Count
                supabase
                    .from('notifications')
                    .select('action_url')
                    .eq('user_id', currentUser.id)
                    .eq('read', false),

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

            // Process Notifications
            const unreadNotifications = notificationsResult.data ?? []
            setUnreadCount(unreadNotifications.length)
            setNotificationPathCounts(buildNotificationPathCounts(unreadNotifications))

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
                void refreshUnreadCount(user.id)
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
    }, [refreshUnreadCount, supabase, user?.id])

    const refreshProfile = useCallback(async () => {
        if (user) {
            await fetchUserData(user)
        }
    }, [fetchUserData, user])

    return (
        <UserContext.Provider value={{ user, profile, roleNames, workspaceStatuses, roles, unreadCount, notificationPathCounts, isLoading, refreshProfile, refreshUnreadCount, setUnreadCountLocal: setUnreadCount }}>
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
