"use client"

import { cn } from "@/lib/utils"
// Ensure the web component script is loaded in layout/head, or imported if using a package
// Since we saw it working in Loading.tsx without imports, we assume the environment has it globally or via script tag.

interface LottieLoaderProps {
    className?: string
    text?: string
}

export function LottieLoader({ className, text }: LottieLoaderProps) {
    return (
        <div className={cn("flex flex-col items-center justify-center p-8", className)}>
            <div className="w-[150px] h-[150px] md:w-[200px] md:h-[200px]">
                <dotlottie-wc
                    src="https://lottie.host/d8380ec5-bf1c-4e85-a5db-37afd97b50c7/5A8KCPNoow.lottie"
                    autoplay
                    loop
                    style={{ width: '100%', height: '100%' }}
                />
            </div>
            {text && (
                <p className="text-gray-500 font-medium animate-pulse mt-4 text-center">
                    {text}
                </p>
            )}
        </div>
    )
}
