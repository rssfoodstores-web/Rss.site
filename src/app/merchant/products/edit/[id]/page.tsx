import { ProductForm } from "@/components/merchant/products/ProductForm"
import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const supabase = await createClient()

    const { data: product, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .single()

    if (error || !product) {
        notFound()
    }

    return <ProductForm initialData={product} isEditing={true} />
}
