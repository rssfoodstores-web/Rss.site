"use server"

import { revalidatePath } from "next/cache"
import type { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { nairaToKobo } from "@/lib/money"
import { assertMerchantCanPostProducts } from "@/lib/merchantPostingAccess"
import { buildCanonicalProductPath } from "@/lib/seo"

type ProductInput = Record<string, unknown> & {
    price?: number
    discount_price?: number
    category?: string
    categories?: string[]
}

export type ProductActionResult =
    | { ok: true; productId?: string }
    | { ok: false; error: string; code?: string }

function productActionError(error: unknown, operation: string): ProductActionResult {
    const value = error as { code?: string; message?: string; details?: string; hint?: string }
    const code = typeof value?.code === "string" ? value.code : undefined
    const detail = typeof value?.message === "string" ? value.message : "Unknown server error"

    console.error(`[product:${operation}]`, {
        code,
        message: detail,
        details: value?.details,
        hint: value?.hint,
    })

    if (error instanceof Error && error.message === "Unauthorized") {
        return { ok: false, error: "Your session has expired. Sign in again and retry." }
    }

    if (code === "42501") {
        return {
            ok: false,
            error: "We couldn't confirm your merchant access, so your product wasn't submitted. Please refresh this page and try once more.",
            code,
        }
    }

    return {
        ok: false,
        error: `Product ${operation} failed${code ? ` (${code})` : ""}: ${detail}`,
        code,
    }
}

function hasMerchantRoleClaim(value: unknown) {
    return Array.isArray(value) && value.some((role) => role === "merchant")
}

function claimsIncludeMerchantRole(claims: unknown) {
    if (!claims || typeof claims !== "object") return false

    const appMetadata = (claims as Record<string, unknown>).app_metadata
    if (!appMetadata || typeof appMetadata !== "object") return false

    return hasMerchantRoleClaim((appMetadata as Record<string, unknown>).roles)
}

async function ensureMerchantRoleClaim(supabase: Awaited<ReturnType<typeof createClient>>, user: User) {
    const { data: currentClaims, error: claimsError } = await supabase.auth.getClaims()

    if (claimsError) throw claimsError
    if (claimsIncludeMerchantRole(currentClaims?.claims)) return

    // Role rows update app_metadata through a database trigger. The browser may still
    // hold the JWT issued before that trigger ran, so refresh it before using RLS.
    if (!hasMerchantRoleClaim(user.app_metadata?.roles)) {
        throw new Error("This account does not have active merchant access yet. Please contact support if you believe this is a mistake.")
    }

    const { data: refreshedSession, error: refreshError } = await supabase.auth.refreshSession()
    if (refreshError || !refreshedSession.session) {
        throw new Error("Your merchant access was updated, but your session could not refresh. Please sign out and back in, then submit again.")
    }

    const { data: refreshedClaims, error: refreshedClaimsError } = await supabase.auth.getClaims()
    if (refreshedClaimsError) throw refreshedClaimsError

    if (!claimsIncludeMerchantRole(refreshedClaims?.claims)) {
        throw new Error("Your merchant access is still syncing. Please sign out and back in, then submit again.")
    }
}

function assertPositiveAmount(amount: number, label: string) {
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error(`${label} must be greater than 0.`)
    }
}

function toReadableProductError(error: unknown, fallback: string) {
    if (error instanceof Error && error.message) {
        return error.message
    }

    if (error && typeof error === "object") {
        const candidate = error as {
            code?: string
            message?: string
            hint?: string | null
        }

        if (candidate.code === "PGRST204") {
            return "Product setup failed because the form sent a field the database does not accept. Refresh the page and try again."
        }

        if (candidate.message) {
            return candidate.message
        }
    }

    return fallback
}

function buildProductPayload(data: ProductInput) {
    const { price, discount_price, ...productData } = data
    const parsedPrice = Number(price ?? 0)

    delete productData.categories

    assertPositiveAmount(parsedPrice, "Merchant base price")

    if (typeof productData.category !== "string" || !productData.category) {
        throw new Error("Choose one product category before submitting.")
    }

    if (typeof productData.state !== "string" || !productData.state.trim()) {
        throw new Error("Select a state before submitting this product for review.")
    }

    productData.state = productData.state.trim()

    for (const key of ["return_refund_policy", "manufacture_date", "expiry_date"] as const) {
        const rawValue = productData[key]
        if (typeof rawValue === "string") {
            const trimmedValue = rawValue.trim()
            productData[key] = trimmedValue ? trimmedValue : null
        }
    }

    for (const key of ["seo_title", "seo_description"] as const) {
        const rawValue = productData[key]
        if (typeof rawValue === "string") {
            const trimmedValue = rawValue.trim()
            productData[key] = trimmedValue ? trimmedValue : null
        }
    }

    for (const key of ["nutrition_content", "health_benefits", "suggested_combos", "cooked_images"] as const) {
        const rawValue = productData[key]
        if (Array.isArray(rawValue)) {
            const normalizedValues = rawValue
                .filter((item): item is string => typeof item === "string")
                .map((item) => item.trim())
                .filter(Boolean)

            productData[key] = normalizedValues.length > 0 ? normalizedValues : null
        }
    }

    if (Array.isArray(productData.tags)) {
        productData.tags = productData.tags
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim())
            .filter(Boolean)
    }

    return {
        ...productData,
        price: nairaToKobo(parsedPrice),
        discount_price:
            typeof discount_price === "number" && discount_price > 0
                ? nairaToKobo(discount_price)
                : null,
        status: "pending",
        submitted_for_review_at: new Date().toISOString(),
    }
}

async function createMerchantPriceInput(productId: string, merchantId: string, amountKobo: number) {
    const supabase = await createClient()

    const { error } = await supabase.from("product_price_inputs").insert({
        product_id: productId,
        source: "merchant",
        source_user_id: merchantId,
        amount_kobo: amountKobo,
        notes: "Merchant base price submission",
    })

    if (error) {
        throw error
    }
}

export async function createProduct(data: ProductInput): Promise<ProductActionResult> {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) throw new Error("Unauthorized")
        await ensureMerchantRoleClaim(supabase, user)
        await assertMerchantCanPostProducts(supabase, user.id)

        const productPayload = buildProductPayload(data)
        const { data: product, error } = await supabase
            .from("products")
            .insert({ ...productPayload, merchant_id: user.id })
            .select("id, merchant_id, name, price")
            .single()

        if (error || !product) throw error ?? new Error("Product insert returned no row")
        try {
            await createMerchantPriceInput(product.id, user.id, product.price)
        } catch (priceInputError) {
            const { error: rollbackError } = await supabase
                .from("products")
                .delete()
                .eq("id", product.id)
                .eq("merchant_id", user.id)

            if (rollbackError) {
                console.error("Product was created but its price review record failed, and the product could not be rolled back:", {
                    productId: product.id,
                    rollbackError,
                })
                return {
                    ok: false,
                    error: "The product was saved, but its price review record could not be completed. Check your Pending products before trying again to avoid a duplicate, or contact support.",
                }
            }

            throw priceInputError
        }

        revalidatePath("/merchant/products")
        revalidatePath("/merchant/products/add")
        return { ok: true, productId: product.id }
    } catch (error) {
        return productActionError(error, "creation")
    }
}

export async function updateProduct(id: string, data: ProductInput): Promise<ProductActionResult> {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) throw new Error("Unauthorized")
        const productPayload = buildProductPayload(data)
        const { data: product, error } = await supabase
            .from("products")
            .update(productPayload)
            .eq("id", id)
            .eq("merchant_id", user.id)
            .select("id, merchant_id, price")
            .single()

        if (error || !product) throw error ?? new Error("Product update returned no row")
        await createMerchantPriceInput(product.id, user.id, product.price)

        revalidatePath("/merchant/products")
        revalidatePath(`/merchant/products/${id}`)
        revalidatePath(`/products/${id}`)
        return { ok: true, productId: product.id }
    } catch (error) {
        return productActionError(error, "update")
    }
}

export async function deleteProduct(id: string) {
    const supabase = await createClient()
    const { error } = await supabase.from("products").delete().eq("id", id)

    if (error) {
        throw error
    }

    revalidatePath("/merchant/products")
}

export async function approveProduct(id: string) {
    const supabase = await createClient()
    const { data: product, error } = await supabase
        .from("products")
        .update({
            status: "approved",
            submitted_for_review_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("merchant_id, name, category, sales_type")
        .single()

    if (error) {
        throw error
    }

    if (product) {
        await supabase.from("notifications").insert({
            user_id: product.merchant_id,
            title: "Pricing Approved",
            message: `Your product \"${product.name}\" is now visible on RSS Foods.`,
        })
    }

    revalidatePath("/merchant/products")
    revalidatePath("/admin/approvals")
    revalidatePath("/")
    revalidatePath("/retail")
    revalidatePath("/wholesale")

    if (product) {
        revalidatePath(buildCanonicalProductPath(product.name, id))

        if (typeof product.category === "string" && product.category.trim()) {
            revalidatePath(`/retail/category/${product.category}`)
            revalidatePath(`/wholesale/category/${product.category}`)
        }
    }
}

export async function rejectProduct(id: string) {
    const supabase = await createClient()
    const { data: product, error } = await supabase
        .from("products")
        .update({
            status: "rejected",
            submitted_for_review_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("merchant_id, name")
        .single()

    if (error) {
        throw error
    }

    if (product) {
        await supabase.from("notifications").insert({
            user_id: product.merchant_id,
            title: "Pricing Review Update",
            message: `Your product \"${product.name}\" requires another pricing review.`,
        })
    }

    revalidatePath("/merchant/products")
    revalidatePath("/admin/approvals")
    revalidatePath("/retail")
    revalidatePath("/wholesale")
}

export async function submitMerchantPriceInput(productId: string, amountNaira: number, notes?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        throw new Error("Unauthorized")
    }

    assertPositiveAmount(amountNaira, "Merchant base price")

    const amountKobo = nairaToKobo(amountNaira)

    const { error } = await supabase.from("product_price_inputs").insert({
        product_id: productId,
        source: "merchant",
        source_user_id: user.id,
        amount_kobo: amountKobo,
        notes: notes ?? "Merchant base price update",
    })

    if (error) {
        throw error
    }

    const { error: productError } = await supabase
        .from("products")
        .update({
            status: "pending",
            submitted_for_review_at: new Date().toISOString(),
        })
        .eq("id", productId)
        .eq("merchant_id", user.id)

    if (productError) {
        throw productError
    }

    revalidatePath("/merchant/products")
}

export async function submitAgentPriceInput(productId: string, amountNaira: number, notes?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        throw new Error("Unauthorized")
    }

    assertPositiveAmount(amountNaira, "Agent survey price")

    const { data: product, error: productError } = await supabase
        .from("products")
        .select("id, status")
        .eq("id", productId)
        .maybeSingle()

    if (productError) {
        throw productError
    }

    if (!product) {
        throw new Error("Product not found.")
    }

    if (product.status !== "pending") {
        throw new Error("This product is no longer awaiting agent survey pricing.")
    }

    const amountKobo = nairaToKobo(amountNaira)

    const { error } = await supabase.from("product_price_inputs").insert({
        product_id: productId,
        source: "agent",
        source_user_id: user.id,
        amount_kobo: amountKobo,
        notes: notes ?? "Agent market survey submission",
    })

    if (error) {
        throw error
    }

    revalidatePath("/agent")
    revalidatePath("/agent/pricing")
}

