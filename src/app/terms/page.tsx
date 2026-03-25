import { DocumentPage } from "@/components/content/DocumentPage"
import { getTermsPageContent } from "@/lib/contentPagesData"

export default async function TermsPage() {
    const content = await getTermsPageContent()

    return <DocumentPage content={content} variant="terms" />
}
