import { createClient } from "@/lib/supabase/server"
import { ArrowLeft, Edit, MapPin } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { notFound } from "next/navigation"

interface ProductOption {
    type: string
    values: string[]
}

// Since router.back() is client-side, we should replace the back button with a client component or just a Link to /merchant/products
// For now, I'll use a simple Link to the list for server-side purity, or create a tiny client component.
// Let's check if we can make a small client wrapper for the back button to preserve the "back" behavior, 
// OR just link to /merchant/products which is safer. linking to /merchant/products is better UX than broken history.

export default async function ViewProductPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const supabase = await createClient()

    const { data: product, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .single()

    if (error || !product) {
        notFound()
    }

    const productOptions = Array.isArray(product.options) ? (product.options as ProductOption[]) : []

    return (
        <div className="mx-auto max-w-[1200px] space-y-6 px-4 py-4 sm:space-y-8 sm:px-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/merchant/products" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <h1 className="text-2xl font-bold text-gray-900">Product Details</h1>
                </div>
                <Link href={`/merchant/products/edit/${id}`}>
                    <Button className="w-full rounded-lg bg-[#F58220] hover:bg-[#E57210] sm:w-auto">
                        <Edit className="h-4 w-4 mr-2" /> Edit Product
                    </Button>
                </Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Images */}
                    <section className="rounded-[2rem] border border-gray-100/50 bg-white p-5 shadow-sm dark:bg-zinc-900 sm:p-8">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Product Images</h2>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4">
                            {product.images?.map((img: string, idx: number) => (
                                <div key={idx} className="aspect-square rounded-2xl overflow-hidden border border-gray-100">
                                    <img src={img} alt="" className="w-full h-full object-cover" />
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Details */}
                    <section className="space-y-6 rounded-[2rem] border border-gray-100/50 bg-white p-5 shadow-sm dark:bg-zinc-900 sm:p-8">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Product Information</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-gray-500">Name</label>
                                <p className="text-lg font-medium text-gray-900">{product.name}</p>
                            </div>

                            <div>
                                <label className="text-sm font-medium text-gray-500">Description</label>
                                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{product.description}</p>
                            </div>

                            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                <div>
                                    <label className="text-sm font-medium text-gray-500">Price</label>
                                    <p className="text-xl font-bold text-[#F58220]">₦{product.price?.toLocaleString()}</p>
                                </div>
                                {product.discount_price > 0 && (
                                    <div>
                                        <label className="text-sm font-medium text-gray-500">Discount Price</label>
                                        <p className="text-xl font-bold text-green-600">₦{product.discount_price?.toLocaleString()}</p>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                <div>
                                    <label className="text-sm font-medium text-gray-500">Sales Type</label>
                                    <p className="capitalize text-gray-900">{product.sales_type}</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-500">Category</label>
                                    <p className="capitalize text-gray-900">{product.category}</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Options */}
                    {product.has_options && productOptions.length > 0 && (
                        <section className="space-y-6 rounded-[2rem] border border-gray-100/50 bg-white p-5 shadow-sm dark:bg-zinc-900 sm:p-8">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Options</h2>
                            <div className="space-y-4">
                                {productOptions.map((opt, idx) => (
                                    <div key={idx} className="bg-gray-50 p-4 rounded-xl">
                                        <p className="font-semibold mb-2">{opt.type}</p>
                                        <div className="flex flex-wrap gap-2">
                                            {opt.values.map((val: string, vIdx: number) => (
                                                <span key={vIdx} className="px-3 py-1 bg-white border border-gray-200 rounded-lg text-sm">
                                                    {val}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </div>

                {/* Sidebar */}
                <div className="space-y-8">
                    {/* Status Card */}
                    <section className="rounded-[2rem] border border-gray-100/50 bg-white p-5 shadow-sm dark:bg-zinc-900 sm:p-8">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Status</h2>
                        <div className={
                            `inline-flex px-4 py-1.5 rounded-lg text-sm font-bold capitalize ${product.status === 'approved' ? "bg-green-50 text-[#12B76A]" :
                                product.status === 'pending' ? "bg-orange-50 text-[#F58220]" :
                                    "bg-red-50 text-[#F04438]"
                            }`
                        }>
                            {product.status}
                        </div>
                        <p className="text-sm text-gray-500 mt-2">
                            Created on {new Date(product.created_at).toLocaleDateString()}
                        </p>
                    </section>

                    {/* Shipping Info */}
                    <section className="space-y-4 rounded-[2rem] border border-gray-100/50 bg-white p-5 shadow-sm dark:bg-zinc-900 sm:p-8">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Shipping Info</h2>

                        <div>
                            <label className="text-sm font-medium text-gray-500">Weight</label>
                            <p className="text-gray-900">{product.weight || 'N/A'}</p>
                        </div>

                        <div>
                            <label className="text-sm font-medium text-gray-500">Location</label>
                            <div className="flex items-center gap-2 text-gray-900 mt-1">
                                <MapPin className="h-4 w-4 text-gray-400" />
                                {product.state || 'N/A'}
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-medium text-gray-500">Perishable</label>
                            <p className="text-gray-900">{product.is_perishable ? 'Yes' : 'No'}</p>
                        </div>
                    </section>

                    {/* Tags */}
                    {product.tags && product.tags.length > 0 && (
                    <section className="rounded-[2rem] border border-gray-100/50 bg-white p-5 shadow-sm dark:bg-zinc-900 sm:p-8">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Tags</h2>
                            <div className="flex flex-wrap gap-2">
                                {product.tags.map((tag: string, idx: number) => (
                                    <span key={idx} className="px-3 py-1 bg-gray-50 text-gray-600 text-xs font-medium rounded-lg">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* SEO Info */}
                    <section className="space-y-4 rounded-[2rem] border border-gray-100/50 bg-white p-5 shadow-sm dark:bg-zinc-900 sm:p-8">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">SEO Preview</h2>
                        <div>
                            <p className="text-blue-600 text-lg font-medium hover:underline cursor-pointer truncate">
                                {product.seo_title || product.name}
                            </p>
                            <p className="text-green-700 text-sm truncate">
                                https://fyndfuel.com/products/{product.id.slice(0, 8)}...
                            </p>
                            <p className="text-gray-600 text-sm line-clamp-2">
                                {product.seo_description || product.description}
                            </p>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    )
}
