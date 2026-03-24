import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Home } from "lucide-react"

export default function NotFound() {
    return (
        <div className="min-h-screen bg-white dark:bg-black font-sans flex flex-col">
            {/* Breadcrumb - Top Left (Optional, but good for navigation) */}
            <div className="container mx-auto px-4 md:px-8 py-6">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Link href="/" className="hover:text-[#F58220] transition-colors">
                        <Home className="h-4 w-4" />
                    </Link>
                    <span>{">"}</span>
                    <span>Home</span>
                    <span>{">"}</span>
                    <span className="text-[#F58220]">404</span>
                </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center px-4 text-center pb-20">
                <div className="relative w-full max-w-[500px] mb-8">
                    {/* Using the specific image requested */}
                    <img
                        src="/images/404.png"
                        alt="404 Error"
                        className="w-full h-auto object-contain"
                    />
                </div>

                <h1 className="text-3xl md:text-4xl font-bold text-[#002603] dark:text-white mb-3">
                    Oops! page not found
                </h1>

                <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md mx-auto text-sm md:text-base leading-relaxed">
                    The page you're looking for didn't sprout, but don't worry—we've got more growing!
                </p>

                <Link href="/">
                    <Button className="h-12 px-8 bg-[#F58220] hover:bg-[#F58220]/90 text-white rounded-full font-bold text-base">
                        Back to Home
                    </Button>
                </Link>
            </div>
        </div>
    )
}
