import "server-only"

import { unstable_noStore as noStore } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import {
    DEFAULT_FAQ_PAGE_CONTENT,
    DEFAULT_PRIVACY_PAGE_CONTENT,
    DEFAULT_TERMS_PAGE_CONTENT,
    FAQ_PAGE_SETTING_KEY,
    PRIVACY_PAGE_SETTING_KEY,
    TERMS_PAGE_SETTING_KEY,
    normalizeDocumentPageContent,
    normalizeFaqPageContent,
    type DocumentPageContent,
    type FaqPageContent,
} from "@/lib/contentPages"

async function getAppSettingValue(key: string) {
    noStore()

    const supabase = await createClient()
    const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", key)
        .maybeSingle()

    if (error) {
        console.error(`Unable to load app setting for ${key}:`, error)
        return null
    }

    return data?.value ?? null
}

export async function getFaqPageContent(): Promise<FaqPageContent> {
    const value = await getAppSettingValue(FAQ_PAGE_SETTING_KEY)
    return normalizeFaqPageContent(value ?? DEFAULT_FAQ_PAGE_CONTENT)
}

export async function getTermsPageContent(): Promise<DocumentPageContent> {
    const value = await getAppSettingValue(TERMS_PAGE_SETTING_KEY)
    return normalizeDocumentPageContent(value ?? DEFAULT_TERMS_PAGE_CONTENT, DEFAULT_TERMS_PAGE_CONTENT)
}

export async function getPrivacyPageContent(): Promise<DocumentPageContent> {
    const value = await getAppSettingValue(PRIVACY_PAGE_SETTING_KEY)
    return normalizeDocumentPageContent(value ?? DEFAULT_PRIVACY_PAGE_CONTENT, DEFAULT_PRIVACY_PAGE_CONTENT)
}
