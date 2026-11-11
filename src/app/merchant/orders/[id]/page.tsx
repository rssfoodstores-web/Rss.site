import { redirect } from "next/navigation"

export default async function MerchantOrderDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    redirect(`/merchant/orders?order=${encodeURIComponent(id)}`)
}
