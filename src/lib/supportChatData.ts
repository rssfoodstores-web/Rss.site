import "server-only"

import { createClient } from "@/lib/supabase/server"
import {
    DEFAULT_SUPPORT_AI_SETTINGS,
    normalizeSupportAISettings,
    normalizeSupportConversationSnapshot,
    type SupportChatBootstrap,
} from "@/lib/supportChat"

export async function getSupportChatBootstrap(): Promise<SupportChatBootstrap> {
    const supabase = await createClient()
    const [{ data: settingsData }, { data: authData }] = await Promise.all([
        supabase.rpc("get_support_ai_settings"),
        supabase.auth.getUser(),
    ])

    const user = authData.user
    const settings = normalizeSupportAISettings(settingsData ?? DEFAULT_SUPPORT_AI_SETTINGS)

    let currentUser = {
        email: user?.email?.trim() ?? "",
        id: user?.id ?? null,
        isAuthenticated: Boolean(user),
        name: "",
        phone: "",
    }

    let initialSnapshot = null

    if (user) {
        const [{ data: profile }, { data: latestConversation }] = await Promise.all([
            supabase
                .from("profiles")
                .select("full_name, phone")
                .eq("id", user.id)
                .maybeSingle(),
            supabase
                .from("support_conversations")
                .select("id")
                .eq("user_id", user.id)
                .order("last_message_at", { ascending: false })
                .limit(1)
                .maybeSingle(),
        ])

        currentUser = {
            email: user.email?.trim() ?? "",
            id: user.id,
            isAuthenticated: true,
            name: profile?.full_name?.trim() ?? user.user_metadata?.full_name?.trim() ?? "",
            phone: profile?.phone?.trim() ?? user.phone?.trim() ?? "",
        }

        if (latestConversation?.id) {
            const { data: snapshotData } = await supabase.rpc("get_support_conversation_snapshot", {
                p_access_token: null,
                p_conversation_id: latestConversation.id,
            })

            initialSnapshot = normalizeSupportConversationSnapshot(snapshotData)
        }
    }

    return {
        currentUser,
        initialSnapshot,
        settings,
    }
}
