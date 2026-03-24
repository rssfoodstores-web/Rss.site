"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Check, X } from "lucide-react"
import { useRouter } from "next/navigation"

interface SuccessModalProps {
    isOpen: boolean
    onClose: () => void
    title: string
    description: string
    buttonText: string
    onButtonClick?: () => void
}

export function SuccessModal({
    isOpen,
    onClose,
    title,
    description,
    buttonText,
    onButtonClick
}: SuccessModalProps) {
    const router = useRouter()

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[440px] p-0 overflow-hidden border-none rounded-3xl">
                <DialogHeader className="sr-only">
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <div className="bg-white dark:bg-zinc-900 p-8 md:p-10 relative">
                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute right-6 top-6 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>

                    <div className="flex flex-col items-center text-center">
                        {/* Success Icon with Decorative elements */}
                        <div className="relative mb-8">
                            {/* Decorative confetti-like elements */}
                            <div className="absolute -top-4 -left-6 bg-orange-400 h-2 w-2 rounded-full animate-bounce"></div>
                            <div className="absolute -top-2 -right-8 bg-orange-500 h-1.5 w-1.5 rounded-full"></div>
                            <div className="absolute top-10 -left-10 bg-orange-300 h-3 w-1 rounded-full rotate-45"></div>
                            <div className="absolute -bottom-2 -right-6 bg-orange-600 h-2 w-2 rounded-full"></div>
                            <div className="absolute bottom-6 -right-10 bg-orange-200 h-1 w-4 rounded-full -rotate-12"></div>

                            {/* Main Icon */}
                            <div className="h-20 w-20 rounded-full border-[6px] border-[#F58220] flex items-center justify-center relative z-10">
                                <Check className="h-10 w-10 text-[#F58220] stroke-[4]" />
                            </div>
                        </div>

                        <h3 className="text-2xl font-bold text-[#1A1A1A] dark:text-white mb-4">
                            {title}
                        </h3>

                        <p className="text-gray-500 dark:text-gray-400 text-base leading-relaxed mb-10 px-4">
                            {description}
                        </p>

                        <Button
                            className="w-full h-[56px] bg-[#F58220] hover:bg-[#F58220]/90 text-white font-bold text-lg rounded-xl shadow-lg shadow-orange-500/20"
                            onClick={() => {
                                if (onButtonClick) {
                                    onButtonClick()
                                } else {
                                    onClose()
                                    router.push("/login")
                                }
                            }}
                        >
                            {buttonText}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
