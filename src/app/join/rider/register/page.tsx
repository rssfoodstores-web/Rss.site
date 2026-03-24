import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import DeliveryRegistrationForm from "@/components/delivery/DeliveryRegistrationForm"
import { Metadata } from "next"

export const metadata: Metadata = {
    title: "Become a Rider | RSSA",
    description: "Join our fleet and earn by delivering fresh produce.",
}

export default async function RiderRegisterPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
        const { data: roles } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)

        if (roles && roles.length > 0) {
            const roleNames = roles.map(r => r.role)
            if (roleNames.includes("rider")) redirect("/rider")
        }
    }
    return (
        <div className="min-h-screen bg-white dark:bg-zinc-950 flex flex-col lg:flex-row">
            {/* Left Column: Register Form */}
            <div className="flex-1 px-4 py-8 md:px-12 lg:px-24 flex flex-col justify-center max-w-4xl mx-auto w-full">
                <header className="mb-10">
                    <h1 className="text-4xl font-extrabold text-[#1A1A1A] dark:text-gray-100 mb-2">Join as a Rider</h1>
                    <p className="text-xl text-[#8E8E93] font-medium">Deliver freshness, earn on your schedule.</p>
                </header>

                <DeliveryRegistrationForm />
            </div>

            {/* Right Column: Hero Image / Info */}
            <div className="hidden lg:block lg:w-[45%] bg-[#F58220] relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1617347454431-f49d7ff5c3b1?q=80&w=2930&auto=format&fit=crop')] bg-cover bg-center mix-blend-multiply opacity-40"></div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>

                <div className="absolute bottom-0 left-0 p-16 text-white text-left z-10">
                    <h2 className="text-5xl font-extrabold leading-tight mb-6">Ride with Pride. <br /> Deliver Joy.</h2>
                    <ul className="space-y-4 text-xl font-medium text-orange-100">
                        <li className="flex items-center gap-3">
                            <span className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">✓</span>
                            Flexible Working Hours
                        </li>
                        <li className="flex items-center gap-3">
                            <span className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">✓</span>
                            Competitive Commission
                        </li>
                        <li className="flex items-center gap-3">
                            <span className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">✓</span>
                            Weekly Payouts
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    )
}
