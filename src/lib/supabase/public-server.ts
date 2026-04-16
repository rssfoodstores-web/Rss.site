import { createClient as createSupabaseClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export function createPublicServerClient() {
    return createSupabaseClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            autoRefreshToken: false,
            detectSessionInUrl: false,
            persistSession: false,
        },
        global: {
            headers: {
                Authorization: `Bearer ${supabaseAnonKey}`,
                apikey: supabaseAnonKey,
            },
        },
    })
}
