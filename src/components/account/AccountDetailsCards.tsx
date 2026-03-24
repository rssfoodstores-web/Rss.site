import { User, MapPin } from "lucide-react"
import Link from "next/link"
import { Database } from "@/types/database.types"
import { User as AuthUser } from "@supabase/supabase-js"
import { RoleManagement } from "@/components/account/RoleManagement"
import { AvatarUpload } from "@/components/account/AvatarUpload"

type Profile = Database["public"]["Tables"]["profiles"]["Row"]
type AppRole = Database["public"]["Enums"]["app_role"][number]
type Wallet = Database["public"]["Tables"]["wallets"]["Row"]

interface AccountDetailsCardsProps {
    user: AuthUser
    profile: Profile
    roles: AppRole[]
    wallet: Wallet | null
}

export function AccountDetailsCards({ user, profile, roles, wallet }: AccountDetailsCardsProps) {
    // Determine Auth Method
    const authMethod = user.app_metadata.provider || "email"
    const mainRole = roles.includes("merchant")
        ? "Merchant"
        : roles.includes("agent")
            ? "Agent"
            : roles.includes("rider")
                ? "Rider"
                : roles.includes("supa_admin")
                    ? "Super Admin"
                    : roles.includes("sub_admin")
                        ? "Sub Admin"
                        : roles.includes("admin")
                            ? "Admin"
                            : (roles[0] || "Customer")

    return (
        <div className="space-y-5 sm:space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
                {/* Account Info */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden shadow-sm">
                    <div className="p-4 md:p-6 border-b border-gray-100 dark:border-zinc-800">
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                            <User className="h-5 w-5 text-[#F58220]" />
                            Account Details
                        </h3>
                    </div>
                    <div className="p-4 md:p-6 space-y-4">
                        <div className="flex items-start gap-4 sm:items-center">
                            {/* Avatar Upload Component */}
                            <AvatarUpload profile={profile} email={user.email || ""} />
                            <div className="min-w-0">
                                <h4 className="break-words font-bold text-gray-900 dark:text-white">{profile.full_name}</h4>
                                <p className="text-sm text-gray-500 capitalize">{roles.join(", ")}</p>
                            </div>
                        </div>
                        <div className="pt-2">
                            <p className="text-sm text-gray-500 mb-1">Email</p>
                            <p className="break-all text-sm font-medium text-gray-900 dark:text-white sm:text-base sm:break-normal">
                                {user.email}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">Via: {authMethod}</p>
                        </div>
                    </div>
                </div>

                {/* Billing Address / Address Book */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden shadow-sm">
                    <div className="p-4 md:p-6 border-b border-gray-100 dark:border-zinc-800">
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                            <MapPin className="h-5 w-5 text-[#F58220]" />
                            Address Book
                        </h3>
                    </div>
                    <div className="p-4 md:p-6 space-y-2">
                        <h4 className="font-bold text-gray-900 dark:text-white">{profile.full_name}</h4>
                        <p className="text-gray-600 dark:text-gray-400 min-h-[48px]">
                            {profile.address || "No address saved."}
                        </p>

                        <div className="pt-4 space-y-1">
                            <p className="text-sm text-gray-900 dark:text-white"><span className="text-gray-500">Phone:</span> {profile.phone || "N/A"}</p>
                        </div>

                        <div className="pt-4">
                            <Link href="/account/profile" className="text-[#F58220] text-sm font-bold uppercase hover:underline">
                                Edit Profile
                            </Link>
                        </div>
                    </div>
                </div>

                {/* User Status / Wallet */}
                <div className="bg-[#F58220] rounded-2xl border border-[#F58220] overflow-hidden shadow-sm text-white">
                    <div className="p-4 md:p-6 border-b border-white/20">
                        <h3 className="font-bold text-lg text-white flex items-center gap-2">
                            Your Status
                        </h3>
                    </div>
                    <div className="space-y-4 p-4 md:p-6">
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/10 p-4 backdrop-blur-sm">
                            <span className="font-medium text-white/90">Main Role</span>
                            <span className="font-bold bg-white text-[#F58220] px-3 py-1 rounded-full text-xs uppercase tracking-wide">
                                {mainRole}
                            </span>
                        </div>

                        <Link href="/account/wallet" className="block group">
                            <div className="space-y-2 bg-black/10 p-4 rounded-xl group-hover:bg-black/20 transition-colors">
                                <div className="flex flex-wrap justify-between gap-2 text-sm text-white/80">
                                    <span>Wallet Balance</span>
                                    <span className="text-white font-bold underline group-hover:no-underline">View Details</span>
                                </div>
                                <div className="flex flex-wrap items-end gap-1">
                                    <span className="text-xl font-bold sm:text-2xl">
                                        {new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format((wallet?.balance || 0) / 100)}
                                    </span>
                                    <span className="text-[10px] text-white/60 mb-1">(Real-time)</span>
                                </div>
                                <div className="w-full bg-black/20 rounded-full h-1.5 overflow-hidden">
                                    <div className="bg-white h-full rounded-full w-1/4 group-hover:w-full transition-all duration-700"></div>
                                </div>
                            </div>
                        </Link>
                        <p className="text-xs text-white/70">Top up your wallet for faster checkouts!</p>
                    </div>
                </div>
            </div>

            {/* Role Management Section */}
            <RoleManagement currentRoles={roles} />
        </div>
    )
}
