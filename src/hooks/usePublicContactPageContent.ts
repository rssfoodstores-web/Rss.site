"use client"

import { useEffect, useState } from "react"
import {
    CONTACT_PAGE_SETTING_KEY,
    DEFAULT_CONTACT_PAGE_CONTENT,
    normalizeContactPageContent,
    type ContactPageContent,
} from "@/lib/contactPage"
import { createPublicStorefrontClient } from "@/lib/supabase/client"

export function usePublicContactPageContent() {
    const [content, setContent] = useState<ContactPageContent>(DEFAULT_CONTACT_PAGE_CONTENT)

    useEffect(() => {
        let active = true
        const supabase = createPublicStorefrontClient()

        async function loadContent() {
            const { data, error } = await supabase
                .from("app_settings")
                .select("value")
                .eq("key", CONTACT_PAGE_SETTING_KEY)
                .maybeSingle()

            if (error) {
                console.error("Unable to load public contact page content:", error)
                return
            }

            if (active) {
                setContent(normalizeContactPageContent(data?.value))
            }
        }

        void loadContent()

        return () => {
            active = false
        }
    }, [])

    return content
}
