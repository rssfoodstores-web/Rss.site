import { Star } from "lucide-react"
import { cn } from "@/lib/utils"

interface ReviewStarsProps {
    rating: number
    size?: "sm" | "md"
    className?: string
}

export function ReviewStars({ rating, size = "sm", className }: ReviewStarsProps) {
    const roundedRating = Math.round(rating)
    const iconClassName = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5"

    return (
        <div className={cn("flex items-center gap-0.5", className)} aria-label={`${rating} out of 5 stars`}>
            {[1, 2, 3, 4, 5].map((star) => (
                <Star
                    key={star}
                    className={cn(
                        iconClassName,
                        star <= roundedRating
                            ? "fill-amber-400 text-amber-400"
                            : "text-gray-300 dark:text-zinc-700"
                    )}
                />
            ))}
        </div>
    )
}
