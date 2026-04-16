import type { MetadataRoute } from "next"
import { storefrontCategories } from "@/lib/categories"
import { listApprovedProductsForSitemap } from "@/lib/storefrontProducts"
import { SITE_ORIGIN } from "@/lib/seo"
import { buildAbsoluteUrl } from "@/lib/site-url"

const STATIC_PUBLIC_PATHS = [
    "/",
    "/about",
    "/contact",
    "/faqs",
    "/privacy",
    "/retail",
    "/terms",
    "/wholesale",
] as const

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const productEntries = await listApprovedProductsForSitemap()
    const staticEntries: MetadataRoute.Sitemap = STATIC_PUBLIC_PATHS.map((path) => ({
        changeFrequency: path === "/" ? "daily" : "weekly",
        lastModified: new Date(),
        priority: path === "/" ? 1 : 0.7,
        url: buildAbsoluteUrl(SITE_ORIGIN, path),
    }))

    const categoryEntries: MetadataRoute.Sitemap = storefrontCategories.flatMap((category) => ([
        {
            changeFrequency: "weekly",
            lastModified: new Date(),
            priority: 0.8,
            url: buildAbsoluteUrl(SITE_ORIGIN, `/retail/category/${category.slug}`),
        },
        {
            changeFrequency: "weekly",
            lastModified: new Date(),
            priority: 0.8,
            url: buildAbsoluteUrl(SITE_ORIGIN, `/wholesale/category/${category.slug}`),
        },
    ]))

    const productSitemapEntries: MetadataRoute.Sitemap = productEntries.map((product) => ({
        changeFrequency: "weekly",
        lastModified: new Date(product.lastModified),
        priority: 0.9,
        url: buildAbsoluteUrl(SITE_ORIGIN, product.canonicalPath),
    }))

    return [
        ...staticEntries,
        ...categoryEntries,
        ...productSitemapEntries,
    ]
}
