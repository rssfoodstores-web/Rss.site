import { NextResponse } from "next/server"
import { getGiftCardCheckoutSummary } from "@/app/account/gift-card/actions"
import { getWalletData } from "@/app/account/wallet/actions"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    }

    const [walletData, giftCardSummary] = await Promise.all([
        getWalletData(),
        getGiftCardCheckoutSummary(),
    ])

    if ("error" in walletData && walletData.error) {
        return NextResponse.json({ error: walletData.error }, { status: 500 })
    }

    return NextResponse.json({
        gift_card_balance: giftCardSummary.availableBalanceKobo ?? 0,
        gift_card_count: giftCardSummary.activeCount ?? 0,
        wallet_balance: walletData.wallet?.balance ?? 0,
    })
}
