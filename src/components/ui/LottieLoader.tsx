"use client"

import Script from "next/script"

interface LottieLoaderProps {
    className?: string
    width?: string
    height?: string
    src?: string
}

export function LottieLoader(props: LottieLoaderProps) {
    return (
        <div className={`flex justify-center items-center ${props.className || ''}`}>
            <Script
                src="https://unpkg.com/@lottiefiles/dotlottie-wc@0.8.11/dist/dotlottie-wc.js"
                type="module"
                strategy="lazyOnload"
            />
            <dotlottie-wc
                src={props.src || "https://lottie.host/10b4c7ad-bb59-4b35-a94d-1d1a83534a62/D10aU5stU9.lottie"}
                style={{ width: props.width || "300px", height: props.height || "300px" }}
                autoplay
                loop
            ></dotlottie-wc>
        </div>
    )
}
