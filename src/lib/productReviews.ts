export interface ProductReviewRow {
    product_id: string
    rating: number
    comment: string | null
    created_at: string | null
    customer?: {
        full_name: string | null
    } | null
}

export interface ProductReview {
    productId: string
    rating: number
    comment: string
    createdAt: string | null
    customerName: string
}

export interface ProductReviewSummary {
    averageRating: number
    reviewCount: number
    reviews: ProductReview[]
}

function normalizeProductReview(row: ProductReviewRow): ProductReview {
    return {
        productId: row.product_id,
        rating: row.rating,
        comment: row.comment?.trim() ?? "",
        createdAt: row.created_at,
        customerName: row.customer?.full_name?.trim() || "Verified buyer",
    }
}

export function summarizeProductReviews(reviews: ProductReview[]): ProductReviewSummary {
    if (reviews.length === 0) {
        return {
            averageRating: 0,
            reviewCount: 0,
            reviews: [],
        }
    }

    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0)

    return {
        averageRating: Number((totalRating / reviews.length).toFixed(1)),
        reviewCount: reviews.length,
        reviews,
    }
}

export function groupProductReviewsByProduct(rows: ProductReviewRow[]): Record<string, ProductReviewSummary> {
    const grouped = new Map<string, ProductReview[]>()

    rows.forEach((row) => {
        const review = normalizeProductReview(row)
        const currentReviews = grouped.get(review.productId) ?? []
        currentReviews.push(review)
        grouped.set(review.productId, currentReviews)
    })

    return Object.fromEntries(
        Array.from(grouped.entries()).map(([productId, reviews]) => [productId, summarizeProductReviews(reviews)])
    )
}

export function formatProductReviewDate(value: string | null) {
    if (!value) {
        return "Recently"
    }

    return new Date(value).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
    })
}
