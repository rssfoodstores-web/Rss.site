import { ProductForm } from "@/components/merchant/products/ProductForm"
import { createClient } from "@/lib/supabase/server"
import { getMerchantProductPostingAccess } from "@/lib/merchantPostingAccess"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, MapPin } from "lucide-react"

export default async function AddProductPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect("/login")
    }

    const postingAccess = await getMerchantProductPostingAccess(supabase, user.id)

    if (!postingAccess.locationReady) {
        return (
            <div className="mx-auto max-w-3xl space-y-6">
                <Link
                    href="/merchant/products"
                    className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-gray-900 dark:hover:text-white"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to products
                </Link>

                <Card className="border-orange-200 bg-orange-50/70 dark:bg-orange-950/10">
                    <CardHeader className="space-y-3">
                        <Badge className="w-fit border border-orange-200 bg-white text-orange-700 dark:border-orange-900 dark:bg-transparent dark:text-orange-300">
                            Store setup required
                        </Badge>
                        <CardTitle className="text-2xl font-extrabold text-gray-900 dark:text-white">
                            Verify store location before posting products
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5 text-sm text-gray-600 dark:text-gray-300">
                        <p>{postingAccess.statusMessage}</p>
                        {postingAccess.addressLabel ? (
                            <div className="rounded-2xl border border-orange-100 bg-white/80 px-4 py-3 dark:border-orange-900 dark:bg-black/20">
                                <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Current store address</p>
                                <p className="mt-2 font-medium text-gray-900 dark:text-white">{postingAccess.addressLabel}</p>
                            </div>
                        ) : null}
                        <Button asChild className="bg-[#F58220] text-white hover:bg-[#E57210]">
                            <Link href="/merchant/verify-location">
                                <MapPin className="mr-2 h-4 w-4" />
                                Verify store location
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return <ProductForm />
}
