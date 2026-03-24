import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { canUpdateAccountPassword } from "@/lib/authProviders"
import { PasswordSettingsClient } from "./PasswordSettingsClient"

export default async function PasswordPage() {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect("/login")
    }

    if (!canUpdateAccountPassword(user)) {
        redirect("/account")
    }

    return <PasswordSettingsClient />
}
