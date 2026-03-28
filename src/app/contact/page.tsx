import Link from "next/link"
import { Globe, Home, Mail, MapPin, MessageCircle, Phone, Send } from "lucide-react"
import { AdPlacementSection } from "@/components/ads/AdPlacementSection"
import { ContactSupportForm } from "@/components/contact/ContactSupportForm"
import { SupportChatBubble } from "@/components/support/SupportChatBubble"
import { buildContactMethodHref, type ContactMethodContent } from "@/lib/contactPage"
import { getContactPageContent } from "@/lib/contactPageData"
import { getSupportChatBootstrap } from "@/lib/supportChatData"

export const dynamic = "force-dynamic"

function getContactMethodIcon(method: ContactMethodContent) {
    switch (method.type) {
        case "address":
            return MapPin
        case "email":
            return Mail
        case "phone":
            return Phone
        case "whatsapp":
            return MessageCircle
        case "website":
            return Globe
        case "custom":
        default:
            return Send
    }
}

export default async function ContactPage() {
    const [content, supportBootstrap] = await Promise.all([
        getContactPageContent(),
        getSupportChatBootstrap(),
    ])

    return (
        <div className="min-h-screen bg-gray-50/50 font-sans dark:bg-black">
            <SupportChatBubble bootstrap={supportBootstrap} />

            <div className="container mx-auto px-4 py-6 md:px-8">
                <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Link href="/" className="transition-colors hover:text-[#F58220]">
                        <Home className="h-4 w-4" />
                    </Link>
                    <span>/</span>
                    <span className="text-[#F58220]">{content.pageTitle}</span>
                </div>
            </div>

            <AdPlacementSection
                placement="contact_inline"
                title="Featured campaigns"
                description="Sponsored placements can also direct visitors to active promotions or landing pages."
            />

            <div className="container mx-auto px-4 pb-20 pt-4 md:px-8">
                <div className="mx-auto flex max-w-6xl flex-col gap-6 lg:flex-row">
                    <div className="w-full shrink-0 space-y-6 lg:w-[320px]">
                        <div className="rounded-[10px] border border-gray-100 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                            {content.methods.map((method, index) => {
                                const Icon = getContactMethodIcon(method)
                                const href = buildContactMethodHref(method)

                                return (
                                    <div key={method.id}>
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="h-10 w-auto">
                                                <Icon className="h-8 w-8 text-[#F58220] stroke-[1.5]" />
                                            </div>
                                            <div className="space-y-2">
                                                <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-400">{method.title}</p>
                                                {href ? (
                                                    <a
                                                        href={href}
                                                        target={href.startsWith("http") ? "_blank" : undefined}
                                                        rel={href.startsWith("http") ? "noreferrer" : undefined}
                                                        className="text-sm text-gray-600 transition-colors hover:text-[#F58220] dark:text-gray-300"
                                                    >
                                                        {method.value}
                                                    </a>
                                                ) : (
                                                    <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">{method.value}</p>
                                                )}
                                                {method.description ? (
                                                    <p className="max-w-[220px] text-sm leading-relaxed text-gray-400">{method.description}</p>
                                                ) : null}
                                            </div>
                                        </div>

                                        {index < content.methods.length - 1 ? (
                                            <div className="my-8 h-px w-full bg-gray-100 dark:bg-zinc-800" />
                                        ) : null}
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    <div className="flex-1 rounded-[10px] border border-gray-100 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:p-12">
                        <div className="mb-10">
                            <h1 className="mb-3 text-3xl font-bold text-[#1A1A1A] dark:text-white">{content.introTitle}</h1>
                            <p className="max-w-lg text-sm leading-relaxed text-gray-400">{content.introDescription}</p>
                        </div>

                        <ContactSupportForm
                            buttonText={content.form.buttonText}
                            emailPlaceholder={content.form.emailPlaceholder}
                            firstNamePlaceholder={content.form.firstNamePlaceholder}
                            lastNamePlaceholder={content.form.lastNamePlaceholder}
                            messagePlaceholder={content.form.messagePlaceholder}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
