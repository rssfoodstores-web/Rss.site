import { DocumentPage } from "@/components/content/DocumentPage"
import { getPrivacyPageContent } from "@/lib/contentPagesData"

export default async function PrivacyPage() {
    const content = await getPrivacyPageContent()

    return <DocumentPage content={content} variant="privacy" />
}
