import { LottieLoader } from "@/components/ui/LottieLoader"

export default function AccountLoading() {
    return (
        <div className="min-h-screen bg-gray-50/50 dark:bg-black flex items-center justify-center">
            <LottieLoader />
        </div>
    )
}
