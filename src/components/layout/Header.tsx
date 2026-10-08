"use client"

import { FormEvent, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useTheme } from "next-themes"
import { Search, ShoppingCart, Heart, User, Phone, Menu, Sun, Moon, LogOut, Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/context/UserContext"
import { useCart } from "@/context/CartContext"
import { useWishlist } from "@/context/WishlistContext"
import { createStorefrontHref, getStorefrontBasePath, isStorefrontPath } from "@/lib/categories"
import { getContactMethodByType } from "@/lib/contactPage"
import { usePublicContactPageContent } from "@/hooks/usePublicContactPageContent"
import { performLogout } from "@/lib/auth/performLogout"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

export function Header() {
    const pathname = usePathname()
    const router = useRouter()
    const searchParams = useSearchParams()
    const { setTheme, theme } = useTheme()
    const { user, roles, unreadCount } = useUser()
    const { itemCount } = useCart()
    const { items: wishlistItems } = useWishlist()
    const contactContent = usePublicContactPageContent()
    const [isSigningOut, setIsSigningOut] = useState(false)
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const supabase = createClient()

    const { isMerchant, isRider } = roles
    const isStorefrontPage = isStorefrontPath(pathname)
    const isHomePage = pathname === "/"
    const isAccountPage = pathname?.startsWith("/account") ?? false
    const currentQuery = searchParams.get("q") ?? ""
    const primaryPhoneMethod = getContactMethodByType(contactContent.methods, "phone")

    const handleSignOut = async () => {
        if (isSigningOut) {
            return
        }

        setIsSigningOut(true)
        const didLogout = await performLogout(supabase)

        if (!didLogout) {
            setIsSigningOut(false)
        }
    }

    const submitSearch = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        const formData = new FormData(event.currentTarget)
        const nextQuery = String(formData.get("q") ?? "")

        const nextHref = createStorefrontHref({
            pathname: getStorefrontBasePath(pathname),
            searchParams: isStorefrontPage ? searchParams : undefined,
            patch: {
                q: nextQuery,
                page: null,
            },
        })

        router.push(nextHref, { scroll: false })
    }

    if (pathname?.startsWith('/merchant')) return null;

    return (
        <header className="w-full bg-background">
            {/* Top Bar */}
            <div className="hidden w-full items-center justify-between bg-[#103B2D] px-4 py-2 text-xs text-white md:flex md:px-8">
                <div className="flex items-center gap-4">
                    <Link href="/join/merchant" className="hover:text-primary transition-colors flex items-center gap-1">
                        Sell on RSS FOODS
                    </Link>
                </div>

                <div className="hidden md:flex items-center opacity-0 pointer-events-none">
                    <span className="text-gray-300">Up to <span className="text-primary font-bold text-lg">59%</span> OFF</span>
                </div>

                <div className="flex items-center gap-4">
                    {isMerchant && (
                        <Link href="/merchant" className="flex items-center gap-1 text-[#F58220] hover:text-[#E57210] font-bold text-[10px] md:text-xs transition-colors bg-white/10 px-2 md:px-3 py-1 rounded-full">
                            <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-green-500 animate-pulse" />
                            <span className="md:inline">Dashboard</span>
                        </Link>
                    )}
                    {isRider && (
                        <Link href="/rider" className="flex items-center gap-1 text-[#F58220] hover:text-[#E57210] font-bold text-[10px] md:text-xs transition-colors bg-white/10 px-2 md:px-3 py-1 rounded-full">
                            <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-blue-500 animate-pulse" />
                            <span className="md:inline">Rider</span>
                        </Link>
                    )}
                    {/* Theme Toggle */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-white hover:text-primary hover:bg-transparent"
                        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                    >
                        <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                        <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                        <span className="sr-only">Toggle theme</span>
                    </Button>

                    {user ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="text-white hover:text-primary hover:bg-transparent flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    <span>{user.user_metadata?.full_name?.split(' ')[0] || "Account"}</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-white dark:bg-zinc-950 border shadow-lg z-50">
                                <DropdownMenuItem asChild>
                                    <Link href="/account/profile">Profile</Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <Link href="/account/orders">My Orders</Link>
                                </DropdownMenuItem>
                                {isMerchant && (
                                    <DropdownMenuItem asChild>
                                        <Link href="/merchant" className="font-bold text-[#F58220]">Merchant Dashboard</Link>
                                    </DropdownMenuItem>
                                )}
                                {isRider && (
                                    <DropdownMenuItem asChild>
                                        <Link href="/rider" className="font-bold text-[#F58220]">Rider Dashboard</Link>
                                    </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={handleSignOut} disabled={isSigningOut}>
                                    <LogOut className="h-4 w-4 mr-2" />
                                    {isSigningOut ? "Signing Out..." : "Sign Out"}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : (
                        <div className="flex items-center gap-2">
                            <Link href="/login" className="hover:text-primary">Sign In</Link>
                            <span>/</span>
                            <Link href="/register" className="hover:text-primary">Sign Up</Link>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Header */}
            <div className="border-b border-black/5 bg-white/95 px-3 py-2.5 backdrop-blur dark:bg-background/95 sm:px-4 md:px-8 md:py-4">
                <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-2 md:gap-6">
                    {/* Logo */}
                    <Link href="/" className="flex-shrink-0">
                        <Image src="/logo.png" alt="RSS Foods" width={180} height={48} className="h-10 w-auto object-contain sm:h-11 md:h-12" priority />
                    </Link>

                    {/* Search Bar - Figma Spec: Frame 8:391 */}
                    {!isHomePage && !isAccountPage && (
                        <div className="hidden md:flex flex-1 items-center justify-center">
                            <form
                                key={`desktop-${pathname}-${currentQuery}`}
                                onSubmit={submitSearch}
                                className="flex items-center w-full max-w-[560px] h-[48px] border border-[#ECECEC] dark:border-zinc-700 rounded-xl overflow-hidden bg-white dark:bg-zinc-900 shadow-sm"
                            >
                                <div className="flex items-center px-4 flex-1 h-full gap-2 text-[#808080]">
                                    <Search className="h-5 w-5 text-[#1A1A1A] dark:text-gray-200" />
                                    <Input
                                        name="q"
                                        type="search"
                                        defaultValue={currentQuery}
                                        placeholder="Search products, pantry items, or brands"
                                        className="h-full border-0 p-0 focus-visible:ring-0 placeholder:text-[#808080] text-[15px] bg-transparent dark:text-gray-100"
                                    />
                                </div>
                                <Button type="submit" className="h-full w-[118px] bg-[#F58220] hover:bg-[#F58220]/90 text-white font-semibold rounded-none shrink-0 text-sm">
                                    Search
                                </Button>
                            </form>
                        </div>
                    )}

                    {/* Icons & Contact */}
                    <div className="flex items-center gap-1 md:gap-6">
                        <div className="flex items-center gap-0.5 sm:gap-1">
                            <Link href="/account">
                                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-orange-50 dark:hover:bg-zinc-800 sm:h-11 sm:w-11">
                                    <User className="h-5 w-5" />
                                </Button>
                            </Link>
                            <Link href="/cart">
                                <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-xl hover:bg-orange-50 dark:hover:bg-zinc-800 sm:h-11 sm:w-11">
                                    <ShoppingCart className="h-5 w-5" />
                                    {itemCount > 0 && (
                                        <span className="absolute top-0 right-0 h-4 w-4 bg-primary text-white text-[10px] flex items-center justify-center rounded-full">
                                            {itemCount}
                                        </span>
                                    )}
                                </Button>
                            </Link>
                            <Link href="/account/notifications">
                                <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-xl hover:bg-orange-50 dark:hover:bg-zinc-800 sm:h-11 sm:w-11">
                                    <Bell className="h-5 w-5" />
                                    {unreadCount > 0 && (
                                        <span className="absolute top-0 right-0 h-4 w-4 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full">
                                            {unreadCount > 9 ? '9+' : unreadCount}
                                        </span>
                                    )}
                                </Button>
                            </Link>
                            <Link href="/wishlist">
                                <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-xl hover:bg-orange-50 dark:hover:bg-zinc-800 sm:h-11 sm:w-11">
                                    <Heart className="h-5 w-5" />
                                    {wishlistItems.length > 0 && (
                                        <span className="absolute top-0 right-0 h-4 w-4 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full">
                                            {wishlistItems.length}
                                        </span>
                                    )}
                                </Button>
                            </Link>
                        </div>

                        <div className="hidden lg:flex items-center gap-2 text-sm">
                            <div className="bg-gray-100 dark:bg-zinc-800 p-2 rounded-full">
                                <Phone className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col leading-tight">
                                <span className="text-xs text-muted-foreground">Call to order</span>
                                <span className="font-bold">{primaryPhoneMethod?.value ?? ""}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {isStorefrontPage && !isHomePage && (
                    <form
                        key={`mobile-${pathname}-${currentQuery}`}
                        onSubmit={submitSearch}
                        className="mt-4 flex items-center gap-2 rounded-2xl border border-[#ECECEC] bg-white p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 md:hidden"
                    >
                        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-[#F7F7F7] px-3 dark:bg-zinc-900">
                            <Search className="h-4 w-4 text-muted-foreground" />
                            <Input
                                name="q"
                                type="search"
                                defaultValue={currentQuery}
                                placeholder="Search products"
                                className="h-11 border-0 bg-transparent px-0 focus-visible:ring-0"
                            />
                        </div>
                        <Button type="submit" className="h-11 rounded-xl bg-[#F58220] px-4 text-white hover:bg-[#E57210]">
                            Search
                        </Button>
                    </form>
                )}
            </div>

            {/* Navigation Bar - Figma Spec: Frame 8:363 */}
            <div className={`border-b border-black/5 bg-white dark:bg-zinc-950 dark:border-zinc-800 ${isAccountPage ? "hidden md:block" : ""}`}>
                <div className="mx-auto w-full max-w-[1440px] px-3 sm:px-4 md:px-8">
                    <div className="flex h-[48px] items-center justify-end md:h-[58px]">

                        {/* Desktop Nav */}
                        <div className="hidden items-center md:flex">
                            {/* Nav Links - Figma Spec: Frame 8:375 */}
                            <nav className="flex items-center gap-1 text-sm font-medium">
                                <Link href="/" className={`${pathname === "/" ? "text-[#F58220]" : "text-[#002603] dark:text-gray-200 hover:text-[#F58220]"} rounded-full px-3 py-2 transition-colors hover:bg-orange-50 dark:hover:bg-zinc-900`}>Home</Link>
                                {isMerchant && (
                                    <Link href="/merchant" className={`${pathname === "/merchant" ? "text-[#F58220]" : "text-[#002603] dark:text-gray-200 hover:text-[#F58220]"} rounded-full px-3 py-2 transition-colors font-bold hover:bg-orange-50 dark:hover:bg-zinc-900`}>Dashboard</Link>
                                )}
                                <Link href="/retail" className={`${pathname === "/retail" ? "text-[#F58220]" : "text-[#002603] dark:text-gray-200 hover:text-[#F58220]"} rounded-full px-3 py-2 transition-colors hover:bg-orange-50 dark:hover:bg-zinc-900`}>RSS Retail</Link>
                                <Link href="/wholesale" className={`${pathname === "/wholesale" ? "text-[#F58220]" : "text-[#002603] dark:text-gray-200 hover:text-[#F58220]"} rounded-full px-3 py-2 transition-colors hover:bg-orange-50 dark:hover:bg-zinc-900`}>RSS Wholesale</Link>
                                <Link href="/about" className={`${pathname === "/about" ? "text-[#F58220]" : "text-[#002603] dark:text-gray-200 hover:text-[#F58220]"} rounded-full px-3 py-2 transition-colors hover:bg-orange-50 dark:hover:bg-zinc-900`}>About RSS</Link>
                                <Link href="/contact" className={`${pathname === "/contact" ? "text-[#F58220]" : "text-[#002603] dark:text-gray-200 hover:text-[#F58220]"} rounded-full px-3 py-2 transition-colors hover:bg-orange-50 dark:hover:bg-zinc-900`}>Contact</Link>
                            </nav>
                        </div>

                        {/* Mobile Sheet Trigger (Hidden on Desktop) */}
                        <div className="flex w-full items-center justify-end gap-3 md:hidden">
                            {/* Mobile Search Trigger could go here */}
                            <div className="hidden w-full max-w-[200px] md:hidden">
                                {/* Simplified Mobile Search */}
                            </div>

                            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                                <SheetTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl text-foreground hover:bg-orange-50 dark:hover:bg-zinc-900" aria-label="Open navigation menu" suppressHydrationWarning>
                                        <Menu className="h-6 w-6" />
                                    </Button>
                                </SheetTrigger>
                                <SheetContent side="left" className="w-[min(86vw,360px)] bg-white dark:bg-zinc-950 border-r dark:border-zinc-800">
                                    <SheetTitle className="sr-only">Mobile navigation menu</SheetTitle>
                                    <div className="flex flex-col gap-6 mt-8">
                                        <div className="flex items-center gap-2 mb-4">
                                            <Image src="/logo.png" alt="RSS Foods" width={160} height={40} className="h-10 w-auto object-contain" />
                                        </div>

                                        <nav className="flex flex-col gap-4">
                                            <Link href="/" onClick={() => setIsMobileMenuOpen(false)} className={`text-lg font-medium transition-colors ${pathname === "/" ? "text-[#F58220]" : "text-foreground hover:text-[#F58220]"}`}>Home</Link>
                                            {isMerchant && (
                                                <Link href="/merchant" onClick={() => setIsMobileMenuOpen(false)} className={`text-lg font-bold transition-colors flex items-center gap-2 ${pathname === "/merchant" ? "text-[#F58220]" : "text-foreground hover:text-[#F58220]"}`}>
                                                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                                    Merchant Dashboard
                                                </Link>
                                            )}
                                            <Link href="/retail" onClick={() => setIsMobileMenuOpen(false)} className={`text-lg font-medium transition-colors ${pathname === "/retail" ? "text-[#F58220]" : "text-foreground hover:text-[#F58220]"}`}>RSS Retail</Link>
                                            <Link href="/wholesale" onClick={() => setIsMobileMenuOpen(false)} className={`text-lg font-medium transition-colors ${pathname === "/wholesale" ? "text-[#F58220]" : "text-foreground hover:text-[#F58220]"}`}>RSS Wholesale</Link>
                                            <Link href="/about" onClick={() => setIsMobileMenuOpen(false)} className={`text-lg font-medium transition-colors ${pathname === "/about" ? "text-[#F58220]" : "text-foreground hover:text-[#F58220]"}`}>About RSS</Link>
                                            <Link href="/contact" onClick={() => setIsMobileMenuOpen(false)} className={`text-lg font-medium transition-colors ${pathname === "/contact" ? "text-[#F58220]" : "text-foreground hover:text-[#F58220]"}`}>Contact</Link>
                                        </nav>
                                    </div>
                                </SheetContent>
                            </Sheet>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    )
}
