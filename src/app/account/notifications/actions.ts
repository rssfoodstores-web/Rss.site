"use client"

import { createClient } from "@/lib/supabase/client"
import type { AppNotification } from "@/lib/notifications"

export async function getNotifications() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { notifications: [], error: "Not authenticated" }

    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    return { notifications: (data || []) as AppNotification[], error }
}

export async function markAsRead(id: string) {
    const supabase = createClient()
    const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id)

    return { success: !error, error }
}

export async function markAllAsRead() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { success: false, error: "Not authenticated" }

    const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false)

    return { success: !error, error }
}

export async function deleteNotification(id: string) {
    const supabase = createClient()
    const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id)

    return { success: !error, error }
}
