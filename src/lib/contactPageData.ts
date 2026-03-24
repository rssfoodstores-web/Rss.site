import "server-only"

import { createClient } from "@/lib/supabase/server"
import { CONTACT_PAGE_SETTING_KEY, DEFAULT_CONTACT_PAGE_CONTENT, normalizeContactPageContent, type ContactPageContent } from "@/lib/contactPage"

export async function getContactPageContent(): Promise<ContactPageContent> {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", CONTACT_PAGE_SETTING_KEY)
        .maybeSingle()

    if (error) {
        console.error("Unable to load contact page content:", error)
        return DEFAULT_CONTACT_PAGE_CONTENT
    }

    return normalizeContactPageContent(data?.value)
}
