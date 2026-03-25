import Link from "next/link"
import {
    ChevronRight,
    FileText,
    Gavel,
    Home,
    Lock,
    Scale,
    Shield,
    type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { DocumentPageContent } from "@/lib/contentPages"

interface DocumentPageProps {
    content: DocumentPageContent
    variant: "terms" | "privacy"
}

interface DocumentTheme {
    badgeIcon: LucideIcon
    sectionIcon: LucideIcon
    closingIcon: LucideIcon
    accentClassName: string
    glowClassName: string
    secondaryGlowClassName: string
}

const DOCUMENT_THEMES: Record<DocumentPageProps["variant"], DocumentTheme> = {
    terms: {
        badgeIcon: Scale,
        sectionIcon: Gavel,
        closingIcon: FileText,
        accentClassName: "text-[#F58220]",
        glowClassName: "from-[#F58220] to-[#FFD700]",
        secondaryGlowClassName: "from-orange-200/50 to-transparent dark:from-orange-900/20",
    },
    privacy: {
        badgeIcon: Shield,
        sectionIcon: Lock,
        closingIcon: Shield,
        accentClassName: "text-[#F58220]",
        glowClassName: "from-[#F58220] to-[#FFB36B]",
        secondaryGlowClassName: "from-emerald-200/50 to-transparent dark:from-emerald-900/20",
    },
}

export function DocumentPage({ content, variant }: DocumentPageProps) {
    const theme = DOCUMENT_THEMES[variant]
    const BadgeIcon = theme.badgeIcon
    const SectionIcon = theme.sectionIcon
    const ClosingIcon = theme.closingIcon

    return (
        <div className="min-h-screen overflow-x-hidden bg-white font-sans dark:bg-black">
            <div className={cn("pointer-events-none fixed left-0 top-0 h-[520px] w-[520px] rounded-full blur-[150px] opacity-10", `bg-gradient-to-br ${theme.glowClassName}`)} />
            <div className={cn("pointer-events-none fixed bottom-0 right-0 h-[520px] w-[520px] rounded-full blur-[150px] opacity-[0.08]", `bg-gradient-to-tr ${theme.secondaryGlowClassName}`)} />

            <div className="relative z-20 container mx-auto px-4 py-8 md:px-8">
                <div className="flex w-fit items-center gap-2 rounded-full border border-gray-100 bg-gray-50/70 px-4 py-2 text-sm text-gray-400 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/50">
                    <Link href="/" className="flex items-center gap-1.5 transition-colors hover:text-[#F58220]">
                        <Home className="h-3.5 w-3.5" />
                        <span>Home</span>
                    </Link>
                    <ChevronRight className="h-3 w-3 text-gray-300" />
                    <span className="font-medium text-[#F58220]">{content.pageTitle}</span>
                </div>
            </div>

            <div className="relative z-10 container mx-auto px-4 pb-32 md:px-8">
                <div className="mx-auto mb-20 max-w-4xl text-center">
                    <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-[#F58220]/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-[#F58220]">
                        <BadgeIcon className="h-4 w-4" />
                        {content.badge}
                    </div>
                    <h1 className="text-5xl font-bold tracking-tight text-[#1A1A1A] dark:text-white md:text-7xl md:leading-[1.1]">
                        {content.pageTitle}
                    </h1>
                    <p className="mx-auto mt-8 max-w-3xl text-xl leading-relaxed text-gray-500 dark:text-gray-400">
                        {content.introDescription}
                    </p>
                </div>

                <div className="mx-auto max-w-5xl space-y-16">
                    {content.sections.map((section, index) => (
                        <section
                            key={section.id}
                            className="group relative overflow-hidden rounded-[2.5rem] border border-gray-100 bg-gray-50/50 p-8 transition-all duration-500 hover:border-[#F58220]/20 dark:border-zinc-800 dark:bg-zinc-900/30 md:p-12"
                        >
                            <div className="absolute right-0 top-0 p-8 opacity-[0.03] transition-opacity group-hover:opacity-[0.07]">
                                <SectionIcon className="h-32 w-32" />
                            </div>
                            <div className="relative z-10">
                                <span className="mb-6 block text-4xl font-black italic tracking-tighter text-[#F58220]/20">
                                    {String(index + 1).padStart(2, "0")}.
                                </span>
                                <h2 className="mb-8 flex items-center gap-4 text-3xl font-bold text-[#1A1A1A] dark:text-white">
                                    <span className="inline-block h-2 w-12 rounded-full bg-[#F58220]" />
                                    {section.title}
                                </h2>

                                <div className="space-y-6 text-lg leading-relaxed text-gray-600 dark:text-gray-400">
                                    {section.paragraphs.map((paragraph, paragraphIndex) => (
                                        <p key={`${section.id}-paragraph-${paragraphIndex}`}>{paragraph}</p>
                                    ))}

                                    {section.bullets.length > 0 ? (
                                        <ul className="space-y-4 pl-6 list-disc">
                                            {section.bullets.map((bullet, bulletIndex) => (
                                                <li key={`${section.id}-bullet-${bulletIndex}`}>{bullet}</li>
                                            ))}
                                        </ul>
                                    ) : null}

                                    {section.note ? (
                                        <p className="rounded-2xl border-l-4 border-[#F58220] bg-[#F58220]/5 p-6 font-medium text-[#1A1A1A] dark:text-gray-200">
                                            {section.note}
                                        </p>
                                    ) : null}
                                </div>
                            </div>
                        </section>
                    ))}

                    <div className="rounded-[2.5rem] border-2 border-dashed border-gray-200 p-10 text-center dark:border-zinc-800">
                        <ClosingIcon className={cn("mx-auto mb-6 h-12 w-12 opacity-60", theme.accentClassName)} />
                        <h3 className="mb-4 text-2xl font-bold italic text-[#1A1A1A] dark:text-white">
                            {content.closingTitle}
                        </h3>
                        <p className="mx-auto max-w-2xl text-lg text-gray-500 dark:text-gray-400">
                            {content.closingDescription}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
