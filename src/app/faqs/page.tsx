import { FaqPageClient } from "@/components/content/FaqPageClient"
import { getFaqPageContent } from "@/lib/contentPagesData"

export default async function FaqsPage() {
    const content = await getFaqPageContent()

    return <FaqPageClient content={content} />
}
