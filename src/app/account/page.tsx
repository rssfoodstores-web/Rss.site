import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { ProfileSidebar } from "@/components/account/ProfileSidebar"
import { DashboardStats } from "@/components/account/DashboardStats"
import { AccountDetailsCards } from "@/components/account/AccountDetailsCards"

export default async function AccountPage() {
    const cookieStore = await cookies()

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                        // The `setAll` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
            },
        }
    )

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect("/login")
    }

    // Fetch Profile
    const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()

    // Fetch Roles
    const { data: userRoles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)

    // Fetch Order Stats
    const { count: totalOrders } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("customer_id", user.id)

    const { count: pendingOrders } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("customer_id", user.id)
        .eq("status", "pending")

    const { count: completedOrders } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("customer_id", user.id)
        .in("status", ["completed", "delivered"])

    const { count: processingOrders } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("customer_id", user.id)
        .in("status", ["processing", "out_for_delivery"])

    // Fetch Wallet
    const { data: wallet } = await supabase
        .from("wallets")
        .select("*")
        .eq("id", user.id)
        .single()

    if (!profile) {
        // Handle edge case where profile was not created (should exist via trigger, but safe fallback)
        return <div>Error loading profile. Please contact support.</div>
    }

    const currentRoles = userRoles?.map(r => r.role) || ["customer"]

    return (
        <div className="min-h-screen bg-gray-50/50 py-6 dark:bg-black sm:py-8 lg:py-12">
            <div className="container mx-auto px-4 sm:px-6">
                {/* Breadcrumb / Header */}
                <div className="mb-6 sm:mb-8">
                    <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">My Account</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 sm:text-base">Manage your profile, orders, and preferences.</p>
                </div>

                <div className="flex flex-col gap-5 sm:gap-6 lg:flex-row lg:gap-8">
                    {/* Sidebar Navigation */}
                    <aside className="w-full flex-shrink-0 lg:sticky lg:top-4 lg:z-10 lg:w-80">
                        <ProfileSidebar />
                    </aside>

                    {/* Main Dashboard Content */}
                    <main className="min-w-0 flex-1">
                        <DashboardStats
                            totalOrders={totalOrders || 0}
                            pendingOrders={pendingOrders || 0}
                            completedOrders={completedOrders || 0}
                            processingOrders={processingOrders || 0}
                        />
                        <AccountDetailsCards
                            user={user}
                            profile={profile}
                            roles={currentRoles}
                            wallet={wallet}
                        />
                    </main>
                </div>
            </div>
        </div>
    )
}
