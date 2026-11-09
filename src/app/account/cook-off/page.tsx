import { CookOffProfileClient } from "./CookOffProfileClient"
import { getCookOffProfileData } from "./actions"

export const dynamic = "force-dynamic"

export default async function AccountCookOffPage() {
    const data = await getCookOffProfileData()

    return (
        <div className="min-h-screen bg-gray-50/50 py-6 dark:bg-black sm:py-8 lg:py-12">
            <div className="container mx-auto px-4 sm:px-6">
                <div className="mb-6 sm:mb-8">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">My Cook-Off</h1>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 sm:text-base">
                        Submit your monthly challenge entry, track admin feedback, and follow your leaderboard performance.
                    </p>
                </div>

                <div className="min-w-0">


                    <main className="min-w-0 flex-1">
                        <CookOffProfileClient initialData={data} />
                    </main>
                </div>
            </div>
        </div>
    )
}
