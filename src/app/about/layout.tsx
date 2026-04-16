import type { Metadata } from "next"
import { buildSeoMetadata } from "@/lib/seo"

export const metadata: Metadata = buildSeoMetadata({
    description: "Learn about RSS Foods, our marketplace values, and how we make everyday food essentials easier to buy across Nigeria.",
    path: "/about",
    title: "About RSS Foods",
})

export default function AboutLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return children
}
