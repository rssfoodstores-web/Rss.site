import { createClient } from "@/lib/supabase/server"
import { MerchantProductsClient } from "@/components/merchant/products/MerchantProductsClient"
import { redirect } from "next/navigation"
import { getMerchantProductPostingAccess } from "@/lib/merchantPostingAccess"

export default async function MerchantProductsPage() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        redirect("/login")
    }

    // Fetch products
    const { data: products } = await supabase
        .from("products")
        .select("*")
        .eq("merchant_id", user.id)
        .order("created_at", { ascending: false })

    const postingAccess = await getMerchantProductPostingAccess(supabase, user.id)

    return (
        <MerchantProductsClient
            initialProducts={products || []}
            locationReady={postingAccess.locationReady}
            locationEditingUnlocked={postingAccess.locationEditingUnlocked}
            updateRequested={postingAccess.updateRequested}
            locationStatusMessage={postingAccess.statusMessage}
            userId={user.id}
        />
    )
}
