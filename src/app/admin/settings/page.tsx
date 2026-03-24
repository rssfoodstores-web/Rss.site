import Link from "next/link"
import { getSettings } from "./actions"
import { SettingsForm } from "./SettingsForm"

export const dynamic = "force-dynamic"

export default async function AdminSettingsPage() {
    const settings = await getSettings()

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Platform Settings</h1>
                <p className="text-gray-500 dark:text-gray-400">Configure global application variables.</p>
            </div>

            <Link
                href="/admin/referrals"
                className="flex items-center justify-between rounded-2xl border border-orange-100 bg-orange-50 px-5 py-4 text-sm font-semibold text-[#F58220] transition hover:bg-orange-100 dark:border-orange-950 dark:bg-orange-950/20 dark:text-orange-300"
            >
                <span>Open referral management</span>
                <span>Adjust rate and view ranking</span>
            </Link>

            <Link
                href="/admin/cook-off"
                className="flex items-center justify-between rounded-2xl border border-violet-100 bg-violet-50 px-5 py-4 text-sm font-semibold text-violet-700 transition hover:bg-violet-100 dark:border-violet-900/40 dark:bg-violet-950/20 dark:text-violet-300"
            >
                <span>Open Cook-Off management</span>
                <span>Manage hero slides, sessions, and reviews</span>
            </Link>

            <Link
                href="/admin/discount-bundles"
                className="flex items-center justify-between rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300"
            >
                <span>Open discount bundle management</span>
                <span>Manage landing page content and bundle campaigns</span>
            </Link>

            <Link
                href="/admin/rewards"
                className="flex items-center justify-between rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-700 transition hover:bg-amber-100 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300"
            >
                <span>Open reward management</span>
                <span>Pause the points system and adjust loyalty settings</span>
            </Link>

            <Link
                href="/admin/contact"
                className="flex items-center justify-between rounded-2xl border border-sky-100 bg-sky-50 px-5 py-4 text-sm font-semibold text-sky-700 transition hover:bg-sky-100 dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-sky-300"
            >
                <span>Open contact page management</span>
                <span>Edit contact-page copy and contact methods</span>
            </Link>

            <Link
                href="/admin/support"
                className="flex items-center justify-between rounded-2xl border border-rose-100 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300"
            >
                <span>Open support chat management</span>
                <span>Review customer chats and toggle Gemini on or off</span>
            </Link>

            <SettingsForm initialSettings={settings || []} />
        </div>
    )
}
