import { NextResponse } from "next/server"

export async function POST(request: Request) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !anonKey) {
        return NextResponse.json(
            { error: "Supabase configuration missing for webhook proxy." },
            { status: 500 }
        )
    }

    const bodyText = await request.text()
    const signature = request.headers.get("monnify-signature")

    const response = await fetch(`${supabaseUrl}/functions/v1/monnify-webhook`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "apikey": anonKey,
            "Authorization": `Bearer ${anonKey}`,
            ...(signature ? { "monnify-signature": signature } : {}),
        },
        body: bodyText,
    })

    const responseText = await response.text()

    return new NextResponse(responseText, {
        status: response.status,
        headers: {
            "Content-Type": response.headers.get("content-type") ?? "application/json",
        },
    })
}
