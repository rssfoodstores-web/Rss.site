import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { NotificationsClient } from "./NotificationsClient"

export default async function NotificationsPage() {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect("/login")
    }

    const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

    return <NotificationsClient initialNotifications={data ?? []} currentUserId={user.id} />
}
