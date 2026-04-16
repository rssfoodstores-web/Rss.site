"use client"

import { Button } from "@/components/ui/button"
import { FadeInUp, StaggerContainer, StaggerItem, FadeIn } from "@/components/ui/motion-container"
import { Users, Store, TrendingUp, Truck, Smartphone, CreditCard, CheckCircle } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export default function JoinAgentPage() {
    const router = useRouter()
    const supabase = createClient()

    const handleRegister = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            router.push('/join/agent/register')
        } else {
            router.push('/register')
        }
    }

    return (
        <div className="min-h-screen bg-background overflow-hidden">
            {/* Hero Section */}
            <div className="relative isolate pt-14 lg:pt-0">
                <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80" aria-hidden="true">
                    <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#F58220] to-[#ffc187] opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" style={{ clipPath: 'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)' }} />
                </div>

                <section className="container mx-auto px-4 py-20 lg:py-32">
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        <FadeInUp className="text-center lg:text-left">
                            <div className="inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold text-[#F58220] ring-1 ring-inset ring-[#F58220]/20 bg-[#F58220]/10 mb-6">
                                <span className="flex h-2 w-2 rounded-full bg-[#F58220] mr-2 animate-pulse"></span>
                                Now Recruiting Agents
                            </div>
                            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground mb-6">
                                Become a <span className="text-[#F58220]">Market Coordinator</span>
                            </h1>
                            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto lg:mx-0">
                                Bridge the gap between local merchants and the digital world. Manage sellers, coordinate logistics, and earn commissions on every deal you facilitate.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                                <Button onClick={handleRegister} className="bg-[#F58220] hover:bg-[#F58220]/90 text-white font-bold py-6 px-8 rounded-full text-lg shadow-lg hover:shadow-[#F58220]/30 transition-all">
                                    Register as Agent
                                </Button>
                            </div>
                        </FadeInUp>

                        <FadeIn className="relative hidden lg:block" delay={0.2}>
                            <div className="relative rounded-2xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 backdrop-blur-sm p-8 shadow-2xl">
                                <StaggerContainer className="space-y-4">
                                    <StaggerItem className="flex items-center gap-4 bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-sm border border-border/50">
                                        <div className="h-10 w-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 dark:text-green-400">
                                            <Store className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-sm">Merchant Onboarded</p>
                                            <p className="text-xs text-muted-foreground">Mama Nkechi&apos;s Store</p>
                                        </div>
                                        <span className="ml-auto text-green-600 font-bold text-sm">+500 pts</span>
                                    </StaggerItem>

                                    <StaggerItem className="flex items-center gap-4 bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-sm border border-border/50">
                                        <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400">
                                            <Truck className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-sm">Logistics Coordinated</p>
                                            <p className="text-xs text-muted-foreground">Order #88292 to Lekki</p>
                                        </div>
                                        <span className="ml-auto text-blue-600 font-bold text-sm">Active</span>
                                    </StaggerItem>

                                    <StaggerItem className="flex items-center gap-4 bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-sm border border-border/50">
                                        <div className="h-10 w-10 bg-[#F58220]/20 rounded-full flex items-center justify-center text-[#F58220]">
                                            <CreditCard className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-sm">Commission Earned</p>
                                            <p className="text-xs text-muted-foreground">Wallet Deposit</p>
                                        </div>
                                        <span className="ml-auto text-[#F58220] font-bold text-sm">+₦2,500</span>
                                    </StaggerItem>
                                </StaggerContainer>
                            </div>
                        </FadeIn>
                    </div>
                </section>
            </div>

            {/* Role Breakdown Section */}
            <section className="py-20 bg-muted/30">
                <div className="container mx-auto px-4">
                    <FadeInUp className="text-center max-w-3xl mx-auto mb-16">
                        <h2 className="text-3xl font-bold mb-4">You Are The <span className="text-[#F58220]">Facilitator</span></h2>
                        <p className="text-muted-foreground">
                            As an RSS Foods Agent, you are the connecting piece that makes local commerce possible on a digital scale.
                        </p>
                    </FadeInUp>

                    <StaggerContainer className="grid md:grid-cols-3 gap-8">
                        <StaggerItem className="bg-background rounded-2xl p-8 shadow-sm border border-border/50 hover:border-[#F58220]/50 transition-all hover:shadow-lg group">
                            <div className="h-14 w-14 bg-blue-100 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center text-blue-600 mb-6 group-hover:scale-110 transition-transform">
                                <Users className="h-7 w-7" />
                            </div>
                            <h3 className="text-xl font-bold mb-3">Manage Merchants</h3>
                            <p className="text-muted-foreground leading-relaxed">
                                You act as a proxy for local sellers who may not be tech-savvy. You handle their product uploads, manage prices, and ensure their inventory is visible online.
                            </p>
                        </StaggerItem>

                        <StaggerItem className="bg-background rounded-2xl p-8 shadow-sm border border-border/50 hover:border-[#F58220]/50 transition-all hover:shadow-lg group">
                            <div className="h-14 w-14 bg-green-100 dark:bg-green-900/20 rounded-2xl flex items-center justify-center text-green-600 mb-6 group-hover:scale-110 transition-transform">
                                <Smartphone className="h-7 w-7" />
                            </div>
                            <h3 className="text-xl font-bold mb-3">Coordinate Orders</h3>
                            <p className="text-muted-foreground leading-relaxed">
                                Receive orders on your app and coordinate with the merchant to pack items. Then, signal the delivery rider for pickup. You make fulfillment smooth.
                            </p>
                        </StaggerItem>

                        <StaggerItem className="bg-background rounded-2xl p-8 shadow-sm border border-border/50 hover:border-[#F58220]/50 transition-all hover:shadow-lg group">
                            <div className="h-14 w-14 bg-[#F58220]/20 rounded-2xl flex items-center justify-center text-[#F58220] mb-6 group-hover:scale-110 transition-transform">
                                <TrendingUp className="h-7 w-7" />
                            </div>
                            <h3 className="text-xl font-bold mb-3">Grow & Earn</h3>
                            <p className="text-muted-foreground leading-relaxed">
                                The more active merchants you manage and the more orders you facilitate, the more you earn. Track your &ldquo;Active Merchants&rdquo; KPI to maximize income.
                            </p>
                        </StaggerItem>
                    </StaggerContainer>
                </div>
            </section>

            {/* Steps / Timeline Section */}
            <section className="py-20 lg:py-32 container mx-auto px-4">
                <div className="grid lg:grid-cols-2 gap-16 items-center">
                    <div className="order-2 lg:order-1 relative">
                        {/* Abstract visual representation of "The middleman" */}
                        <div className="relative aspect-square max-w-md mx-auto">
                            <div className="absolute inset-0 bg-gradient-to-tr from-[#F58220] to-purple-500 rounded-full opacity-10 blur-3xl animate-pulse"></div>
                            <div className="relative h-full w-full bg-muted/20 backdrop-blur-sm rounded-3xl border border-white/10 flex flex-col items-center justify-center p-8 gap-8">
                                <div className="flex items-center gap-4 w-full opacity-50">
                                    <div className="h-12 w-12 bg-gray-200 dark:bg-zinc-800 rounded-full flex items-center justify-center"><Store className="h-5 w-5" /></div>
                                    <div className="h-2 flex-1 bg-dashed bg-gray-300 dark:bg-zinc-700"></div>
                                </div>

                                <div className="flex items-center gap-6 w-full scale-110">
                                    <div className="h-2 flex-1 bg-[#F58220] h-1"></div>
                                    <div className="h-20 w-20 bg-[#F58220] rounded-2xl shadow-xl shadow-[#F58220]/30 flex items-center justify-center z-10">
                                        <Users className="h-10 w-10 text-white" />
                                    </div>
                                    <div className="h-2 flex-1 bg-[#F58220] h-1"></div>
                                </div>

                                <div className="flex items-center gap-4 w-full opacity-50">
                                    <div className="h-2 flex-1 bg-dashed bg-gray-300 dark:bg-zinc-700"></div>
                                    <div className="h-12 w-12 bg-gray-200 dark:bg-zinc-800 rounded-full flex items-center justify-center"><Truck className="h-5 w-5" /></div>
                                </div>
                            </div>
                            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-sm font-bold bg-background px-4 py-1 rounded-full border border-border shadow-sm">
                                YOU
                            </div>
                        </div>
                    </div>

                    <div className="order-1 lg:order-2">
                        <FadeInUp>
                            <h2 className="text-3xl font-bold mb-8">How You Succeed</h2>
                            <div className="space-y-8">
                                <div className="flex gap-4">
                                    <div className="flex flex-col items-center">
                                        <div className="h-8 w-8 rounded-full bg-[#F58220] flex items-center justify-center text-white font-bold text-sm">1</div>
                                        <div className="w-0.5 flex-1 bg-border my-2"></div>
                                    </div>
                                    <div className="pb-8">
                                        <h4 className="text-xl font-bold mb-2">Onboard Merchants</h4>
                                        <p className="text-muted-foreground">Identify local sellers. Help them take photos of their products and upload prices to the platform.</p>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <div className="flex flex-col items-center">
                                        <div className="h-8 w-8 rounded-full bg-[#F58220] flex items-center justify-center text-white font-bold text-sm">2</div>
                                        <div className="w-0.5 flex-1 bg-border my-2"></div>
                                    </div>
                                    <div className="pb-8">
                                        <h4 className="text-xl font-bold mb-2">Manage Operations</h4>
                                        <p className="text-muted-foreground">Keep your sellers active. When orders come in, ensure they are packed on time.</p>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <div className="flex flex-col items-center">
                                        <div className="h-8 w-8 rounded-full bg-[#F58220] flex items-center justify-center text-white font-bold text-sm">3</div>
                                    </div>
                                    <div>
                                        <h4 className="text-xl font-bold mb-2">Get Paid</h4>
                                        <p className="text-muted-foreground">Withdraw your earnings directly from your Agent Wallet anytime.</p>
                                    </div>
                                </div>
                            </div>
                        </FadeInUp>
                    </div>
                </div>
            </section>

            {/* Requirements & CTA */}
            <section className="py-20 bg-[#F58220]/5 dark:bg-[#F58220]/10">
                <div className="container mx-auto px-4 text-center">
                    <FadeInUp>
                        <h2 className="text-3xl font-bold mb-12">What You Need to Start</h2>
                        <div className="flex flex-wrap justify-center gap-4 mb-12">
                            {["Smartphone", "Valid ID", "Good Communication Skills", "Bank Account"].map((item, i) => (
                                <div key={i} className="flex items-center gap-2 bg-background px-6 py-3 rounded-full shadow-sm border border-border">
                                    <CheckCircle className="h-5 w-5 text-green-500" />
                                    <span className="font-medium">{item}</span>
                                </div>
                            ))}
                        </div>

                        <div className="p-8 bg-background rounded-3xl max-w-4xl mx-auto border border-border/50 shadow-xl">
                            <h3 className="text-2xl font-bold mb-4">Ready to build your network?</h3>
                            <p className="text-muted-foreground mb-8">Join thousands of agents powering the next generation of food commerce.</p>
                            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                <Button onClick={handleRegister} className="bg-[#F58220] hover:bg-[#F58220]/90 text-white font-bold py-6 px-12 rounded-full text-lg">
                                    Start Application
                                </Button>
                            </div>
                            <p className="mt-4 text-sm text-muted-foreground">
                                Already have an account? <Link href="/login" className="text-[#F58220] hover:underline">Sign In</Link>
                            </p>
                        </div>
                    </FadeInUp>
                </div>
            </section>
        </div>
    )
}
