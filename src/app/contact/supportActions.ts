"use server"

import { createClient } from "@/lib/supabase/server"
import { generateSupportAssistantDecision } from "@/lib/geminiSupport"
import {
    type SupportConversationSnapshot,
} from "@/lib/supportChat"
import {
    appendSupportHandoffMessage,
    buildSupportAssistantContext,
    fetchSupportConversationSnapshot,
    getSupportAiSettings,
} from "@/lib/supportChatServer"

interface SubmitSupportChatTurnInput {
    accessToken?: string | null
    conversationId?: string | null
    email: string
    message: string
    name: string
    phone?: string | null
    subject?: string | null
}

interface SubmitSupportChatTurnResult {
    accessToken: string | null
    snapshot: SupportConversationSnapshot
}

export interface ContactSupportFormState {
    error: string | null
    success: string | null
}

function normalizeConversationStartPayload(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("Support conversation could not be created.")
    }

    const payload = value as Record<string, unknown>
    const conversationId = typeof payload.conversationId === "string" ? payload.conversationId : ""
    const accessToken = typeof payload.accessToken === "string" ? payload.accessToken : ""

    if (!conversationId) {
        throw new Error("Support conversation could not be created.")
    }

    return {
        accessToken: accessToken || null,
        conversationId,
    }
}

async function appendAssistantDecision({
    accessToken,
    conversationId,
    fallbackMessage,
    shouldEscalate,
}: {
    accessToken: string | null
    conversationId: string
    fallbackMessage: string
    shouldEscalate: boolean
}) {
    const supabase = await createClient()

    await appendSupportHandoffMessage(supabase, {
        accessToken,
        conversationId,
        handoffMessage: fallbackMessage,
        metadata: {
            type: shouldEscalate ? "handoff" : "ai_unavailable",
        },
    })
}

export async function submitSupportChatTurn(input: SubmitSupportChatTurnInput): Promise<SubmitSupportChatTurnResult> {
    const supabase = await createClient()
    const [{ data: authData }, settings] = await Promise.all([
        supabase.auth.getUser(),
        getSupportAiSettings(supabase),
    ])

    let conversationId = input.conversationId?.trim() || ""
    let accessToken = input.accessToken?.trim() || null

    if (conversationId) {
        const { error } = await supabase.rpc("append_support_customer_message", {
            p_access_token: accessToken ?? "",
            p_conversation_id: conversationId,
            p_message: input.message,
        })

        if (error) {
            throw new Error(error.message)
        }
    } else {
        const { data, error } = await supabase.rpc("start_support_conversation", {
            p_channel: "contact_page",
            p_email: input.email,
            p_initial_message: input.message,
            p_name: input.name,
            p_phone: input.phone?.trim() || null,
            p_subject: input.subject?.trim() || null,
        })

        if (error) {
            throw new Error(error.message)
        }

        const payload = normalizeConversationStartPayload(data)
        conversationId = payload.conversationId
        accessToken = payload.accessToken
    }

    let snapshot = await fetchSupportConversationSnapshot(supabase, conversationId, accessToken)

    const hasNonCustomerReply = snapshot.messages.some((message) => message.senderRole !== "customer")
    const aiUnavailable = !settings.enabled || !snapshot.conversation.aiEnabledSnapshot

    if (aiUnavailable) {
        if (!hasNonCustomerReply) {
            await appendAssistantDecision({
                accessToken,
                conversationId,
                fallbackMessage: settings.handoffMessage,
                shouldEscalate: true,
            })

            snapshot = await fetchSupportConversationSnapshot(supabase, conversationId, accessToken)
        }

        return {
            accessToken,
            snapshot,
        }
    }

    if (snapshot.conversation.status === "human_follow_up") {
        return {
            accessToken,
            snapshot,
        }
    }

    try {
        const assistantContext = await buildSupportAssistantContext(supabase, authData.user)
        const decision = await generateSupportAssistantDecision({
            context: assistantContext,
            message: input.message,
            settings,
            snapshot,
        })

        const { error } = await supabase.rpc("append_support_assistant_message", {
            p_access_token: accessToken ?? "",
            p_ai_generated: true,
            p_body: decision.reply || settings.handoffMessage,
            p_conversation_id: conversationId,
            p_metadata: {
                suggestedLinks: decision.suggestedLinks,
                topic: decision.topic,
            },
            p_resolved_by_ai: decision.resolved,
            p_response_time_ms: decision.responseTimeMs,
            p_sender_role: "assistant",
            p_should_escalate: decision.shouldEscalate,
        })

        if (error) {
            throw new Error(error.message)
        }
    } catch (error) {
        console.error("Support AI failed:", error)
        await appendAssistantDecision({
            accessToken,
            conversationId,
            fallbackMessage: settings.handoffMessage,
            shouldEscalate: true,
        })
    }

    return {
        accessToken,
        snapshot: await fetchSupportConversationSnapshot(supabase, conversationId, accessToken),
    }
}

export async function submitContactSupportForm(
    prevState: ContactSupportFormState,
    formData: FormData
): Promise<ContactSupportFormState> {
    const firstName = String(formData.get("first_name") ?? "").trim()
    const lastName = String(formData.get("last_name") ?? "").trim()
    const email = String(formData.get("email") ?? "").trim().toLowerCase()
    const message = String(formData.get("message") ?? "").trim()
    const name = [firstName, lastName].filter(Boolean).join(" ").trim()

    if (name.length < 2) {
        return {
            error: "Please enter your first and last name.",
            success: null,
        }
    }

    if (!email) {
        return {
            error: "Please enter your email address.",
            success: null,
        }
    }

    if (message.length < 2) {
        return {
            error: "Please enter your message before sending.",
            success: null,
        }
    }

    try {
        const supabase = await createClient()
        const { error } = await supabase.rpc("start_support_conversation", {
            p_channel: "contact_page",
            p_email: email,
            p_initial_message: message,
            p_name: name,
            p_subject: "Contact form submission",
        })

        if (error) {
            throw new Error(error.message)
        }

        return {
            error: null,
            success: "Your message has been sent. The admin team can now see it in their dashboard.",
        }
    } catch (error) {
        console.error("Contact support form submission failed:", error)
        return {
            error: error instanceof Error ? error.message : "We could not send your message right now.",
            success: null,
        }
    }
}
