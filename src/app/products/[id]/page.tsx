import type { Metadata } from "next"
import { notFound, permanentRedirect } from "next/navigation"
import { ProductDetailsClient } from "./ProductDetailsClient"
import { StructuredData } from "@/components/seo/StructuredData"
import { getStorefrontCategoryLabel } from "@/lib/categories"
import {
    buildProductSeoCopy,
    buildSeoMetadata,
    createProductJsonLd,
} from "@/lib/seo"
import { getStorefrontProductPageData } from "@/lib/storefrontProducts"

interface ProductPageProps {
    params: Promise<{
        id: string
    }>
}

export async function generateMetadata({
    params,
}: ProductPageProps): Promise<Metadata> {
    const { id } = await params
    const pageData = await getStorefrontProductPageData(id)

    if (!pageData) {
        return buildSeoMetadata({
            description: "This product is no longer available on RSS Foods.",
            index: false,
            path: "/products",
            title: "Product Not Found",
        })
    }

    const canonicalParam = pageData.canonicalPath.split("/").pop()

    if (canonicalParam && id !== canonicalParam) {
        permanentRedirect(pageData.canonicalPath)
    }

    const seoCopy = buildProductSeoCopy(pageData.product)

    return buildSeoMetadata({
        canonicalPath: pageData.canonicalPath,
        description: seoCopy.description,
        images: pageData.galleryImages,
        keywords: seoCopy.keywords,
        path: pageData.canonicalPath,
        title: seoCopy.title,
    })
}

export default async function ProductPage({
    params,
}: ProductPageProps) {
    const { id } = await params
    const pageData = await getStorefrontProductPageData(id)

    if (!pageData) {
        notFound()
    }

    const canonicalParam = pageData.canonicalPath.split("/").pop()

    if (canonicalParam && id !== canonicalParam) {
        permanentRedirect(pageData.canonicalPath)
    }

    const effectivePriceKobo =
        Number(pageData.product.discount_price ?? 0) > 0
        && Number(pageData.product.discount_price ?? 0) < Number(pageData.product.price ?? 0)
            ? Number(pageData.product.discount_price ?? 0)
            : Number(pageData.product.price ?? 0)
    const categoryLabel = getStorefrontCategoryLabel(pageData.product.category)
    const seoCopy = buildProductSeoCopy(pageData.product)

    return (
        <>
            <StructuredData
                data={createProductJsonLd({
                    availability: pageData.product.stock_level > 0
                        ? "https://schema.org/InStock"
                        : "https://schema.org/OutOfStock",
                    averageRating: pageData.reviewSummary.averageRating,
                    breadcrumbItems: [
                        { name: "Home", path: "/" },
                        {
                            name: pageData.product.sales_type === "wholesale" ? "Wholesale" : "Retail",
                            path: pageData.product.sales_type === "wholesale" ? "/wholesale" : "/retail",
                        },
                        {
                            name: categoryLabel,
                            path: pageData.product.sales_type === "wholesale"
                                ? `/wholesale/category/${pageData.product.category}`
                                : `/retail/category/${pageData.product.category}`,
                        },
                        { name: pageData.product.name, path: pageData.canonicalPath },
                    ],
                    canonicalPath: pageData.canonicalPath,
                    categoryLabel,
                    description: seoCopy.description,
                    imageUrls: pageData.galleryImages.length > 0 ? pageData.galleryImages : [pageData.product.image_url ?? ""],
                    name: pageData.product.name,
                    priceKobo: effectivePriceKobo,
                    reviewCount: pageData.reviewSummary.reviewCount,
                    sellerName: pageData.sellerName,
                    sku: pageData.product.id,
                })}
            />
            <ProductDetailsClient
                cookedImages={pageData.cookedImages}
                galleryImages={pageData.galleryImages}
                product={pageData.product}
                relatedProducts={pageData.relatedProducts}
                reviews={pageData.reviews}
                reviewSummary={pageData.reviewSummary}
                sellerName={pageData.sellerName}
            />
        </>
    )
}
