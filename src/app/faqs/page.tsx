import type { Metadata } from "next"
import { FaqPageClient } from "@/components/content/FaqPageClient"
import { getFaqPageContent } from "@/lib/contentPagesData"
import { buildSeoMetadata } from "@/lib/seo"

export async function generateMetadata(): Promise<Metadata> {
    const content = await getFaqPageContent()

    return buildSeoMetadata({
        description: content.introDescription,
        path: "/faqs",
        title: content.pageTitle,
    })
}

export default async function FaqsPage() {
    const content = await getFaqPageContent()

    return <FaqPageClient content={content} />
}
