import { NextResponse } from "next/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database.types"

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

function resolveClickUrl(clickUrl: string, requestUrl: URL) {
    if (clickUrl.startsWith("/")) {
        return new URL(clickUrl, requestUrl.origin)
    }

    return new URL(clickUrl)
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const requestUrl = new URL(request.url)
    const supabase = createPublicClient()

    const { data: ad } = await supabase
        .from("ads")
        .select("id, click_url")
        .eq("id", id)
        .maybeSingle()

    if (!ad?.click_url) {
        return NextResponse.redirect(new URL("/", requestUrl.origin))
    }

    await supabase.rpc("record_ad_click", {
        p_ad_id: ad.id,
    })

    return NextResponse.redirect(resolveClickUrl(ad.click_url, requestUrl))
}
