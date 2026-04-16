import type { DetailedHTMLProps, HTMLAttributes } from "react"

type DotLottieElementProps = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
    autoplay?: boolean
    loop?: boolean
    src?: string
}

declare module "react" {
    namespace JSX {
        interface IntrinsicElements {
            "dotlottie-wc": DotLottieElementProps
        }
    }
}

declare global {
    namespace JSX {
        interface IntrinsicElements {
            "dotlottie-wc": DotLottieElementProps
        }
    }
}

export {}
