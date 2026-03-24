import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ProfileSidebar } from "@/components/account/ProfileSidebar"
import { GiftCardClient } from "./GiftCardClient"

export default async function GiftCardPage() {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect("/login")
    }

    return (
        <div className="min-h-screen bg-gray-50/50 py-6 dark:bg-black sm:py-8 lg:py-12">
            <div className="container mx-auto px-4 sm:px-6">
                <div className="mb-6 sm:mb-8">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">Gift Cards</h1>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 sm:text-base">
                        Send value to another RSS Foods user, track card activity, and spend received cards at checkout.
                    </p>
                </div>

                <div className="flex flex-col gap-5 sm:gap-6 lg:flex-row lg:gap-8">
                    <aside className="w-full flex-shrink-0 lg:w-80">
                        <ProfileSidebar />
                    </aside>

                    <main className="min-w-0 flex-1">
                        <GiftCardClient />
                    </main>
                </div>
            </div>
        </div>
    )
}
