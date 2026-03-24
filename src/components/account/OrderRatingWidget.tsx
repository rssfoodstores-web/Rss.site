"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { StarRating } from "@/components/ui/StarRating"
import { submitOrderReview, submitProductReviews } from "@/app/actions/reviewActions"
import { toast } from "sonner"
import { Loader2, CheckCircle2, Package, Truck } from "lucide-react"
import { Separator } from "@/components/ui/separator"

interface OrderRatingWidgetProps {
    orderId: string
    riderName?: string
    items: { id: string; name: string }[]
}

export function OrderRatingWidget({ orderId, riderName, items }: OrderRatingWidgetProps) {
    const [step, setStep] = useState<'rider' | 'products' | 'success'>('rider')
    const [loading, setLoading] = useState(false)

    // Rider Review State
    const [riderRating, setRiderRating] = useState(0)
    const [riderComment, setRiderComment] = useState("")

    // Product Reviews State
    const [productRatings, setProductRatings] = useState<Record<string, { rating: number; comment: string }>>({})

    // Sync product ratings state with items prop
    useEffect(() => {
        setProductRatings(prev => {
            const newRatings = { ...prev }
            items.forEach(item => {
                if (!newRatings[item.id]) {
                    newRatings[item.id] = { rating: 5, comment: "" }
                }
            })
            return newRatings
        })
    }, [items])

    const handleRiderSubmit = async () => {
        if (riderRating === 0) {
            toast.error("Please select a rating for the rider")
            return
        }

        setLoading(true)
        try {
            const res = await submitOrderReview({
                orderId,
                rating: riderRating,
                comment: riderComment
            })

            if (res.success) {
                setStep('products')
                toast.success("Rider review submitted!")
            } else {
                toast.error(res.message || "Failed to submit review")
            }
        } catch (error) {
            toast.error("An error occurred")
        } finally {
            setLoading(false)
        }
    }

    const handleProductsSubmit = async () => {
        setLoading(true)
        try {
            const reviews = items.map(item => ({
                orderId,
                productId: item.id,
                rating: productRatings[item.id].rating,
                comment: productRatings[item.id].comment
            }))

            const res = await submitProductReviews(reviews)
            if (res.success) {
                setStep('success')
                toast.success("All reviews submitted. Thank you!")
            } else {
                toast.error(res.message || "Failed to submit reviews")
            }
        } catch (error) {
            toast.error("An error occurred")
        } finally {
            setLoading(false)
        }
    }

    if (step === 'success') {
        return (
            <Card className="border-green-100 bg-green-50 dark:bg-green-900/10 mb-8 animate-in fade-in zoom-in duration-300">
                <CardContent className="flex flex-col items-center justify-center p-8 text-center">
                    <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                        <CheckCircle2 className="h-10 w-10 text-green-600" />
                    </div>
                    <CardTitle className="text-xl text-green-800 dark:text-green-400">Feedback Received!</CardTitle>
                    <p className="text-green-600/80 mt-2">Your reviews help us improve the experience for everyone.</p>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="mb-8 border-[#F58220]/20 overflow-hidden shadow-lg animate-in slide-in-from-bottom-4 duration-500">
            <CardHeader className="bg-[#F58220]/5 border-b border-[#F58220]/10">
                <CardTitle className="flex items-center gap-2">
                    {step === 'rider' ? <Truck className="h-5 w-5 text-[#F58220]" /> : <Package className="h-5 w-5 text-[#F58220]" />}
                    {step === 'rider' ? "Rate Delivery" : "Rate Items"}
                </CardTitle>
                <CardDescription>
                    {step === 'rider'
                        ? `How was your delivery with ${riderName || "the rider"}?`
                        : "Tell us what you think of the items you received."}
                </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
                {step === 'rider' ? (
                    <div className="space-y-6">
                        <div className="flex flex-col items-center gap-4 py-4">
                            <StarRating rating={riderRating} onRatingChange={setRiderRating} size="lg" />
                            <span className="text-sm font-medium text-gray-500">
                                {riderRating === 5 ? "Excellent!" :
                                    riderRating === 4 ? "Very Good" :
                                        riderRating === 3 ? "Average" :
                                            riderRating === 2 ? "Poor" :
                                                riderRating === 1 ? "Terrible" : "Select a rating"}
                            </span>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold">Any comments? (Optional)</label>
                            <Textarea
                                placeholder="Write about the rider's professionalism, speed, etc."
                                value={riderComment}
                                onChange={(e) => setRiderComment(e.target.value)}
                                className="resize-none h-24"
                            />
                        </div>
                        <Button
                            onClick={handleRiderSubmit}
                            disabled={loading}
                            className="w-full bg-[#F58220] hover:bg-[#E57210] h-12 font-bold"
                        >
                            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Next: Rate Items"}
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {items.map((item) => (
                            <div key={item.id} className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <h4 className="font-bold text-gray-900 dark:text-gray-100">{item.name}</h4>
                                    <StarRating
                                        rating={productRatings[item.id]?.rating ?? 5}
                                        onRatingChange={(r) => setProductRatings(prev => ({
                                            ...prev,
                                            [item.id]: { ...(prev[item.id] || { comment: "" }), rating: r }
                                        }))}
                                        size="md"
                                    />
                                </div>
                                <Textarea
                                    placeholder={`How was the ${item.name}?`}
                                    value={productRatings[item.id]?.comment ?? ""}
                                    onChange={(e) => setProductRatings(prev => ({
                                        ...prev,
                                        [item.id]: { ...(prev[item.id] || { rating: 5 }), comment: e.target.value }
                                    }))}
                                    className="resize-none h-20 text-sm"
                                />
                                <Separator className="opacity-50" />
                            </div>
                        ))}
                        <Button
                            onClick={handleProductsSubmit}
                            disabled={loading}
                            className="w-full bg-[#F58220] hover:bg-[#E57210] h-12 font-bold"
                        >
                            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Submit All Reviews"}
                        </Button>
                        <button
                            onClick={() => setStep('success')}
                            className="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            Skip item reviews
                        </button>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
