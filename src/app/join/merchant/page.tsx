"use client"

import { Store, CheckCircle2, TrendingUp, Users, ShieldCheck, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

const BENEFIT_ACCENTS = {
    blue: "bg-blue-50 text-blue-500",
    green: "bg-green-50 text-green-500",
    orange: "bg-orange-50 text-orange-500",
    purple: "bg-purple-50 text-purple-500",
} as const

export default function MerchantExplanationPage() {
    const router = useRouter()
    const supabase = createClient()

    const handleRegister = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            router.push('/register/merchant')
        } else {
            router.push('/register')
        }
    }

    const benefits = [
        {
            title: "Reach More Customers",
            description: "Tap into our extensive network of shoppers looking for quality food and groceries.",
            icon: Users,
            color: "blue"
        },
        {
            title: "Low Commissions",
            description: "Enjoy industry-leading low commission rates, so you keep more of your hard-earned profits.",
            icon: TrendingUp,
            color: "green"
        },
        {
            title: "Secure Payments",
            description: "Receive payments directly to your wallet or bank account with our automated settlement system.",
            icon: ShieldCheck,
            color: "purple"
        },
        {
            title: "Store Management",
            description: "Manage your inventory, orders, and promotions easily with our powerful merchant dashboard.",
            icon: Store,
            color: "orange"
        }
    ]

    return (
        <div className="min-h-screen bg-white dark:bg-black">
            {/* Hero Section */}
            <section className="relative py-20 lg:py-32 overflow-hidden bg-gray-50 dark:bg-zinc-900/50">
                <div className="absolute top-0 right-0 w-1/3 h-full bg-[#F58220]/5 -skew-x-12 translate-x-20"></div>
                <div className="container mx-auto px-4 relative z-10">
                    <div className="max-w-3xl">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#F58220]/10 text-[#F58220] font-bold text-sm mb-6">
                            <Store className="h-4 w-4" /> Partner with RSS Foods
                        </div>
                        <h1 className="text-5xl lg:text-7xl font-extrabold text-gray-900 dark:text-white mb-6 leading-tight">
                            Grow your business <br />
                            <span className="text-[#F58220]">as an RSS Merchant.</span>
                        </h1>
                        <p className="text-xl text-gray-500 dark:text-gray-400 mb-10 leading-relaxed max-w-2xl">
                            Join thousands of successful vendors selling fresh groceries and quality food on Nigeria&apos;s fastest-growing food marketplace.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <Button onClick={handleRegister} className="bg-[#F58220] hover:bg-[#F58220]/90 text-white font-extrabold px-10 py-7 rounded-2xl text-xl shadow-xl shadow-orange-500/20 w-fit">
                                Become a Merchant <ArrowRight className="ml-2 h-6 w-6" />
                            </Button>
                            <Button variant="ghost" className="px-10 py-7 rounded-2xl text-xl font-bold dark:text-white">
                                Learn More
                            </Button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Benefits Grid */}
            <section className="py-24 container mx-auto px-4">
                <div className="text-center mb-16">
                    <h2 className="text-3xl lg:text-4xl font-bold mb-4">Why Sell on RSS Foods?</h2>
                    <p className="text-gray-500">Everything you need to succeed in the digital food marketplace.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {benefits.map((benefit, idx) => (
                        <div key={idx} className="p-8 rounded-3xl border border-gray-100 dark:border-zinc-800 hover:shadow-xl transition-all group">
                            <div className={`h-14 w-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform ${BENEFIT_ACCENTS[benefit.color as keyof typeof BENEFIT_ACCENTS]}`}>
                                <benefit.icon className="h-7 w-7" />
                            </div>
                            <h3 className="text-xl font-bold mb-3">{benefit.title}</h3>
                            <p className="text-gray-500 dark:text-gray-400 leading-relaxed text-sm">
                                {benefit.description}
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Fast Registration Steps */}
            <section className="py-24 bg-gray-50 dark:bg-zinc-900/30">
                <div className="container mx-auto px-4">
                    <div className="max-w-5xl mx-auto bg-white dark:bg-zinc-900 rounded-[3rem] p-8 lg:p-16 shadow-2xl border border-gray-100 dark:border-zinc-800 flex flex-col lg:flex-row gap-12 items-center">
                        <div className="flex-1">
                            <h2 className="text-4xl font-bold mb-8 leading-tight">Ready to get started? <br /> It&apos;s as easy as 1-2-3.</h2>
                            <div className="space-y-8">
                                {[
                                    { step: "01", title: "Fill the Form", desc: "Provide your business details and upload required documents." },
                                    { step: "02", title: "Wait for Approval", desc: "Our team will review your application within 24-48 hours." },
                                    { step: "03", title: "Start Selling", desc: "Upload your products and start receiving orders immediately." }
                                ].map((s, idx) => (
                                    <div key={idx} className="flex gap-6">
                                        <div className="text-4xl font-black text-[#F58220]/20">{s.step}</div>
                                        <div>
                                            <h4 className="font-bold text-lg mb-1">{s.title}</h4>
                                            <p className="text-gray-500 text-sm">{s.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-12 block">
                                <Button onClick={handleRegister} className="w-full bg-[#F58220] hover:bg-[#E57210] h-16 rounded-2xl font-bold text-white text-lg">
                                    Start Registration Now
                                </Button>
                            </div>
                        </div>
                        <div className="flex-1 w-full flex items-center justify-center p-8 bg-orange-50/50 dark:bg-zinc-800/50 rounded-[2rem]">
                            <div className="relative">
                                <div className="absolute -inset-4 bg-orange-500/10 blur-3xl rounded-full"></div>
                                <CheckCircle2 className="h-48 w-48 text-[#F58220] relative z-10" />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer CTA */}
            <section className="py-20 text-center container mx-auto px-4">
                <h2 className="text-3xl font-bold mb-8 italic text-gray-400">&ldquo;Your success is our priority.&rdquo;</h2>
                <div className="flex justify-center gap-4">
                    <Button onClick={handleRegister} className="bg-[#F58220] text-white font-bold h-12 px-8 rounded-xl shadow-lg shadow-orange-500/20">
                        Apply Now
                    </Button>
                    <Link href="/contact">
                        <Button variant="outline" className="border-gray-200 h-12 px-8 rounded-xl font-bold">
                            Contact Support
                        </Button>
                    </Link>
                </div>
            </section>
        </div>
    )
}
