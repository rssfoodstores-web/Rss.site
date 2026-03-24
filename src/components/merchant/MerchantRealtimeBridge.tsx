"use client"

import { RouteRefreshBridge } from "@/components/realtime/RouteRefreshBridge"

export function MerchantRealtimeBridge({ merchantId }: { merchantId: string }) {
    return (
        <RouteRefreshBridge
            channelName={`merchant-live-${merchantId}`}
            subscriptions={[
                {
                    table: "orders",
                    filter: `merchant_id=eq.${merchantId}`,
                },
                {
                    table: "products",
                    filter: `merchant_id=eq.${merchantId}`,
                },
                {
                    table: "notifications",
                    filter: `user_id=eq.${merchantId}`,
                },
            ]}
        />
    )
}
