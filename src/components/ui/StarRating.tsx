"use client"

import { useState } from "react"
import { Star } from "lucide-react"
import { cn } from "@/lib/utils"

interface StarRatingProps {
    rating: number
    onRatingChange?: (rating: number) => void
    size?: "sm" | "md" | "lg"
    readonly?: boolean
}

export function StarRating({ rating, onRatingChange, size = "md", readonly = false }: StarRatingProps) {
    const [hover, setHover] = useState(0)

    const starSize = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-8 w-8" : "h-6 w-6"

    return (
        <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
                <button
                    key={star}
                    type="button"
                    disabled={readonly}
                    className={cn(
                        "transition-all duration-200",
                        !readonly && "hover:scale-110 active:scale-95",
                        readonly ? "cursor-default" : "cursor-pointer"
                    )}
                    onMouseEnter={() => !readonly && setHover(star)}
                    onMouseLeave={() => !readonly && setHover(0)}
                    onClick={() => onRatingChange?.(star)}
                >
                    <Star
                        className={cn(
                            starSize,
                            (hover >= star || rating >= star)
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-gray-300 dark:text-zinc-700"
                        )}
                    />
                </button>
            ))}
        </div>
    )
}
