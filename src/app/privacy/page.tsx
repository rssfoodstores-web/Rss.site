import type { Metadata } from "next"
import { DocumentPage } from "@/components/content/DocumentPage"
import { getPrivacyPageContent } from "@/lib/contentPagesData"
import { buildSeoMetadata } from "@/lib/seo"

export async function generateMetadata(): Promise<Metadata> {
    const content = await getPrivacyPageContent()

    return buildSeoMetadata({
        description: content.introDescription,
        path: "/privacy",
        title: content.pageTitle,
    })
}

export default async function PrivacyPage() {
    const content = await getPrivacyPageContent()

    return <DocumentPage content={content} variant="privacy" />
}
