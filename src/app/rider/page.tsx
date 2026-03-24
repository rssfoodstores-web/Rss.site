import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Clock, AlertCircle } from "lucide-react"
import Link from "next/link"

import { RiderMissionControl } from "@/components/rider/dashboard/RiderMissionControl"

type MerchantLocationValue =
    | string
    | { type?: string; coordinates?: [number, number] }
    | null

export default async function RiderDashboard() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect("/login")
    }

    const { data: riderProfile } = await supabase
        .from("rider_profiles")
        .select("*")
        .eq("id", user.id)
        .single()

    if (!riderProfile) {
        redirect("/join/rider/register")
    }

    // Pending State
    if (riderProfile.status === "pending") {
        return (
            <div className="max-w-3xl mx-auto py-12">
                <Card className="border-orange-200 bg-orange-50 dark:bg-orange-900/10">
                    <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                        <div className="h-20 w-20 bg-orange-100 rounded-full flex items-center justify-center mb-6">
                            <Clock className="h-10 w-10 text-[#F58220]" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Application Pending</h2>
                        <p className="text-gray-600 dark:text-gray-400 max-w-md mb-6">
                            Thanks for applying! Our team is currently reviewing your documents.
                            This process usually takes 24-48 hours. We&apos;ll notify you once approved.
                        </p>
                        <Button asChild className="bg-[#F58220] hover:bg-[#E57210]">
                            <Link href="/account">Back to Profile</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    // Rejected State
    if (riderProfile.status === "rejected") {
        return (
            <div className="max-w-3xl mx-auto py-12">
                <Card className="border-red-200 bg-red-50 dark:bg-red-900/10">
                    <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                        <div className="h-20 w-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
                            <AlertCircle className="h-10 w-10 text-red-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Application Update</h2>
                        <p className="text-gray-600 dark:text-gray-400 max-w-md mb-6">
                            Unfortunately, we couldn&apos;t approve your application at this time.
                            Please contact support for more information.
                        </p>
                        <Button variant="outline" asChild>
                            <Link href="/contact">Contact Support</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    // Approved Dashboard Logic

    const { data: activeOrders } = await supabase
        .from("orders")
        .select(`
            *,
            order_items (
                *,
                products (*)
            )
        `)
        .eq("rider_id", user.id)
        .in("status", ["ready_for_pickup", "out_for_delivery"])
        .order("rider_assigned_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(10)

    // 2. Nearby orders are loaded on the client after real rider location is available.
    const availableOrders: NonNullable<typeof activeOrders> = []

    // 3. Key Stats Calculation
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayIso = today.toISOString()

    // A. Wallet & Earnings
    const { data: wallet } = await supabase
        .from("wallets")
        .select("id, balance")
        .eq("owner_id", user.id)
        .eq("type", "rider")
        .single()

    let todaysEarnings = 0
    if (wallet) {
        // Query ledger entries for this wallet today
        const { data: earningsData } = await supabase
            .from("ledger_entries")
            .select("amount")
            .eq("wallet_id", wallet.id)
            .gte("created_at", todayIso)
            .gt("amount", 0) // Only count credits

        if (earningsData) {
            todaysEarnings = earningsData.reduce((sum, entry) => sum + entry.amount, 0)
        }
    }

    // B. Trips Count
    const { count: todaysTrips } = await supabase
        .from("orders")
        .select("*", { count: 'exact', head: true })
        .eq("rider_id", user.id)
        .in("status", ["completed", "delivered"])
        .gte("delivery_verified_at", todayIso)

    const { data: recentCompletedRaw } = await supabase
        .from("orders")
        .select(`
            id,
            status,
            total_amount,
            created_at,
            delivery_verified_at,
            merchant_id,
            order_financials (
                rider_share_kobo
            )
        `)
        .eq("rider_id", user.id)
        .in("status", ["completed", "delivered"])
        .order("delivery_verified_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(8)

    const merchantIds = Array.from(
        new Set(
            [...(activeOrders ?? []), ...(recentCompletedRaw ?? [])]
                .map((order) => order.merchant_id)
                .filter(Boolean)
        )
    ) as string[]

    const merchantDirectory = new Map<string, { name: string; address: string; phone: string | null; location: MerchantLocationValue }>()

    await Promise.all(
        merchantIds.map(async (merchantId) => {
            const [{ data: merchantData }, { data: profileData }] = await Promise.all([
                supabase
                    .from("merchants")
                    .select("store_name, business_address, phone, location")
                    .eq("id", merchantId)
                    .maybeSingle(),
                supabase
                    .from("profiles")
                    .select("full_name, address, phone, location")
                    .eq("id", merchantId)
                    .maybeSingle(),
            ])

            merchantDirectory.set(merchantId, {
                name: merchantData?.store_name || profileData?.full_name || "Merchant",
                address: profileData?.address || merchantData?.business_address || "Location hidden",
                phone: merchantData?.phone || profileData?.phone || null,
                location: (merchantData?.location ?? profileData?.location ?? null) as MerchantLocationValue,
            })
        })
    )

    const merchantByOrderId = Object.fromEntries(
        (activeOrders ?? []).map((order) => [
            order.id,
            merchantDirectory.get(order.merchant_id ?? "") ?? null,
        ])
    )

    const recentCompletedOrders = (recentCompletedRaw ?? []).map((order) => ({
        id: order.id,
        status: order.status,
        total_amount: order.total_amount,
        payout_kobo: order.order_financials?.[0]?.rider_share_kobo ?? 0,
        created_at: order.created_at,
        delivery_verified_at: order.delivery_verified_at,
        merchant_name: merchantDirectory.get(order.merchant_id ?? "")?.name ?? "Merchant",
    }))

    // 5. Fetch General Profile for Avatar/Location
    const { data: userProfile } = await supabase
        .from("profiles")
        .select("avatar_url, address")
        .eq("id", user.id)
        .single()

    return (
        <RiderMissionControl
            riderId={user.id}
            activeOrders={activeOrders ?? []}
            availableOrders={availableOrders}
            recentCompletedOrders={recentCompletedOrders}
            riderName={riderProfile.full_name || "Rider"}
            riderAvatar={riderProfile.passport_photo_url || userProfile?.avatar_url}
            riderLocation={userProfile?.address ? userProfile.address.split(',')[0] : "Lagos, NG"}
            merchantByOrderId={merchantByOrderId}
            stats={{
                balance: wallet?.balance || 0,
                earnings: todaysEarnings,
                trips: todaysTrips || 0,
                hours: 0
            }}
        />
    )
}
