import { createBrowserClient } from "@supabase/ssr"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database.types"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

let client: ReturnType<typeof createBrowserClient> | undefined
let publicStorefrontClient: ReturnType<typeof createSupabaseClient<Database>> | undefined

export function createClient() {
    if (client) return client

    client = createBrowserClient(supabaseUrl, supabaseAnonKey)

    return client
}

export function createPublicStorefrontClient() {
    if (publicStorefrontClient) return publicStorefrontClient

    publicStorefrontClient = createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey, {
        auth: {
            autoRefreshToken: false,
            detectSessionInUrl: false,
            persistSession: false,
            storageKey: "rssa-public-storefront",
        },
        global: {
            headers: {
                apikey: supabaseAnonKey,
                Authorization: `Bearer ${supabaseAnonKey}`,
            },
        },
    })

    return publicStorefrontClient
}
