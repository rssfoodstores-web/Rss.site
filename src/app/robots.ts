import type { MetadataRoute } from "next"
import { SITE_ORIGIN } from "@/lib/seo"

export default function robots(): MetadataRoute.Robots {
    return {
        host: SITE_ORIGIN,
        rules: [
            {
                allow: "/",
                disallow: [
                    "/account/",
                    "/admin/",
                    "/agent/",
                    "/api/",
                    "/auth/",
                    "/cart",
                    "/forgot-password",
                    "/login",
                    "/merchant/",
                    "/reset-password",
                    "/rider/",
                    "/wishlist",
                ],
                userAgent: "*",
            },
        ],
        sitemap: `${SITE_ORIGIN}/sitemap.xml`,
    }
}
