import "server-only"

import type { SupportAISettings, SupportConversationSnapshot, SupportSuggestedLink } from "@/lib/supportChat"

interface SupportContextOrder {
    createdAt: string | null
    id: string
    paymentStatus: string
    status: string | null
    totalAmountKobo: number
}

interface SupportContextRewardBalance {
    availablePoints: number
    pendingPoints: number
}

interface SupportAssistantContext {
    customer: {
        email: string
        isAuthenticated: boolean
        name: string
        phone: string | null
    }
    giftCards: {
        activeCount: number
        totalRemainingKobo: number
    }
    recentOrders: SupportContextOrder[]
    rewards: SupportContextRewardBalance | null
}

export interface SupportAssistantDecision {
    reply: string
    resolved: boolean
    responseTimeMs: number
    shouldEscalate: boolean
    suggestedLinks: SupportSuggestedLink[]
    topic: string
}

const MAX_HISTORY_MESSAGES = 10

function extractResponseText(payload: unknown) {
    if (!payload || typeof payload !== "object") {
        return ""
    }

    const candidates = "candidates" in payload && Array.isArray(payload.candidates)
        ? payload.candidates
        : []

    return candidates
        .flatMap((candidate) => {
            if (!candidate || typeof candidate !== "object" || !("content" in candidate)) {
                return []
            }

            const content = candidate.content
            if (!content || typeof content !== "object" || !("parts" in content) || !Array.isArray(content.parts)) {
                return []
            }

            return content.parts
                .map((part: unknown) => (part && typeof part === "object" && "text" in part && typeof part.text === "string") ? part.text : "")
                .filter(Boolean)
        })
        .join("\n")
        .trim()
}

function normalizeReplyText(value: unknown) {
    if (typeof value !== "string") {
        return ""
    }

    return value.trim().replace(/\s{3,}/g, "\n\n").slice(0, 1500)
}

function normalizeTopic(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim().slice(0, 80) : "general_support"
}

function sanitizeSuggestedLinks(value: unknown) {
    if (!Array.isArray(value)) {
        return []
    }

    return value
        .map((item) => {
            if (!item || typeof item !== "object") {
                return null
            }

            const label = "label" in item && typeof item.label === "string" ? item.label.trim().slice(0, 48) : ""
            const url = "url" in item && typeof item.url === "string" ? item.url.trim() : ""

            if (!label || !url || !url.startsWith("/") || url.startsWith("//") || url.length > 160) {
                return null
            }

            return { label, url }
        })
        .filter((item): item is SupportSuggestedLink => Boolean(item))
        .slice(0, 3)
}

function parseDecision(rawText: string, defaultReply: string): Omit<SupportAssistantDecision, "responseTimeMs"> {
    const trimmed = rawText.trim()
    const normalizedJson = trimmed.startsWith("```")
        ? trimmed.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim()
        : trimmed

    let parsed: Record<string, unknown> | null = null

    try {
        const value = JSON.parse(normalizedJson)
        parsed = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null
    } catch {
        parsed = null
    }

    if (!parsed) {
        return {
            reply: defaultReply,
            resolved: false,
            shouldEscalate: true,
            suggestedLinks: [{ label: "Contact page", url: "/contact" }],
            topic: "human_follow_up",
        }
    }

    const reply = normalizeReplyText(parsed.reply) || defaultReply
    const shouldEscalate = typeof parsed.shouldEscalate === "boolean" ? parsed.shouldEscalate : false
    const resolved = shouldEscalate ? false : typeof parsed.resolved === "boolean" ? parsed.resolved : false

    return {
        reply,
        resolved,
        shouldEscalate,
        suggestedLinks: sanitizeSuggestedLinks(parsed.suggestedLinks),
        topic: normalizeTopic(parsed.topic),
    }
}

function buildConversationTranscript(snapshot: SupportConversationSnapshot) {
    return snapshot.messages
        .slice(-MAX_HISTORY_MESSAGES)
        .map((message) => `${message.senderRole.toUpperCase()}: ${message.body}`)
        .join("\n")
}

function buildPrompt({
    context,
    message,
    settings,
    snapshot,
}: {
    context: SupportAssistantContext
    message: string
    settings: SupportAISettings
    snapshot: SupportConversationSnapshot
}) {
    return [
        settings.systemPrompt,
        "Return only valid JSON with this exact shape:",
        "{\"reply\":\"string\",\"shouldEscalate\":boolean,\"resolved\":boolean,\"topic\":\"string\",\"suggestedLinks\":[{\"label\":\"string\",\"url\":\"/internal-path\"}]}",
        "Rules:",
        "- Keep replies concise, practical, and calm.",
        "- Never invent live order statuses, product stock, payment confirmations, or refund outcomes.",
        "- If the request needs manual investigation, account recovery, refunds, failed payment review, merchant-only action, or anything uncertain, set shouldEscalate=true.",
        "- Use only internal relative URLs in suggestedLinks.",
        "- If the user asks about orders, reference the real order summary when available.",
        "- If the user needs checkout help, reward guidance, or gift card guidance, give direct steps.",
        "Useful routes: /account/orders, /account/rewards, /account/gift-card, /account/wallet, /cart, /products, /discount-bundles, /cook-off, /contact, /faqs, /login, /register",
        `Conversation summary:\n${JSON.stringify({
            conversation: snapshot.conversation,
            context,
            transcript: buildConversationTranscript(snapshot),
            latestUserMessage: message,
        }, null, 2)}`,
    ].join("\n\n")
}

export async function generateSupportAssistantDecision({
    context,
    message,
    settings,
    snapshot,
}: {
    context: SupportAssistantContext
    message: string
    settings: SupportAISettings
    snapshot: SupportConversationSnapshot
}): Promise<SupportAssistantDecision> {
    const apiKey = process.env.GEMINI_API_KEY?.trim()
    const defaultReply = settings.handoffMessage

    if (!apiKey) {
        return {
            reply: defaultReply,
            resolved: false,
            responseTimeMs: 0,
            shouldEscalate: true,
            suggestedLinks: [{ label: "Contact page", url: "/contact" }],
            topic: "human_follow_up",
        }
    }

    const startedAt = Date.now()
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(settings.model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            {
                                text: buildPrompt({ context, message, settings, snapshot }),
                            },
                        ],
                    },
                ],
                generationConfig: {
                    responseMimeType: "application/json",
                    temperature: 0.2,
                },
            }),
        }
    )

    const responseTimeMs = Date.now() - startedAt

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Gemini request failed: ${response.status} ${errorText}`)
    }

    const payload = await response.json()
    const rawText = extractResponseText(payload)
    const decision = parseDecision(rawText, defaultReply)

    return {
        ...decision,
        responseTimeMs,
    }
}
