import Link from "next/link"
import { AlertCircle, ChevronLeft, ChevronRight, ClipboardList, UserRound } from "lucide-react"
import { OrderCall, OrderChatButton, OrderChatPanel, type OrderChatUnread } from "@/components/messages/OrderChatPanel"
import { ConfirmOrderButton } from "@/components/merchant/ConfirmOrderButton"
import { KeepMerchantOrderSelected } from "@/components/merchant/KeepMerchantOrderSelected"
import { VerifyPickupWidget } from "@/components/merchant/VerifyPickupWidget"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatKobo } from "@/lib/money"
import { formatOrderStatus, formatPaymentStatus, getOrderOperationalHint, getOrderStatusTone } from "@/lib/orders"
import { cn } from "@/lib/utils"

type Relation<T> = T | T[] | null

interface Contact {
    full_name: string | null
    phone: string | null
}

export type MerchantOrdersView = "active" | "past"

export interface MerchantOrderSummary {
    id: string
    status: string | null
    rider_id: string | null
}

export interface MerchantOrderDetail extends MerchantOrderSummary {
    payment_status: string | null
    created_at: string | null
    assigned_agent_id: string | null
    total_amount: number
    delivery_location: { coordinates?: [number, number] } | null
    delivery_address_snapshot: { address_label?: string } | null
    customer: Relation<Contact>
    agent: Relation<Contact>
    rider: Relation<Contact>
    order_items: {
        id: string
        quantity: number
        price_per_unit: number
        products: Relation<{ name: string | null }>
    }[] | null
}

interface MerchantOrdersWorkspaceProps {
    orders: MerchantOrderSummary[]
    selected: MerchantOrderDetail | null
    unread: Record<string, OrderChatUnread>
    view: MerchantOrdersView
    page: number
    pageCount: number
    total: number
    listError: boolean
    selectionError: boolean
    selectionMissing: boolean
}

const tabs = [{ id: "active", label: "Active" }, { id: "past", label: "Past orders" }] as const
const placedDate = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" })

function orderNumber(id: string) {
    return id.slice(0, 8).toUpperCase()
}

function firstRelation<T>(value: Relation<T>) {
    return Array.isArray(value) ? value[0] ?? null : value
}

function ordersHref(view: MerchantOrdersView, page = 1, orderId?: string) {
    const query = new URLSearchParams({ view })
    if (page > 1) query.set("page", String(page))
    if (orderId) query.set("order", orderId)
    return `/merchant/orders?${query}`
}

function shortStatus(order: MerchantOrderSummary) {
    if (order.status === "awaiting_merchant_confirmation") return "Needs confirmation"
    if (order.status === "ready_for_pickup") return order.rider_id ? "Rider assigned" : "Waiting for rider"
    return formatOrderStatus(order.status)
}

function getNextStep(order: MerchantOrderDetail) {
    switch (order.status) {
        case "awaiting_agent_acceptance":
            return { owner: "Waiting for agent", title: "Agent confirmation pending", description: "We’ll show Confirm order when the agent accepts." }
        case "awaiting_merchant_confirmation":
            return { owner: "Your next step", title: "Confirm the items are available", description: "The agent is waiting for your confirmation." }
        case "processing":
            return { owner: "Your next step", title: "Prepare the items", description: "The agent will coordinate the rider." }
        case "ready_for_pickup":
            return order.rider_id
                ? { owner: "At handoff", title: "Have the order ready for pickup", description: "Verify the rider’s code before handing over the order." }
                : { owner: "Waiting for rider", title: "Pickup request is open", description: "The rider’s details will appear once they claim the pickup." }
        case "out_for_delivery":
            return { owner: "With the rider", title: "On the way to the customer" }
        case "return_in_transit":
            return { owner: "With the rider", title: "Order is returning to your store" }
        case "delivery_failed":
            return { owner: "Needs attention", title: "Delivery could not be completed", description: "Contact the order team for an update." }
        default:
            return { owner: "Order status", title: formatOrderStatus(order.status), description: getOrderOperationalHint(order.status) }
    }
}

export function MerchantOrdersWorkspace({
    orders, selected, unread, view, page, pageCount, total, listError, selectionError, selectionMissing,
}: MerchantOrdersWorkspaceProps) {
    const content = <div className="min-w-0 space-y-4">
        <header className="flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
            {!listError && <p className="text-sm text-muted-foreground">{total} {view === "active" ? "active" : "past"} {total === 1 ? "order" : "orders"}</p>}
        </header>
        <nav className="flex gap-2" aria-label="Order views">
            {tabs.map((tab) => <Link key={tab.id} href={ordersHref(tab.id)} scroll={false}
                aria-current={view === tab.id ? "page" : undefined}
                className={cn("inline-flex min-h-11 items-center rounded-full border bg-card px-4 text-sm font-medium",
                    view === tab.id && "border-orange-300 bg-orange-50 text-orange-950 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-100")}>
                {tab.label}
            </Link>)}
        </nav>
        {listError && <p role="alert" className="flex items-center gap-2 rounded-xl border bg-card p-3 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" /> Some orders couldn’t load. Refresh to try again.
        </p>}
        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(10rem,14rem)_minmax(0,1fr)] xl:items-start">
            {Boolean(orders.length || page > 1) && <div className="min-w-0 space-y-2">
                {orders.length > 0 && <nav aria-label="Switch orders"
                    className="flex min-w-0 gap-2 overflow-x-auto p-0.5 pb-2 xl:grid xl:overflow-visible xl:pb-0.5">
                    {orders.map((order) => {
                        const isSelected = order.id === selected?.id
                        const messages = (unread[order.id]?.ops ?? 0) + (unread[order.id]?.customer ?? 0)
                        return <Link key={order.id} href={ordersHref(view, page, order.id)} scroll={false}
                            aria-current={isSelected ? "page" : undefined}
                            className={cn("min-w-36 shrink-0 rounded-xl border bg-card px-3 py-2 xl:min-w-0",
                                isSelected && "border-orange-400 bg-orange-50 ring-1 ring-inset ring-orange-400 dark:border-orange-800 dark:bg-orange-950/50 dark:ring-orange-800")}>
                            <span className="flex items-baseline justify-between gap-2 text-sm font-semibold">
                                #{orderNumber(order.id)}
                                {messages > 0 && <span className="rounded-full bg-orange-100 px-1.5 text-xs text-orange-900">{messages} new</span>}
                            </span>
                            <span className="block text-xs text-muted-foreground">{shortStatus(order)}</span>
                        </Link>
                    })}
                </nav>}
                {(pageCount > 1 || page > 1) && <nav className="flex flex-wrap items-center gap-2" aria-label="Order pages">
                    {page > 1 && <Button variant="outline" size="sm" asChild>
                        <Link href={ordersHref(view, Math.min(page - 1, pageCount))} scroll={false}><ChevronLeft className="size-4" /> Previous</Link>
                    </Button>}
                    {page < pageCount && <Button variant="outline" size="sm" asChild>
                        <Link href={ordersHref(view, page + 1)} scroll={false}>Next <ChevronRight className="size-4" /></Link>
                    </Button>}
                </nav>}
            </div>}
            {selected ? <SelectedOrder order={selected} href={ordersHref(view, page, selected.id)} unread={unread[selected.id]} />
                : <div className="min-w-0 rounded-2xl border bg-card p-5">
                    <h2 className="font-semibold">{selectionError ? "Order details couldn’t load" : selectionMissing ? "This order is unavailable" :
                        page > 1 ? "No orders on this page" : view === "active" ? "No active orders" : "No past orders"}</h2>
                    {(selectionError || selectionMissing) && <p className="mt-1 text-sm text-muted-foreground">Choose another order from the list or refresh to try again.</p>}
                </div>}
        </div>
    </div>

    return <OrderChatPanel orders={selected ? [{ id: selected.id, name: orderNumber(selected.id) }] : []}
        initialOrderId={selected?.id ?? ""} workspace="merchant" unread={selected ? unread[selected.id] : undefined}>
        {content}
    </OrderChatPanel>
}

function SelectedOrder({ order, href, unread }: { order: MerchantOrderDetail; href: string; unread?: OrderChatUnread }) {
    const step = getNextStep(order)
    const items = order.order_items ?? []
    const customer = firstRelation(order.customer)
    const agent = firstRelation(order.agent)
    const rider = firstRelation(order.rider)
    const contacts = [
        { role: "Coordinating agent", person: agent, assigned: order.assigned_agent_id },
        { role: "Assigned rider", person: rider, assigned: order.rider_id },
        { role: "Customer", person: customer, assigned: customer },
    ]
    const riderStages = ["ready_for_pickup", "out_for_delivery", "delivery_failed", "rescheduled", "return_in_transit"]
    const lead = order.rider_id && riderStages.includes(order.status ?? "") ? contacts[1] : contacts.find((contact) => contact.assigned)
    const coordinates = order.delivery_location?.coordinates
    const address = order.delivery_address_snapshot?.address_label
    const canConfirm = order.status === "awaiting_merchant_confirmation"
    const canVerify = order.status === "ready_for_pickup" && Boolean(order.rider_id)

    return <section className="min-w-0 space-y-4 rounded-2xl border bg-card p-4 sm:p-5" aria-labelledby="merchant-selected-order">
        <KeepMerchantOrderSelected href={href} />
        <header className="flex flex-wrap items-start justify-between gap-2">
            <div>
                <h2 id="merchant-selected-order" className="text-xl font-bold">Order #{orderNumber(order.id)}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    {formatPaymentStatus(order.payment_status)}{order.created_at ? ` · ${placedDate.format(new Date(order.created_at))}` : ""}
                </p>
            </div>
            <Badge variant="outline" className={getOrderStatusTone(order.status)}>{shortStatus(order)}</Badge>
        </header>
        <div className="space-y-1.5 rounded-xl bg-orange-50 p-3 dark:bg-orange-950/40 sm:p-4" aria-live="polite">
            <p className="text-sm font-semibold text-orange-900 dark:text-orange-200">{step.owner}</p>
            <h3 className="font-semibold">{step.title}</h3>
            {step.description && <p className="text-sm text-muted-foreground">{step.description}</p>}
            {canConfirm && <div className="pt-1"><ConfirmOrderButton key={order.id} orderId={order.id} orderHref={href} /></div>}
            {canVerify && <VerifyPickupWidget key={order.id} orderId={order.id} orderHref={href} />}
        </div>
        <section aria-label="Order items">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                <h3 className="flex items-center gap-2 font-semibold"><ClipboardList className="size-4 text-muted-foreground" aria-hidden="true" />
                    {canConfirm || order.status === "processing" ? "Items to prepare" : "Order items"}
                </h3>
                <span className="text-sm text-muted-foreground">{items.reduce((total, item) => total + item.quantity, 0)} units</span>
            </div>
            {items.length > 0 ? <ul className="divide-y">
                {items.map((item) => <li key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2 py-2.5 text-sm">
                    <span className="break-words font-medium">{firstRelation(item.products)?.name || "Product"}</span>
                    <span className="text-right tabular-nums">×{item.quantity}</span>
                    <span className="text-right text-muted-foreground tabular-nums sm:min-w-24">{formatKobo(item.quantity * item.price_per_unit)}</span>
                </li>)}
            </ul> : <p className="py-2 text-sm text-muted-foreground">Item details are unavailable.</p>}
            <div className="flex justify-between gap-2 border-t pt-2.5 text-sm font-semibold tabular-nums">
                <span>Order total</span><span>{formatKobo(order.total_amount)}</span>
            </div>
        </section>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
            <div className="flex min-w-0 items-center gap-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-orange-100 text-orange-900"><UserRound className="size-4" aria-hidden="true" /></span>
                <div className="min-w-0">
                    <p className="break-words text-sm font-semibold">{lead?.person?.full_name || lead?.role || "Order contacts"}</p>
                    {lead?.person?.full_name && <p className="text-xs text-muted-foreground">{lead.role}</p>}
                </div>
            </div>
            <div className="flex flex-wrap gap-2">
                {lead && <OrderCall phone={lead.person?.phone} label={lead.person?.full_name || lead.role} />}
                <OrderChatButton orderId={order.id} unread={unread} />
            </div>
        </div>
        <details key={order.id} className="border-t pt-3 text-sm">
            <summary className="cursor-pointer font-medium">Delivery and contacts</summary>
            <div className="mt-2 space-y-2">
                {contacts.filter(({ assigned }) => Boolean(assigned)).map(({ person, role }) => <div key={role} className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0"><p className="break-words font-medium">{person?.full_name || role}</p>
                        {person?.full_name && <p className="text-xs text-muted-foreground">{role}</p>}</div>
                    <OrderCall phone={person?.phone} label={person?.full_name || role} />
                </div>)}
                {(address || coordinates) && <p className="break-words text-muted-foreground">{address || `Delivery coordinates ${coordinates?.[1]?.toFixed(4)}, ${coordinates?.[0]?.toFixed(4)}`}</p>}
            </div>
        </details>
    </section>
}
