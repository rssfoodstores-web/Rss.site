/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Plus, X, Upload, Loader2, ArrowLeft, Trash2, AlertCircle, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { createProduct, updateProduct } from "@/app/actions/productActions"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { uploadProductImage } from "@/lib/cloudinaryUpload"
import { koboToNaira } from "@/lib/money"

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"
import { PRODUCT_CATEGORIES, getDbCategory } from "@/lib/constants/categories"
import { NIGERIAN_STATES } from "@/lib/constants/nigerianStates"
import { ProductHelpDialog } from "@/components/merchant/products/ProductHelpDialog"

const productSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    description: z.string().min(10, "Description must be at least 10 characters"),
    price: z.coerce.number().positive("Merchant base price must be greater than 0"),
    discount_price: z.coerce.number().optional(),
    add_tax: z.boolean().default(false),
    has_options: z.boolean().default(false),
    options: z.array(z.object({
        type: z.string(),
        values: z.array(z.string())
    })).optional(),
    weight: z.string().optional(),
    state: z.string().optional(),
    is_perishable: z.boolean().default(false),
    categories: z.array(z.string()).min(1, "Select at least one category"),
    tags: z.array(z.string()).default([]),
    seo_title: z.string().optional(),
    seo_description: z.string().optional(),
    sales_type: z.enum(["retail", "wholesale"]).default("retail"),
    stock_level: z.coerce.number().min(0).default(0),
})

interface ProductFormProps {
    initialData?: {
        id?: string
        images?: string[]
        name?: string
        description?: string
        price?: number
        discount_price?: number | string | null
        stock_level?: number
        add_tax?: boolean
        has_options?: boolean
        is_perishable?: boolean
        sales_type?: "retail" | "wholesale"
        category?: string
        tags?: string[]
        seo_title?: string
        seo_description?: string
        state?: string
        weight?: string
        options?: Array<{
            type: string
            values: string[]
        }>
    }
    isEditing?: boolean
}

export function ProductForm({ initialData, isEditing = false }: ProductFormProps) {
    const router = useRouter()
    const [images, setImages] = useState<string[]>(initialData?.images || [])
    const [isUploading, setIsUploading] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [submissionError, setSubmissionError] = useState<string | null>(null)
    const [tagInput, setTagInput] = useState("")

    const defaultValues = {
        name: initialData?.name || "",
        description: initialData?.description || "",
        price: initialData?.price ? koboToNaira(initialData.price) : 0,
        discount_price: initialData?.discount_price ? koboToNaira(Number(initialData.discount_price)) : 0,
        stock_level: initialData?.stock_level || 0,
        add_tax: initialData?.add_tax || false,
        has_options: initialData?.has_options || false,
        is_perishable: initialData?.is_perishable || false,
        sales_type: initialData?.sales_type || "retail",
        // Map back DB category to UI categories if editing, logic might need adjustment based on how categories are stored vs UI
        categories: initialData?.category ? [initialData.category] : [],
        tags: initialData?.tags || [],
        seo_title: initialData?.seo_title || "",
        seo_description: initialData?.seo_description || "",
        state: initialData?.state || "",
        weight: initialData?.weight || "",
        options: initialData?.options || [{ type: "Size", values: ["S", "M", "L", "XL"] }]
    }

    // Logic to handle category mapping slightly better if possible, but for now strict mapping might be tricky without reverse map
    // The original code uses `getDbCategory` to map UI -> DB. 
    // If `initialData` has a DB category (e.g. 'grains'), we need to map it back to UI name or just let it be if it matches.
    // For now we assume the single DB category is put into the array.

    const form = useForm<z.infer<typeof productSchema>>({
        resolver: zodResolver(productSchema),
        defaultValues
    })

    const { fields: optionFields, append: appendOption, remove: removeOption } = useFieldArray({
        control: form.control,
        name: "options"
    })

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (file.size > 10 * 1024 * 1024) {
            toast.error("File is too large. Maximum size is 10MB.")
            return
        }

        setIsUploading(true)
        try {
            const url = await uploadProductImage(file)
            setImages(prev => [...prev, url])
            toast.success("Image uploaded")
        } catch (error) {
            console.error("Upload error:", error)
            const message = error instanceof Error ? error.message : "Upload failed"
            toast.error(message)
        } finally {
            setIsUploading(false)
        }
    }

    const addTag = (tag: string) => {
        const currentTags = form.getValues("tags") || []
        if (tag && !currentTags.includes(tag)) {
            form.setValue("tags", [...currentTags, tag])
        }
        setTagInput("")
    }

    const removeTag = (tagToRemove: string) => {
        const currentTags = form.getValues("tags") || []
        form.setValue("tags", currentTags.filter(tag => tag !== tagToRemove))
    }

    const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            addTag(tagInput)
        }
    }

    const onSubmit = async (values: z.infer<typeof productSchema>) => {
        if (images.length === 0) {
            setSubmissionError("Add at least one product image before submitting for review.")
            toast.error("Please upload at least one image")
            return
        }

        setSubmissionError(null)
        setIsSubmitting(true)
        try {
            const payload = {
                ...values,
                images,
                image_url: images[0],
                category: getDbCategory(values.categories[0])
            }

            if (isEditing && initialData?.id) {
                await updateProduct(initialData.id, payload)
                toast.success("Product updated successfully")
            } else {
                await createProduct(payload)
                toast.success("Product submitted for review")
            }
            router.push("/merchant/products")
        } catch (error) {
            console.error(error)
            const message = error instanceof Error ? error.message : (isEditing ? "Failed to update product" : "Failed to create product")
            setSubmissionError(message)
            toast.error(message)
        } finally {
            setIsSubmitting(false)
        }
    }

    const currentTags = form.watch("tags") || []
    const watchedName = form.watch("name")
    const watchedDescription = form.watch("description")
    const watchedCategory = form.watch("categories")
    const watchedPrice = form.watch("price")
    const watchedStockLevel = form.watch("stock_level")
    const requiredChecklist = [
        {
            label: "Product name",
            done: watchedName.trim().length >= 2,
        },
        {
            label: "Description",
            done: watchedDescription.trim().length >= 10,
        },
        {
            label: "One category",
            done: watchedCategory.length > 0,
        },
        {
            label: "At least one image",
            done: images.length > 0,
        },
        {
            label: "Base price",
            done: Number(watchedPrice) > 0,
        },
        {
            label: "Stock level",
            done: Number(watchedStockLevel) >= 0,
        },
    ]

    return (
        <div className="mx-auto max-w-[1400px] space-y-8 px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <h1 className="text-2xl font-bold text-gray-900">{isEditing ? "Edit Product" : "Add Product"}</h1>
                </div>
            </div>

            <section className="rounded-[2rem] border border-orange-100 bg-orange-50/70 p-5 sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-2xl space-y-2">
                        <div className="flex items-center gap-2 text-[#B86112]">
                            <AlertCircle className="h-5 w-5" />
                            <p className="text-sm font-bold uppercase tracking-[0.18em]">Before You Submit</p>
                        </div>
                        <h2 className="text-xl font-black text-[#1A1A1A]">Fill the required product details clearly</h2>
                        <p className="text-sm leading-6 text-gray-600">
                            Buyers need a correct name, clear description, price, stock, category, and image before your product can be reviewed.
                            Use the help icons beside each section if you want to know what a field is used for.
                        </p>
                    </div>
                    <div className="grid w-full gap-2 sm:grid-cols-2 lg:w-auto lg:min-w-[360px]">
                        {requiredChecklist.map((item) => (
                            <div
                                key={item.label}
                                className={cn(
                                    "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium",
                                    item.done
                                        ? "border-green-200 bg-green-50 text-green-700"
                                        : "border-orange-200 bg-white text-gray-700"
                                )}
                            >
                                {item.done ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4 text-[#F58220]" />}
                                <span>{item.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {submissionError ? (
                <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                    <div>
                        <p className="font-bold">Product submission could not continue</p>
                        <p className="mt-1 text-sm">{submissionError}</p>
                    </div>
                </div>
            ) : null}

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 gap-6 pb-40 lg:grid-cols-3 lg:gap-8 lg:pb-32">
                    <div className="space-y-6 lg:col-span-2 lg:space-y-8">
                        {/* Information Section */}
                        <section className="space-y-6 rounded-[2rem] border border-gray-100/50 bg-white p-5 shadow-sm dark:bg-zinc-900 sm:p-8">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Information</h2>
                                <ProductHelpDialog
                                    title="Information section"
                                    description="This section tells buyers what the product is and how they should interpret the listing."
                                    bullets={[
                                        "Use the exact product name customers search for.",
                                        "Explain what quantity, pack size, or condition the buyer receives.",
                                        "Choose whether the product is sold retail or wholesale.",
                                    ]}
                                />
                            </div>
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <div className="flex items-center gap-2">
                                            <FormLabel className="text-sm font-medium text-gray-500">Product Name</FormLabel>
                                            <ProductHelpDialog
                                                title="Product name"
                                                description="This is the first thing buyers and admins see."
                                                bullets={[
                                                    "Be specific: for example, use 'Brown Beans 1kg' instead of only 'Beans'.",
                                                    "Include pack size or weight when it matters.",
                                                ]}
                                            />
                                        </div>
                                        <FormControl>
                                            <Input placeholder="Bag Of Rice" {...field} className="h-12 bg-gray-50/50 border-gray-100 rounded-xl" />
                                        </FormControl>
                                        <p className="text-xs text-gray-400">Use a clear product name buyers can recognize immediately.</p>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <div className="flex items-center gap-2">
                                            <FormLabel className="text-sm font-medium text-gray-500">Product Description</FormLabel>
                                            <ProductHelpDialog
                                                title="Product description"
                                                description="Describe what the customer receives so there is no confusion during approval or delivery."
                                                bullets={[
                                                    "Mention quantity, size, color, freshness, or packaging.",
                                                    "If the image can be misunderstood, explain the exact item here.",
                                                    "Avoid one-word descriptions.",
                                                ]}
                                            />
                                        </div>
                                        <FormControl>
                                            <Textarea
                                                placeholder="Product description"
                                                className="min-h-[150px] bg-gray-50/50 border-gray-100 rounded-xl resize-none"
                                                {...field}
                                            />
                                        </FormControl>
                                        <p className="text-xs text-gray-400">Tell the buyer exactly what they will receive and how it is packaged.</p>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="sales_type"
                                render={({ field }) => (
                                    <FormItem className="space-y-3">
                                        <FormLabel className="text-sm font-medium text-gray-500">Sales Type</FormLabel>
                                        <FormControl>
                                            <div className="flex w-full flex-wrap rounded-xl border border-gray-100 bg-gray-100/50 p-1 sm:w-fit">
                                                {["retail", "wholesale"].map((type) => (
                                                    <button
                                                        key={type}
                                                        type="button"
                                                        onClick={() => field.onChange(type)}
                                                        className={cn(
                                                            "flex-1 rounded-lg px-4 py-2 text-sm font-medium capitalize transition-all sm:flex-none sm:px-6",
                                                            field.value === type
                                                                ? "bg-white text-black shadow-sm"
                                                                : "text-gray-500 hover:text-gray-900"
                                                        )}
                                                    >
                                                        {type}
                                                    </button>
                                                ))}
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </section>

                        {/* Images Section */}
                        <section className="space-y-6 rounded-[2rem] border border-gray-100/50 bg-white p-5 shadow-sm dark:bg-zinc-900 sm:p-8">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Images</h2>
                                <ProductHelpDialog
                                    title="Product images"
                                    description="Images help buyers trust the listing and help admins approve the correct product faster."
                                    bullets={[
                                        "Upload the actual product, not a random sample image.",
                                        "Make sure the image matches the product name and description.",
                                        "At least one image is required before submission.",
                                    ]}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4">
                                {images.map((img, idx) => (
                                    <div key={idx} className="aspect-square rounded-2xl overflow-hidden relative group border border-gray-100">
                                        <img src={img} alt="" className="w-full h-full object-cover" />
                                        <button
                                            type="button"
                                            onClick={() => setImages(prev => prev.filter((_, i) => i !== idx))}
                                            className="absolute top-2 right-2 h-8 w-8 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))}
                                {isUploading && (
                                    <div className="aspect-square rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center animate-pulse">
                                        <Loader2 className="h-8 w-8 text-gray-300 animate-spin" />
                                    </div>
                                )}
                                <div className="col-span-full">
                                    <div className="relative flex flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-gray-100 bg-gray-50/30 p-6 transition-colors hover:bg-gray-50/50 sm:p-10">
                                        <div className="bg-white p-3 rounded-xl shadow-sm mb-4">
                                            {isUploading ? (
                                                <Loader2 className="h-6 w-6 text-gray-400 animate-spin" />
                                            ) : (
                                                <Upload className="h-6 w-6 text-[#F58220]" />
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-500 mb-2">
                                            {isUploading ? "Uploading image..." : "Or drag and drop files"}
                                        </p>
                                        <Button type="button" variant="outline" className="h-10 px-8 rounded-lg border-gray-100 relative overflow-hidden" disabled={isUploading}>
                                            {isUploading ? "Please wait..." : "Add File"}
                                            <input
                                                type="file"
                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                                onChange={handleImageUpload}
                                                disabled={isUploading}
                                                accept="image/*"
                                            />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Price Section */}
                        <section className="space-y-6 rounded-[2rem] border border-gray-100/50 bg-white p-5 shadow-sm dark:bg-zinc-900 sm:p-8">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Price</h2>
                                <ProductHelpDialog
                                    title="Pricing and stock"
                                    description="These values control how the product is reviewed and what customers can order."
                                    bullets={[
                                        "Base price is the merchant selling price in naira.",
                                        "Stock level should match your real available quantity.",
                                        "Optional discount is only for legacy pricing display when needed.",
                                    ]}
                                />
                            </div>
                            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                <FormField
                                    control={form.control}
                                    name="price"
                                    render={({ field }) => (
                                        <FormItem>
                                            <div className="flex items-center gap-2">
                                                <FormLabel className="text-sm font-medium text-gray-500">Merchant Base Price (NGN)</FormLabel>
                                                <ProductHelpDialog
                                                    title="Merchant base price"
                                                    description="This is the core selling price before the platform review process finalizes the listing."
                                                    bullets={[
                                                        "Enter the amount in naira, not kobo.",
                                                        "Do not type delivery fees here.",
                                                    ]}
                                                />
                                            </div>
                                            <FormControl>
                                                <Input type="number" min="0.01" step="0.01" placeholder="Enter price" {...field} className="h-12 bg-gray-50/50 border-gray-100 rounded-xl" />
                                            </FormControl>
                                            <p className="text-xs text-gray-400">Use the current amount you want to sell this product for.</p>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="discount_price"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-sm font-medium text-gray-500">Optional Legacy Discount Price (NGN)</FormLabel>
                                            <FormControl>
                                                <Input type="number" placeholder="Price at Discount" {...field} className="h-12 bg-gray-50/50 border-gray-100 rounded-xl" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
                                <FormField
                                    control={form.control}
                                    name="stock_level"
                                    render={({ field }) => (
                                        <FormItem>
                                            <div className="flex items-center gap-2">
                                                <FormLabel className="text-sm font-medium text-gray-500">Stock Level</FormLabel>
                                                <ProductHelpDialog
                                                    title="Stock level"
                                                    description="This tells the storefront how many units can still be ordered."
                                                    bullets={[
                                                        "Enter the real quantity available now.",
                                                        "Increase or reduce it whenever your physical stock changes.",
                                                    ]}
                                                />
                                            </div>
                                            <FormControl>
                                                <Input type="number" placeholder="Enter stock quantity" {...field} className="h-12 bg-gray-50/50 border-gray-100 rounded-xl" />
                                            </FormControl>
                                            <p className="text-xs text-gray-400">If you have 10 units available, enter 10 here.</p>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <FormField
                                control={form.control}
                                name="add_tax"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center gap-3 space-y-0">
                                        <FormControl>
                                            <Switch
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                        <FormLabel className="text-sm font-medium text-gray-600">Add tax for this product</FormLabel>
                                    </FormItem>
                                )}
                            />
                        </section>

                        {/* Options Section */}
                        <section className="space-y-6 rounded-[2rem] border border-gray-100/50 bg-white p-5 shadow-sm dark:bg-zinc-900 sm:p-8">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Different Options</h2>
                                <FormField
                                    control={form.control}
                                    name="has_options"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center gap-3 space-y-0">
                                            <FormControl>
                                                <Switch
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                />
                                            </FormControl>
                                            <FormLabel className="text-sm font-medium text-gray-600">This product has multiple options</FormLabel>
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {form.watch("has_options") && (
                                <div className="mt-4 space-y-6">
                                    {optionFields.map((field, index) => (
                                        <div key={field.id} className="space-y-4 rounded-2xl border border-gray-100 bg-gray-50/50 p-4 sm:p-6">
                                            <div className="flex items-center justify-between gap-3">
                                                <span className="text-sm font-bold text-gray-700">Option {index + 1}</span>
                                                <button type="button" onClick={() => removeOption(index)} className="text-red-500 hover:text-red-600 uppercase">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label className="text-xs text-gray-500">Type</label>
                                                    <FormField
                                                        control={form.control}
                                                        name={`options.${index}.type`}
                                                        render={({ field: selectField }) => (
                                                            <Select onValueChange={selectField.onChange} defaultValue={selectField.value}>
                                                                <SelectTrigger className="h-10 bg-white rounded-lg">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="Size">Size</SelectItem>
                                                                    <SelectItem value="Color">Color</SelectItem>
                                                                    <SelectItem value="Weight">Weight</SelectItem>
                                                                    <SelectItem value="Material">Material</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        )}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-xs text-gray-500">Values (Press Enter)</label>
                                                    <div className="min-h-10 bg-white border rounded-lg p-2 flex flex-wrap gap-2 items-center">
                                                        {form.watch(`options.${index}.values`)?.map((v, vIdx) => (
                                                            <span key={vIdx} className="px-2 py-0.5 bg-gray-50 rounded text-xs flex items-center gap-2 border border-gray-100">
                                                                {v}
                                                                <X
                                                                    className="h-3 w-3 text-gray-400 cursor-pointer hover:text-red-500"
                                                                    onClick={() => {
                                                                        const currentValues = form.getValues(`options.${index}.values`)
                                                                        form.setValue(`options.${index}.values`, currentValues.filter((_, i) => i !== vIdx))
                                                                    }}
                                                                />
                                                            </span>
                                                        ))}
                                                        <Input
                                                            placeholder="Add..."
                                                            className="h-6 w-20 border-0 p-0 text-xs focus-visible:ring-0"
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault()
                                                                    const val = e.currentTarget.value.trim()
                                                                    if (val) {
                                                                        const currentValues = form.getValues(`options.${index}.values`) || []
                                                                        if (!currentValues.includes(val)) {
                                                                            form.setValue(`options.${index}.values`, [...currentValues, val])
                                                                        }
                                                                        e.currentTarget.value = ""
                                                                    }
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    <Button type="button" variant="outline" className="w-full border-dashed" onClick={() => appendOption({ type: "Size", values: [] })}>
                                        <Plus className="h-4 w-4 mr-2" /> Add Another Option
                                    </Button>
                                </div>
                            )}
                        </section>

                        {/* Shipping Section */}
                        <section className="space-y-6 rounded-[2rem] border border-gray-100/50 bg-white p-5 shadow-sm dark:bg-zinc-900 sm:p-8">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Shipping</h2>
                                <ProductHelpDialog
                                    title="Shipping details"
                                    description="These fields help delivery teams understand how to handle the product."
                                    bullets={[
                                        "Weight helps with delivery expectations.",
                                        "State should match where the product is posted from.",
                                        "Mark perishable items correctly so handling is safer.",
                                    ]}
                                />
                            </div>
                            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                <FormField
                                    control={form.control}
                                    name="weight"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-sm font-medium text-gray-500">Weight</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Enter Weight" {...field} className="h-12 bg-gray-50/50 border-gray-100 rounded-xl" />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="state"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-sm font-medium text-gray-500">State</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="h-12 bg-gray-50/50 border-gray-100 rounded-xl">
                                                        <SelectValue placeholder="Select State" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent className="max-h-[300px]">
                                                    {NIGERIAN_STATES.map((state) => (
                                                        <SelectItem key={state} value={state}>{state}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <FormField
                                control={form.control}
                                name="is_perishable"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center gap-3 space-y-0">
                                        <FormControl>
                                            <Switch
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                        <FormLabel className="text-sm font-medium text-gray-600">This is Perishable item</FormLabel>
                                    </FormItem>
                                )}
                            />
                        </section>
                    </div>

                    {/* Right Sidebar */}
                    <div className="space-y-6 lg:space-y-8">
                        {/* Categories sidebar */}
                        <section className="space-y-6 rounded-[2rem] border border-gray-100/50 bg-white p-5 shadow-sm dark:bg-zinc-900 sm:p-8">
                            <div className="flex items-center justify-between gap-3">
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white uppercase tracking-wider text-xs">Categories</h2>
                                <ProductHelpDialog
                                    title="Category selection"
                                    description="Pick the single category that best fits the product."
                                    bullets={[
                                        "Choose the closest match to help customers find it.",
                                        "Only one category should be selected for submission.",
                                    ]}
                                />
                            </div>
                            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                <Accordion type="multiple" className="w-full" defaultValue={initialData?.category ? [`item-${PRODUCT_CATEGORIES.findIndex(cat => cat.items.some(i => i.name === initialData.category))}`] : []}>
                                    {PRODUCT_CATEGORIES.map((group, idx) => (
                                        <AccordionItem key={idx} value={`item-${idx}`} className="border-gray-100 last:border-0">
                                            <AccordionTrigger className="text-sm font-bold text-gray-700 hover:no-underline py-3">
                                                {group.name}
                                            </AccordionTrigger>
                                            <AccordionContent>
                                                <div className="space-y-3 pl-2">
                                                    {group.items.map((item) => (
                                                        <FormField
                                                            key={item.name}
                                                            control={form.control}
                                                            name="categories"
                                                            render={({ field }) => (
                                                                <FormItem className="flex flex-col space-y-1">
                                                                    <div className="flex flex-row items-center space-x-3 space-y-0">
                                                                        <FormControl>
                                                                            <Checkbox
                                                                                checked={field.value?.includes(item.name)}
                                                                                onCheckedChange={(checked) => {
                                                                                    // Ensure only one category is selected for now as per DB design suggestions or just single selection logic
                                                                                    // Current AddPage logic allows multiple in UI but only saves first one.
                                                                                    // We keep it array for now to match schema.
                                                                                    return checked
                                                                                        ? field.onChange([item.name]) // Replace, don't append, to enforce single category logic from `getDbCategory(values.categories[0])`
                                                                                        : field.onChange([])
                                                                                }}
                                                                            />
                                                                        </FormControl>
                                                                        <FormLabel className="font-normal text-sm text-gray-600 cursor-pointer w-full">
                                                                            {item.name}
                                                                        </FormLabel>
                                                                    </div>
                                                                    {field.value?.includes(item.name) && (
                                                                        <div className="pl-7 pb-2">
                                                                            <div className="flex flex-wrap gap-1 mb-1">
                                                                                {item.attributes.map(attr => (
                                                                                    <span key={attr} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[10px] rounded border border-blue-100 font-medium">
                                                                                        {attr}
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                            <p className="text-[10px] text-gray-400 italic">
                                                                                e.g. {item.examples.join(", ")}
                                                                            </p>
                                                                        </div>
                                                                    )}
                                                                </FormItem>
                                                            )}
                                                        />
                                                    ))}
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
                            </div>
                        </section>

                        {/* Tags sidebar */}
                        <section className="space-y-6 rounded-[2rem] border border-gray-100/50 bg-white p-5 shadow-sm dark:bg-zinc-900 sm:p-8">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white uppercase tracking-wider text-xs">Tags</h2>
                            <FormField
                                control={form.control}
                                name="tags"
                                render={() => (
                                    <FormItem>
                                        <FormLabel className="text-xs text-gray-400">Add Tags (Press Enter)</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="Enter tag name"
                                                className="h-10 bg-gray-50/50 border-gray-100 rounded-lg"
                                                value={tagInput}
                                                onChange={(e) => setTagInput(e.target.value)}
                                                onKeyDown={handleTagKeyDown}
                                            />
                                        </FormControl>
                                        <div className="flex flex-wrap gap-2 mt-4">
                                            {currentTags.map((tag) => (
                                                <span key={tag} className="px-3 py-1 bg-orange-50 text-[#F58220] text-xs font-medium rounded-lg border border-orange-100 flex items-center gap-2">
                                                    {tag} <X className="h-3 w-3 cursor-pointer" onClick={() => removeTag(tag)} />
                                                </span>
                                            ))}
                                            {currentTags.length === 0 && (
                                                <span className="text-xs text-gray-400 italic">No tags added yet</span>
                                            )}
                                        </div>
                                    </FormItem>
                                )}
                            />
                        </section>

                        {/* SEO Settings */}
                        <section className="space-y-6 rounded-[2rem] border border-gray-100/50 bg-white p-5 shadow-sm dark:bg-zinc-900 sm:p-8">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white uppercase tracking-wider text-xs">SEO Settings</h2>
                            <FormField
                                control={form.control}
                                name="seo_title"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs text-gray-400">Title</FormLabel>
                                        <FormControl>
                                            <Input {...field} placeholder="SEO Title" className="h-10 bg-gray-50/50 border-gray-100 rounded-lg" />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="seo_description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs text-gray-400">Description</FormLabel>
                                        <FormControl>
                                            <Textarea {...field} placeholder="SEO Description" className="min-h-[100px] bg-gray-50/50 border-gray-100 rounded-lg resize-none" />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        </section>
                    </div>

                    {/* Fixed Action Bar at Bottom */}
                    <div className="fixed bottom-0 left-0 right-0 z-50 flex flex-col gap-3 border-t border-gray-100 bg-white p-4 shadow-2xl sm:flex-row sm:items-center sm:justify-end lg:left-[280px]">
                        <Button type="button" variant="outline" className="h-10 w-full rounded-lg sm:w-auto sm:px-8" onClick={() => router.back()}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting} className="h-10 w-full rounded-lg bg-[#F58220] font-bold hover:bg-[#E57210] sm:w-auto sm:px-10">
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (isEditing ? "Update Product" : "Submit for Review")}
                        </Button>
                    </div>
                </form>
            </Form>
        </div >
    )
}
