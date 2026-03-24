import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SubmitAgentPriceInputForm } from "@/components/agent/SubmitAgentPriceInputForm"
import { formatKobo } from "@/lib/money"
import { AlertCircle, ArrowRight, ClipboardCheck, Clock3, Store, Tags } from "lucide-react"
import Link from "next/link"

interface RelationProfile {
    id?: string
    full_name: string | null
}

type Relation<T> = T | T[] | null

interface AgentPendingProductRow {
    id: string
    name: string
    price: number
    status: string
    created_at: string | null
    merchant: Relation<RelationProfile>
}

interface AgentPriceInputRow {
    product_id: string
    amount_kobo: number
    notes: string | null
    created_at: string
    product: Relation<{
        id: string
        name: string | null
    }>
}

function firstRelation<T>(value: Relation<T>): T | null {
    if (Array.isArray(value)) {
        return value[0] ?? null
    }

    return value ?? null
}

function formatShortDate(value: string | null | undefined) {
    if (!value) {
        return "Pending"
    }

    return new Date(value).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })
}

export default async function AgentPricingPage() {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect("/login")
    }

    const [
        { data: pendingProducts, error: pendingProductsError },
        { data: priceInputs, error: priceInputsError },
    ] = await Promise.all([
        supabase
            .from("products")
            .select(`
                id,
                name,
                price,
                status,
                created_at,
                merchant:merchant_id (
                    id,
                    full_name
                )
            `)
            .eq("status", "pending")
            .order("created_at", { ascending: false })
            .limit(24),
        supabase
            .from("product_price_inputs")
            .select(`
                product_id,
                amount_kobo,
                notes,
                created_at,
                product:product_id (
                    id,
                    name
                )
            `)
            .eq("source", "agent")
            .eq("source_user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(40),
    ])

    const normalizedPendingProducts = ((pendingProducts ?? []) as unknown as AgentPendingProductRow[])
    const normalizedPriceInputs = ((priceInputs ?? []) as unknown as AgentPriceInputRow[])
    const latestInputByProductId = new Map<string, AgentPriceInputRow>()

    for (const input of normalizedPriceInputs) {
        if (!latestInputByProductId.has(input.product_id)) {
            latestInputByProductId.set(input.product_id, input)
        }
    }

    const awaitingYourInputCount = normalizedPendingProducts.filter((product) => !latestInputByProductId.has(product.id)).length
    const submissionsToday = normalizedPriceInputs.filter((input) => {
        const createdAt = new Date(input.created_at)
        const now = new Date()

        return createdAt.getFullYear() === now.getFullYear()
            && createdAt.getMonth() === now.getMonth()
            && createdAt.getDate() === now.getDate()
    }).length

    return (
        <div className="space-y-8">
            <Card className="border-orange-100 bg-gradient-to-br from-white via-orange-50/50 to-white dark:from-zinc-950 dark:via-orange-950/10 dark:to-zinc-950">
                <CardContent className="space-y-6 p-6 lg:p-8">
                    <div className="space-y-2">
                        <Badge className="w-fit border border-orange-200 bg-white text-orange-700 dark:border-orange-900 dark:bg-transparent dark:text-orange-300">
                            Survey pricing
                        </Badge>
                        <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white sm:text-3xl">Submit market pricing without losing the queue</h2>
                        <p className="max-w-3xl text-sm text-gray-500">
                            Each product below is waiting on your survey reference. Save your latest field price and notes, then move on to the next item.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <Button asChild className="bg-[#F58220] text-white hover:bg-[#E57210]">
                            <Link href="/agent/orders">
                                Back to orders
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                        <Button asChild variant="outline">
                            <Link href="/agent/history">Open history</Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Card className="border-orange-100">
                    <CardContent className="flex items-center gap-4 p-6">
                        <div className="rounded-2xl bg-violet-50 p-3 text-violet-700 dark:bg-violet-950/20">
                            <Tags className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Pending survey queue</p>
                            <p className="text-3xl font-extrabold text-gray-900 dark:text-white">{normalizedPendingProducts.length}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-orange-100">
                    <CardContent className="flex items-center gap-4 p-6">
                        <div className="rounded-2xl bg-amber-50 p-3 text-amber-700 dark:bg-amber-950/20">
                            <Clock3 className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Awaiting your input</p>
                            <p className="text-3xl font-extrabold text-gray-900 dark:text-white">{awaitingYourInputCount}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-orange-100">
                    <CardContent className="flex items-center gap-4 p-6">
                        <div className="rounded-2xl bg-green-50 p-3 text-green-700 dark:bg-green-950/20">
                            <ClipboardCheck className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Products surveyed</p>
                            <p className="text-3xl font-extrabold text-gray-900 dark:text-white">{latestInputByProductId.size}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-orange-100">
                    <CardContent className="flex items-center gap-4 p-6">
                        <div className="rounded-2xl bg-sky-50 p-3 text-sky-700 dark:bg-sky-950/20">
                            <Store className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Submitted today</p>
                            <p className="text-3xl font-extrabold text-gray-900 dark:text-white">{submissionsToday}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {pendingProductsError || priceInputsError ? (
                <Card className="border-red-200 bg-red-50 dark:bg-red-900/10">
                    <CardContent className="p-8 text-center text-red-600">
                        <AlertCircle className="mx-auto mb-4 h-10 w-10" />
                        <p>{pendingProductsError?.message ?? priceInputsError?.message}</p>
                    </CardContent>
                </Card>
            ) : normalizedPendingProducts.length === 0 ? (
                <Card>
                    <CardContent className="p-10 text-center text-gray-500">
                        There are no products awaiting agent survey pricing right now.
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 xl:grid-cols-2">
                    {normalizedPendingProducts.map((product) => {
                        const merchant = firstRelation(product.merchant)
                        const existingInput = latestInputByProductId.get(product.id)

                        return (
                            <Card key={product.id} className="border-orange-100">
                                <CardHeader className="space-y-3">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <CardTitle className="text-lg">{product.name}</CardTitle>
                                            <p className="mt-1 text-sm text-gray-500">
                                                Merchant: {merchant?.full_name ?? "RSS Merchant"}
                                            </p>
                                        </div>
                                        <Badge
                                            variant="outline"
                                            className={existingInput ? "border-green-200 text-green-700 dark:border-green-900 dark:text-green-300" : "border-orange-200 text-orange-700 dark:border-orange-900 dark:text-orange-300"}
                                        >
                                            {existingInput ? "Survey saved" : "Awaiting survey"}
                                        </Badge>
                                    </div>

                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="rounded-2xl bg-gray-50 px-4 py-3 dark:bg-zinc-900">
                                            <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Merchant base price</p>
                                            <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{formatKobo(product.price)}</p>
                                        </div>
                                        <div className="rounded-2xl bg-gray-50 px-4 py-3 dark:bg-zinc-900">
                                            <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Your latest survey</p>
                                            <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                                                {existingInput ? formatKobo(existingInput.amount_kobo) : "Not submitted yet"}
                                            </p>
                                            <p className="mt-1 text-xs text-gray-500">
                                                {existingInput ? `Saved ${formatShortDate(existingInput.created_at)}` : `Queued ${formatShortDate(product.created_at)}`}
                                            </p>
                                        </div>
                                    </div>
                                </CardHeader>

                                <CardContent className="space-y-4">
                                    {existingInput?.notes ? (
                                        <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-gray-300">
                                            <p className="font-semibold text-gray-900 dark:text-white">Latest note</p>
                                            <p className="mt-1">{existingInput.notes}</p>
                                        </div>
                                    ) : null}

                                    <SubmitAgentPriceInputForm
                                        productId={product.id}
                                        productName={product.name}
                                        defaultAmountNaira={existingInput ? String(existingInput.amount_kobo / 100) : ""}
                                        defaultNotes={existingInput?.notes}
                                    />
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}

            <Card className="border-orange-100">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-xl">Recent survey submissions</CardTitle>
                    <p className="text-sm text-gray-500">Your latest saved references across the pricing queue.</p>
                </CardHeader>
                <CardContent>
                    {normalizedPriceInputs.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500 dark:border-zinc-800">
                            Your submissions will appear here after the first survey save.
                        </div>
                    ) : (
                        <>
                            <div className="space-y-3 md:hidden">
                                {normalizedPriceInputs.slice(0, 8).map((input) => {
                                    const product = firstRelation(input.product)

                                    return (
                                        <div key={`${input.product_id}-${input.created_at}`} className="rounded-2xl border border-gray-100 p-4 dark:border-zinc-800">
                                            <div className="flex flex-wrap items-start justify-between gap-3">
                                                <div className="space-y-1">
                                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Product</p>
                                                    <p className="font-semibold text-gray-900 dark:text-white">
                                                        {product?.name ?? `Product ${input.product_id.slice(0, 8)}`}
                                                    </p>
                                                </div>
                                                <p className="font-semibold text-gray-900 dark:text-white">{formatKobo(input.amount_kobo)}</p>
                                            </div>
                                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                                <div>
                                                    <p className="text-xs uppercase tracking-[0.18em] text-gray-500">When</p>
                                                    <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{formatShortDate(input.created_at)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Note</p>
                                                    <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{input.notes ?? "No note"}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                            <div className="hidden overflow-x-auto md:block">
                                <table className="w-full min-w-[560px] text-left">
                                <thead>
                                    <tr className="border-b border-gray-100 text-xs uppercase tracking-[0.18em] text-gray-500 dark:border-zinc-800">
                                        <th className="pb-4">Product</th>
                                        <th className="pb-4">Amount</th>
                                        <th className="pb-4">When</th>
                                        <th className="pb-4">Note</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                    {normalizedPriceInputs.slice(0, 8).map((input) => {
                                        const product = firstRelation(input.product)

                                        return (
                                            <tr key={`${input.product_id}-${input.created_at}`} className="text-sm">
                                                <td className="py-4 font-semibold text-gray-900 dark:text-white">
                                                    {product?.name ?? `Product ${input.product_id.slice(0, 8)}`}
                                                </td>
                                                <td className="py-4 text-gray-600 dark:text-gray-300">{formatKobo(input.amount_kobo)}</td>
                                                <td className="py-4 text-gray-500">{formatShortDate(input.created_at)}</td>
                                                <td className="py-4 text-gray-500">{input.notes ?? "No note"}</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
