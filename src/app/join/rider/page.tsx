"use client"

import { Button } from "@/components/ui/button"
import { FadeInUp, StaggerContainer, StaggerItem, FadeIn } from "@/components/ui/motion-container"
import { Bike, Clock, Wallet, MapPin, ShieldCheck, Navigation, Store } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export default function JoinRiderPage() {
    const router = useRouter()
    const supabase = createClient()

    const handleRegister = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            router.push('/join/rider/register')
        } else {
            router.push('/register')
        }
    }

    return (
        <div className="min-h-screen bg-background overflow-hidden relative">
            {/* Background Elements - Completely Cleaned for Premium Feel */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10 bg-gradient-to-br from-background via-background to-orange-500/5">
            </div>

            {/* Hero Section - Optimized for Mobile */}
            <section className="container mx-auto px-4 py-8 lg:py-32 relative">
                <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
                    <FadeInUp className="text-center lg:text-left z-10 flex flex-col items-center lg:items-start pt-8 md:pt-0">
                        <div className="inline-flex items-center rounded-full px-4 py-1.5 text-[10px] md:text-sm font-black tracking-widest uppercase text-orange-600 dark:text-orange-400 ring-1 ring-inset ring-orange-500/20 bg-orange-50/50 dark:bg-orange-950/20 mb-6 transition-all hover:scale-105 cursor-default">
                            <Bike className="h-3 w-3 md:h-4 md:w-4 mr-2" />
                            Rider Program 2026
                        </div>
                        <h1 className="text-4xl md:text-6xl lg:text-8xl font-black tracking-tighter text-foreground mb-6 leading-[1.05] md:leading-[1.1]">
                            Ride. Deliver. <br className="hidden md:block" />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F58220] to-[#1E1B4B] dark:to-orange-200">
                                Earn Daily.
                            </span>
                        </h1>
                        <p className="text-base md:text-lg text-muted-foreground mb-10 max-w-xl leading-relaxed">
                            Turn your bike into a powerhouse. Be your own boss, choose your hours, and get paid instantly for every successful delivery.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                            <Button onClick={handleRegister} className="bg-[#1A1A1A] dark:bg-white text-white dark:text-black hover:bg-black dark:hover:bg-gray-200 font-black py-8 px-12 rounded-2xl text-lg shadow-2xl transition-all hover:translate-y-[-2px] active:translate-y-[0px]">
                                Apply to Ride
                            </Button>
                        </div>
                    </FadeInUp>

                    <FadeIn delay={0.2} className="relative hidden lg:block">
                        <div className="relative z-10">
                            <div className="relative bg-white dark:bg-zinc-950 border border-border/40 rounded-[48px] overflow-hidden shadow-[0_48px_96px_-16px_rgba(0,0,0,0.12)] p-10">
                                <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-[32px] h-[500px] relative overflow-hidden flex flex-col border border-border/30">
                                    <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, #000 1.5px, transparent 1.5px)', backgroundSize: '40px 40px' }}></div>

                                    <svg className="absolute inset-0 w-full h-full pointer-events-none">
                                        <path d="M 120 400 C 180 400, 180 150, 350 150" fill="none" stroke="#F58220" strokeWidth="8" strokeDasharray="16 16" className="animate-pulse opacity-20" />
                                        <circle cx="120" cy="400" r="12" fill="#1E1B4B" />
                                        <circle cx="350" cy="150" r="12" fill="#F58220" />
                                    </svg>

                                    <div className="mt-auto m-8 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-2xl rounded-[28px] p-8 border border-border/50 shadow-2xl">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-5">
                                                <div className="h-12 w-12 bg-orange-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                                                    <Wallet className="h-6 w-6" />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground/60 mb-1">Live Balance</p>
                                                    <p className="font-black text-2xl tracking-tight">₦12,450.00</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className="px-3 py-1 bg-green-500/10 text-green-600 text-[10px] font-black rounded-full flex items-center gap-1.5 border border-green-500/20">
                                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> ONLINE
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </FadeIn>
                </div>
            </section>

            {/* Features / Benefits Grid */}
            <section className="py-24 bg-white dark:bg-zinc-950 border-y border-border/40">
                <div className="container mx-auto px-4">
                    <FadeInUp className="text-center mb-20 flex flex-col items-center">
                        <h2 className="text-3xl md:text-5xl font-black mb-4 tracking-tighter">Built for Riders.</h2>
                        <div className="h-1 w-20 bg-orange-500 rounded-full mb-6"></div>
                        <p className="text-muted-foreground text-lg max-w-2xl">We analyzed thousands of deliveries to build the most efficient rider experience in Nigeria.</p>
                    </FadeInUp>

                    <StaggerContainer className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            { icon: Wallet, title: "Instant Payouts", desc: "No more waiting. Withdraw your hard-earned delivery fees directly to your bank daily." },
                            { icon: Clock, title: "Flex Hours", desc: "You are the manager. Go online when you want, for as long as you want. Zero pressure." },
                            { icon: MapPin, title: "Smart Navigator", desc: "Proprietary routing that saves fuel and time by finding the absolute best routes." },
                            { icon: ShieldCheck, title: "Ride Safe", desc: "Every trip is covered by premium insurance. We have your back on every kilometer." },
                        ].map((feature, idx) => (
                            <StaggerItem key={idx} className="p-10 bg-zinc-50 dark:bg-zinc-900/40 rounded-[40px] border border-border/40 hover:border-orange-500/30 transition-all group relative overflow-hidden text-center flex flex-col items-center">
                                <div className="h-16 w-16 bg-white dark:bg-zinc-950 rounded-3xl flex items-center justify-center text-orange-600 mb-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] group-hover:scale-110 transition-transform">
                                    <feature.icon className="h-8 w-8" />
                                </div>
                                <h3 className="font-black text-xl mb-4 tracking-tight">{feature.title}</h3>
                                <p className="text-muted-foreground text-sm leading-relaxed">{feature.desc}</p>
                            </StaggerItem>
                        ))}
                    </StaggerContainer>
                </div>
            </section>

            {/* How It Works - Optimized Mobile Timeline */}
            <section className="py-24 lg:py-32">
                <div className="container mx-auto px-4">
                    <div className="max-w-4xl mx-auto">
                        <FadeInUp className="text-center mb-24 flex flex-col items-center">
                            <h2 className="text-3xl md:text-5xl font-black tracking-tighter">Your Journey</h2>
                            <div className="h-1 w-16 bg-orange-500 rounded-full mt-4"></div>
                        </FadeInUp>

                        <div className="relative px-2 md:px-0">
                            {/* Vertical Line - Shifted for mobile accessibility */}
                            <div className="absolute left-[18px] md:left-1/2 top-0 bottom-0 w-[1px] bg-zinc-200 dark:bg-zinc-800 md:-ml-[0.5px]"></div>

                            {[
                                { title: "Go Online", desc: "Toggle availability. The system starts matching you with orders near you.", icon: Navigation },
                                { title: "See Offers", desc: "Review order locations and earnings. Accept what fits your schedule.", icon: ShieldCheck },
                                { title: "Seamless Pickup", desc: "Navigate to the merchant with precise turn-by-turn guidance.", icon: Store },
                                { title: "Deliver & Earn", desc: "Close the order and watch your earnings hit your wallet in real-time.", icon: Wallet }
                            ].map((step, i) => (
                                <FadeInUp key={i} className={`relative flex items-center mb-16 md:mb-24 last:mb-0 md:justify-between ${i % 2 === 0 ? 'md:flex-row-reverse' : ''}`}>
                                    {/* Responsive Milestone Circle */}
                                    <div className="absolute left-[-5px] md:left-1/2 w-10 h-10 md:w-14 md:h-14 bg-background border-2 md:border-4 border-orange-500 rounded-full z-10 md:-translate-x-1/2 flex items-center justify-center font-black text-xs md:text-xl text-orange-600 shadow-xl shadow-orange-500/10">
                                        0{i + 1}
                                    </div>
                                    <div className="ml-12 md:ml-0 md:w-[42%] p-8 bg-zinc-50 dark:bg-zinc-900/40 border border-border/40 rounded-[32px] shadow-sm hover:shadow-2xl transition-all group">
                                        <div className="flex items-center gap-4 mb-4">
                                            <div className="p-3 bg-white dark:bg-zinc-950 rounded-2xl shadow-sm text-orange-600 group-hover:scale-110 transition-transform">
                                                <step.icon className="h-6 w-6" />
                                            </div>
                                            <h3 className="text-xl font-bold tracking-tight">{step.title}</h3>
                                        </div>
                                        <p className="text-muted-foreground leading-relaxed text-sm">{step.desc}</p>
                                    </div>
                                    <div className="hidden md:block md:w-[42%]"></div>
                                </FadeInUp>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section - Ultra Premium */}
            <section className="py-24">
                <div className="container mx-auto px-4">
                    <div className="bg-[#1A1A1A] dark:bg-white rounded-[4rem] p-12 md:p-28 text-center overflow-hidden relative border border-white/10 shadow-[0_64px_128px_-32px_rgba(0,0,0,0.3)] dark:shadow-[0_64px_128px_-32px_rgba(0,0,0,0.1)]">
                        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-orange-500/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2"></div>
                        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-indigo-500/10 dark:bg-orange-600/5 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/2"></div>

                        <FadeInUp className="relative z-10 flex flex-col items-center">
                            <h2 className="text-4xl md:text-7xl font-black text-white dark:text-black mb-8 leading-tight tracking-tighter">
                                Start your <br className="md:hidden" /> journey today.
                            </h2>
                            <p className="text-zinc-400 dark:text-zinc-500 max-w-xl mx-auto mb-14 text-lg font-medium leading-relaxed">
                                Join the network of thousands of riders earning more with RSS. Fast verification, zero fees.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-6 justify-center w-full sm:w-auto">
                                <Button onClick={handleRegister} className="bg-[#F58220] hover:bg-orange-600 text-white font-black py-9 px-20 rounded-2xl text-xl shadow-[0_24px_48px_-12px_rgba(245,130,32,0.4)] transition-all hover:scale-105 active:scale-95">
                                    Become a Rider
                                </Button>
                            </div>
                            <p className="mt-14 text-sm text-zinc-600 font-bold uppercase tracking-widest">
                                <Link href="/contact" className="hover:text-orange-500 transition-colors border-b border-zinc-700 pb-1">Need help from our team?</Link>
                            </p>
                        </FadeInUp>
                    </div>
                </div>
            </section>
        </div>
    )
}
