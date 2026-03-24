"use client"

import { CircleHelp } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"

interface ProductHelpDialogProps {
    title: string
    description: string
    bullets?: string[]
}

export function ProductHelpDialog({ title, description, bullets = [] }: ProductHelpDialogProps) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full text-gray-400 hover:bg-orange-50 hover:text-[#F58220]"
                    aria-label={`Learn more about ${title}`}
                >
                    <CircleHelp className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md rounded-3xl border-gray-100 p-6">
                <DialogHeader className="space-y-3 text-left">
                    <DialogTitle className="text-xl font-black text-[#1A1A1A]">{title}</DialogTitle>
                    <DialogDescription className="text-sm leading-6 text-gray-600">
                        {description}
                    </DialogDescription>
                </DialogHeader>
                {bullets.length > 0 ? (
                    <div className="rounded-2xl bg-gray-50 p-4">
                        <ul className="space-y-2 text-sm text-gray-700">
                            {bullets.map((bullet) => (
                                <li key={bullet} className="flex gap-2">
                                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#F58220]" />
                                    <span>{bullet}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : null}
            </DialogContent>
        </Dialog>
    )
}
