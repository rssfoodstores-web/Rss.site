import { redirect } from "next/navigation"

export default async function GiftCardPage({ searchParams }: {
    searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
    const params = new URLSearchParams()
    for (const [name, value] of Object.entries(await searchParams)) {
        if (typeof value === "string") params.append(name, value)
        else value?.forEach((entry) => params.append(name, entry))
    }
    params.set("view", "gift-cards")
    redirect(`/account/wallet?${params}`)
}
