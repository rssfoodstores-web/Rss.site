import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Home } from "lucide-react"

export default function NotFound() {
    return (
        <div className="flex min-h-screen flex-col bg-white font-sans dark:bg-black">
            <div className="container mx-auto px-4 py-6 md:px-8">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Link href="/" className="transition-colors hover:text-[#F58220]">
                        <Home className="h-4 w-4" />
                    </Link>
                    <span>{">"}</span>
                    <span>Home</span>
                    <span>{">"}</span>
                    <span className="text-[#F58220]">404</span>
                </div>
            </div>

            <div className="flex flex-1 flex-col items-center justify-center px-4 pb-20 text-center">
                <div className="relative mb-8 w-full max-w-[500px]">
                    <Image
                        src="/images/404.png"
                        alt="404 error"
                        width={500}
                        height={340}
                        className="h-auto w-full object-contain"
                    />
                </div>

                <h1 className="mb-3 text-3xl font-bold text-[#002603] dark:text-white md:text-4xl">
                    Oops! page not found
                </h1>

                <p className="mx-auto mb-8 max-w-md text-sm leading-relaxed text-gray-500 dark:text-gray-400 md:text-base">
                    The page you&apos;re looking for didn&apos;t sprout, but don&apos;t worry, we&apos;ve got more growing.
                </p>

                <Link href="/">
                    <Button className="h-12 rounded-full bg-[#F58220] px-8 text-base font-bold text-white hover:bg-[#F58220]/90">
                        Back to Home
                    </Button>
                </Link>
            </div>
        </div>
    )
}
