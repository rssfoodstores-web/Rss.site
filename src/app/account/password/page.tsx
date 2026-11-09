import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { canUpdateAccountPassword } from "@/lib/authProviders"
import { ChangePasswordForm } from "./PasswordSettingsClient"

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

    return <main className="container mx-auto px-4 py-6 sm:px-6"><h1 className="mb-5 text-2xl font-bold">Change password</h1><ChangePasswordForm /></main>
}
