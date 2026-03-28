import { NextResponse } from "next/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database.types"

interface ImpressionPayload {
    adId?: string
}

function createPublicClient() {
    return createSupabaseClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                detectSessionInUrl: false,
                persistSession: false,
            },
            global: {
                headers: {
                    apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                    Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
                },
            },
        }
    )
}

export async function POST(request: Request) {
    try {
        const payload = await request.json() as ImpressionPayload

        if (!payload.adId) {
            return NextResponse.json({ error: "Ad ID is required." }, { status: 400 })
        }

        const supabase = createPublicClient()
        await supabase.rpc("record_ad_impression", {
            p_ad_id: payload.adId,
        })

        return new NextResponse(null, { status: 204 })
    } catch {
        return new NextResponse(null, { status: 204 })
    }
}
