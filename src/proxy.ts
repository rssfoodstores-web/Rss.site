import { NextResponse, type NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"
import { buildCanonicalProductPath, extractUuidFromSlugParam } from "@/lib/seo"

interface ProductRedirectRow {
    id: string
    name: string
}

async function maybeRedirectProductRequest(request: NextRequest) {
    if (!request.nextUrl.pathname.startsWith("/products/")) {
        return null
    }

    const rawSegment = request.nextUrl.pathname.split("/")[2]?.trim()
    const productId = extractUuidFromSlugParam(rawSegment)

    if (!rawSegment || !productId) {
        return null
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
        return null
    }

    try {
        const response = await fetch(
            `${supabaseUrl}/rest/v1/products?select=id,name&id=eq.${productId}&status=eq.approved&active_pricing_id=not.is.null&limit=1`,
            {
                cache: "no-store",
                headers: {
                    apikey: supabaseAnonKey,
                    Authorization: `Bearer ${supabaseAnonKey}`,
                },
            }
        )

        if (!response.ok) {
            return null
        }

        const products = await response.json() as ProductRedirectRow[]
        const product = products[0]

        if (!product) {
            return null
        }

        const canonicalPath = buildCanonicalProductPath(product.name, product.id)

        if (request.nextUrl.pathname === canonicalPath) {
            return null
        }

        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = canonicalPath

        return NextResponse.redirect(redirectUrl, 308)
    } catch (error) {
        console.error("Product canonical redirect lookup failed:", error)
        return null
    }
}

export async function proxy(request: NextRequest) {
    const productRedirect = await maybeRedirectProductRequest(request)

    if (productRedirect) {
        return productRedirect
    }

    return updateSession(request)
}

export const config = {
    matcher: [
        "/account/:path*",
        "/agent/:path*",
        "/merchant/:path*",
        "/products/:path*",
        "/rider/:path*",
        "/cart/:path*",
    ],
}
