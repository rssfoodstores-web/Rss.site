import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { StorefrontCategoryPage } from "@/components/home/StorefrontCategoryPage"
import { StructuredData } from "@/components/seo/StructuredData"
import {
    getStorefrontCategoryDescription,
    getStorefrontCategoryLabel,
    isStorefrontCategorySlug,
    type StorefrontCategorySlug,
} from "@/lib/categories"
import {
    buildCategoryMetadataCopy,
    buildSeoMetadata,
    buildStorefrontCategoryPath,
    createCollectionPageJsonLd,
} from "@/lib/seo"

interface RetailCategoryPageProps {
    params: Promise<{
        category: string
    }>
    searchParams: Promise<Record<string, string | string[] | undefined>>
}

function getFirstSearchParam(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0]?.trim() ?? "" : value?.trim() ?? ""
}

function assertCategory(value: string): StorefrontCategorySlug {
    if (!isStorefrontCategorySlug(value)) {
        notFound()
    }

    return value
}

export async function generateMetadata({
    params,
    searchParams,
}: RetailCategoryPageProps): Promise<Metadata> {
    const [{ category: rawCategory }, resolvedSearchParams] = await Promise.all([params, searchParams])
    const category = assertCategory(rawCategory.toLowerCase())
    const searchQuery = getFirstSearchParam(resolvedSearchParams.q)
    const state = getFirstSearchParam(resolvedSearchParams.state)
    const copy = buildCategoryMetadataCopy("retail", category)
    const path = buildStorefrontCategoryPath("retail", category)

    return buildSeoMetadata({
        canonicalPath: path,
        description: copy.description,
        index: !(searchQuery || state),
        keywords: [getStorefrontCategoryLabel(category), "retail groceries", "RSS Foods", "Nigeria"],
        path,
        title: copy.title,
    })
}

export default async function RetailCategoryPage({
    params,
}: RetailCategoryPageProps) {
    const { category: rawCategory } = await params
    const category = assertCategory(rawCategory.toLowerCase())
    const categoryLabel = getStorefrontCategoryLabel(category)
    const canonicalPath = buildStorefrontCategoryPath("retail", category)

    return (
        <>
            <StructuredData
                data={createCollectionPageJsonLd({
                    breadcrumbItems: [
                        { name: "Home", path: "/" },
                        { name: "Retail", path: "/retail" },
                        { name: categoryLabel, path: canonicalPath },
                    ],
                    canonicalPath,
                    description: getStorefrontCategoryDescription(category),
                    name: `${categoryLabel} Retail`,
                })}
            />
            <StorefrontCategoryPage category={category} salesType="retail" />
        </>
    )
}
