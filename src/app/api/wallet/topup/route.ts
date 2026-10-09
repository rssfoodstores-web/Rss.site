import { NextRequest, NextResponse } from "next/server"
import { initializeTopUp } from "@/app/account/wallet/actions"

export async function POST(request: NextRequest) {
    const requestUrl = new URL(request.url)
    const origin = request.headers.get("origin")
    const fetchSite = request.headers.get("sec-fetch-site")

    if ((origin && origin !== requestUrl.origin) || (!origin && fetchSite === "cross-site")) {
        return NextResponse.json({ error: "Invalid request origin." }, { status: 403 })
    }

    const formData = await request.formData()
    const amountValue = formData.get("amount")
    const amount = typeof amountValue === "string" ? Number(amountValue) : Number.NaN
    let result: Awaited<ReturnType<typeof initializeTopUp>>
    try {
        result = await initializeTopUp(amount)
    } catch (error) {
        console.error("Wallet top-up route failed:", error)
        return redirectWithTopupError(requestUrl, "Unable to start payment right now. Please try again.")
    }

    if (result.success && result.checkoutUrl) {
        let checkoutUrl: URL
        try {
            checkoutUrl = new URL(result.checkoutUrl)
        } catch {
            return redirectWithTopupError(requestUrl, "Monnify returned an invalid checkout link. Please try again.")
        }

        if (checkoutUrl.protocol !== "https:" || !checkoutUrl.hostname.endsWith(".monnify.com")) {
            return redirectWithTopupError(requestUrl, "Monnify returned an invalid checkout link. Please try again.")
        }

        return NextResponse.redirect(checkoutUrl, 303)
    }

    return redirectWithTopupError(requestUrl, result.error || "Unable to start payment. Please try again.")
}

function redirectWithTopupError(requestUrl: URL, message: string) {
    const walletUrl = new URL("/account/wallet", requestUrl)
    walletUrl.searchParams.set("topup_error", message)
    return NextResponse.redirect(walletUrl, 303)
}

