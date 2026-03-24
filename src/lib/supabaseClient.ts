
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

console.log("Supabase Config Debug:", {
  url: supabaseUrl ? "Defined" : "Undefined",
  key: supabaseAnonKey ? "Defined" : "Undefined"
});

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(`Missing Supabase environment variables. URL: ${supabaseUrl}, Key: ${supabaseAnonKey ? 'HIDDEN' : 'MISSING'}`)
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
