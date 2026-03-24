import { LottieLoader } from "@/components/ui/LottieLoader"

export default function CartLoading() {
    return (
        <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center">
            <LottieLoader src="https://lottie.host/f0164e08-8fe4-4215-bbd1-57d6f7e6c924/zlkaNChwBL.lottie" />
        </div>
    )
}
