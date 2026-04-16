import type { Metadata } from "next"
import { DocumentPage } from "@/components/content/DocumentPage"
import { getTermsPageContent } from "@/lib/contentPagesData"
import { buildSeoMetadata } from "@/lib/seo"

export async function generateMetadata(): Promise<Metadata> {
    const content = await getTermsPageContent()

    return buildSeoMetadata({
        description: content.introDescription,
        path: "/terms",
        title: content.pageTitle,
    })
}

export default async function TermsPage() {
    const content = await getTermsPageContent()

    return <DocumentPage content={content} variant="terms" />
}
