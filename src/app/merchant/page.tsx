import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronRight, ClipboardList, MessageCircle, ShoppingBag } from "lucide-react"
import { VerifyRiderWidget } from "@/components/merchant/dashboard/VerifyRiderWidget"
import { getSafeNotificationHref } from "@/lib/notifications"
import { createClient } from "@/lib/supabase/server"

export default async function MerchantDashboard() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect("/login")

    const [pickups, confirmations, messages] = await Promise.all([
        supabase.from("orders")
            .select("id, updated_at, order_items!inner(id, quantity, products(name)), rider:rider_id(full_name, phone)")
            .eq("merchant_id", user.id).eq("status", "ready_for_pickup").not("rider_id", "is", null)
            .order("updated_at", { ascending: false }),
        supabase.from("orders").select("id", { count: "exact" })
            .eq("merchant_id", user.id).eq("status", "awaiting_merchant_confirmation")
            .order("created_at", { ascending: false }).limit(1),
        supabase.from("notifications").select("action_url", { count: "exact" })
            .eq("user_id", user.id).eq("type", "order_message")
            .or("read.is.null,read.eq.false").or("action_url.eq./merchant/messages,action_url.like./merchant/messages?*")
            .order("created_at", { ascending: false }).limit(1),
    ])

    const orderCount = confirmations.count ?? 0
    const messageCount = messages.count ?? 0
    const messageHref = getSafeNotificationHref(messages.data?.[0]?.action_url)
    const next = [
        {
            title: orderCount ? `${orderCount} ${orderCount === 1 ? "order needs" : "orders need"} confirmation` : "View orders",
            detail: orderCount ? "Check the items before accepting." : "Track and manage incoming orders.",
            href: orderCount === 1 && confirmations.data?.[0] ? `/merchant/orders/${confirmations.data[0].id}` : "/merchant/orders",
            icon: ClipboardList,
        },
        {
            title: messageCount ? `${messageCount} new order ${messageCount === 1 ? "message" : "messages"}` : "Messages",
            detail: "Open your order conversations.",
            href: messageCount === 1 && messageHref ? messageHref : "/merchant/messages",
            icon: MessageCircle,
        },
        { title: "Manage products", detail: "Update stock, prices, or listings.", href: "/merchant/products", icon: ShoppingBag },
    ]

    return (
        <div className="mx-auto min-w-0 max-w-4xl space-y-5 py-2 sm:py-4">
            <header>
                <p className="text-xs font-bold uppercase tracking-widest text-orange-800 dark:text-orange-300">Merchant workspace</p>
                <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Overview</h1>
                <p className="mt-1 text-sm text-muted-foreground">What needs your attention today.</p>
            </header>
            {(pickups.error || confirmations.error || messages.error) && (
                <p role="status" className="rounded-xl border bg-card p-3 text-sm">Some updates couldn’t load. You can still open Orders or Messages below.</p>
            )}
            <VerifyRiderWidget orders={pickups.data ?? []} />
            <section aria-labelledby="merchant-next">
                <h2 id="merchant-next" className="mb-2 font-semibold">Next up</h2>
                <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
                    {next.map(({ title, detail, href, icon: Icon }) => (
                        <li key={href}>
                            <Link href={href} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-muted/60">
                                <Icon className="size-5 shrink-0 text-orange-800 dark:text-orange-300" aria-hidden="true" />
                                <span className="min-w-0 flex-1"><strong className="block text-sm">{title}</strong><span className="block text-sm text-muted-foreground">{detail}</span></span>
                                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                            </Link>
                        </li>
                    ))}
                </ul>
            </section>
        </div>
    )
}
