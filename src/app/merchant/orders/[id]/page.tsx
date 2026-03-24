import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, MapPin, MessageSquare, Phone, User, Package, Clock, Truck, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { VerifyPickupWidget } from "@/components/merchant/VerifyPickupWidget"
import { ConfirmOrderButton } from "@/components/merchant/ConfirmOrderButton"
import { formatKobo } from "@/lib/money"
import { formatOrderStatus, getOrderOperationalHint, getOrderStatusTone } from "@/lib/orders"

interface MerchantOrderDetail {
    id: string
    created_at: string
    status: string
    total_amount: number
    rider_id: string | null
    delivery_location: { coordinates?: [number, number] } | null
    order_items: Array<{
        id: string
        quantity: number
        price_per_unit: number
        products: {
            name: string | null
            image_url: string | null
        } | null
    }>
    customer: {
        full_name: string | null
        phone: string | null
        email?: string | null
    } | null
    rider: {
        full_name: string | null
        phone: string | null
        avatar_url: string | null
    } | null
    agent: {
        full_name: string | null
        phone: string | null
        avatar_url: string | null
    } | null
}

export default async function MerchantOrderDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect("/login")
    }

    const { data, error } = await supabase
        .from("orders")
        .select(`
            id,
            created_at,
            status,
            total_amount,
            rider_id,
            delivery_location,
            order_items (
                id,
                quantity,
                price_per_unit,
                products (
                    name,
                    image_url
                )
            ),
            customer:customer_id (
                full_name,
                phone
            ),
            agent:assigned_agent_id (
                full_name,
                phone,
                avatar_url
            ),
            rider:rider_id (
                full_name,
                phone,
                avatar_url
            )
        `)
        .eq("id", id)
        .eq("merchant_id", user.id)
        .single()

    const order = data as MerchantOrderDetail | null

    if (error || !order) {
        if (error) {
            console.error("Error fetching merchant order detail:", error)
        }

        return (
            <div className="p-8 text-center text-red-500">
                Order not found
                {error && <p className="text-sm text-gray-500 mt-2">{error.message}</p>}
            </div>
        )
    }

    const deliveryCoordinates = order.delivery_location?.coordinates
    const statusHint = getOrderOperationalHint(order.status, { riderAssigned: Boolean(order.rider_id) })

    return (
        <div className="mx-auto max-w-5xl space-y-6 sm:space-y-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/merchant/orders">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                    </Button>
                    <div>
                        <h1 className="flex flex-wrap items-center gap-3 text-2xl font-extrabold text-gray-900 dark:text-white sm:text-3xl">
                            Order #{order.id.slice(0, 8)}
                            <Badge className={`border ${getOrderStatusTone(order.status)}`}>
                                {formatOrderStatus(order.status)}
                            </Badge>
                        </h1>
                        <p className="text-gray-500">Placed on {new Date(order.created_at).toLocaleString()}</p>
                        {statusHint && <p className="mt-2 text-sm text-gray-500">{statusHint}</p>}
                    </div>
                </div>

                <div className="flex flex-wrap gap-3">
                    {order.status === "awaiting_merchant_confirmation" && (
                        <ConfirmOrderButton orderId={order.id} />
                    )}
                    {order.status === "processing" && !order.rider_id && (
                        <Button disabled variant="secondary" className="bg-blue-100 text-blue-700">
                            <Clock className="mr-2 h-4 w-4" />
                            Waiting for agent to request rider
                        </Button>
                    )}
                    {order.status === "ready_for_pickup" && !order.rider_id && (
                        <Button disabled variant="secondary" className="bg-orange-100 text-orange-700">
                            <Clock className="mr-2 h-4 w-4" />
                            Waiting for rider to claim
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Package className="h-5 w-5 text-gray-500" />
                                Order Items
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="divide-y">
                            {order.order_items.map((item) => (
                                <div key={item.id} className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex items-start gap-4 sm:items-center">
                                        <div className="h-16 w-16 bg-gray-100 rounded-lg overflow-hidden">
                                            {item.products?.image_url && (
                                                <img
                                                    src={item.products.image_url}
                                                    alt={item.products.name ?? "Product image"}
                                                    className="h-full w-full object-cover"
                                                />
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-gray-900 dark:text-white">{item.products?.name}</p>
                                            <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                                        </div>
                                    </div>
                                    <p className="font-mono font-medium sm:text-right">{formatKobo(item.price_per_unit * item.quantity)}</p>
                                </div>
                            ))}
                            <div className="flex items-center justify-between gap-3 pt-4 text-lg font-bold">
                                <span>Total</span>
                                <span>{formatKobo(order.total_amount)}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-8">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <MessageSquare className="h-5 w-5 text-gray-500" />
                                Order communication
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {order.agent ? (
                                <div className="flex items-center gap-3">
                                    <div className="h-12 w-12 rounded-full bg-gray-200 overflow-hidden">
                                        {order.agent.avatar_url ? (
                                            <img src={order.agent.avatar_url} alt={order.agent.full_name ?? "Agent"} className="h-full w-full object-cover" />
                                        ) : (
                                            <User className="h-full w-full p-2 text-gray-400" />
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-bold text-lg truncate">{order.agent.full_name || "Assigned Agent"}</p>
                                        <p className="text-sm text-gray-500">This agent is coordinating the order.</p>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500">An assigned agent will appear here once the order enters managed dispatch.</p>
                            )}

                            <div className="flex flex-wrap gap-2">
                                {order.agent?.phone && (
                                    <Button asChild variant="outline" className="border-orange-200 text-[#F58220] hover:bg-orange-50">
                                        <a href={`tel:${order.agent.phone}`}>
                                            <Phone className="mr-2 h-4 w-4" />
                                            Call agent
                                        </a>
                                    </Button>
                                )}
                                <Button asChild className="bg-[#F58220] hover:bg-[#E57210]">
                                    <Link href={`/merchant/messages?order=${order.id}`}>
                                        <MessageSquare className="mr-2 h-4 w-4" />
                                        Open chat
                                    </Link>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <User className="h-5 w-5 text-gray-500" />
                                Customer
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <p className="font-bold">{order.customer?.full_name || "Guest"}</p>
                                {order.customer?.phone && (
                                    <a href={`tel:${order.customer.phone}`} className="text-sm text-blue-600 hover:underline flex items-center gap-1 mt-1">
                                        <Phone className="h-3 w-3" />
                                        {order.customer.phone}
                                    </a>
                                )}
                            </div>
                            {deliveryCoordinates && (
                                <div className="pt-4 border-t">
                                    <p className="text-sm font-bold flex items-center gap-1 mb-1">
                                        <MapPin className="h-4 w-4" />
                                        Delivery Location
                                    </p>
                                    <p className="text-sm text-gray-500 break-words">
                                        Latitude: {deliveryCoordinates[1]?.toFixed(4)}, Longitude: {deliveryCoordinates[0]?.toFixed(4)}
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {order.rider && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Truck className="h-5 w-5 text-gray-500" />
                                    Rider Assigned
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-12 w-12 rounded-full bg-gray-200 overflow-hidden">
                                        {order.rider.avatar_url ? (
                                            <img src={order.rider.avatar_url} alt={order.rider.full_name ?? "Rider"} className="h-full w-full object-cover" />
                                        ) : (
                                            <User className="h-full w-full p-2 text-gray-400" />
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-bold text-lg">{order.rider.full_name}</p>
                                        {order.rider.phone && (
                                            <a href={`tel:${order.rider.phone}`} className="text-xs flex items-center gap-1 bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200 transition-colors">
                                                <Phone className="h-3 w-3" />
                                                Call Rider
                                            </a>
                                        )}
                                    </div>
                                </div>

                                {order.status === "ready_for_pickup" ? (
                                    <VerifyPickupWidget orderId={order.id} />
                                ) : (
                                    <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm flex items-center gap-2">
                                        <CheckCircle2 className="h-4 w-4" />
                                        {order.status === "out_for_delivery" || order.status === "completed"
                                            ? "Pickup verified. Rider is heading to the customer."
                                            : "Rider assigned"}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    )
}
