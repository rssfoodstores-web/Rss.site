"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
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
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Plus, X, Upload, Loader2 } from "lucide-react"
import { createProduct } from "@/app/actions/productActions"
import { toast } from "sonner"
import { uploadProductImage } from "@/lib/cloudinaryUpload"

const productSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    category: z.string().min(1, "Please select a category"),
    price: z.coerce.number().min(0, "Price must be positive"),
    stock_level: z.coerce.number().min(0, "Stock must be positive"),
    description: z.string().optional(),
})

const categories = [
    { value: "fresh_produce", label: "Fresh Produce" },
    { value: "tubers", label: "Tubers" },
    { value: "grains", label: "Grains" },
    { value: "oils", label: "Oils" },
    { value: "spices", label: "Spices" },
    { value: "proteins", label: "Proteins" },
    { value: "packaged", label: "Packaged" },
    { value: "specialty", label: "Specialty" },
]

export function AddProductModal() {
    const [open, setOpen] = useState(false)
    const [images, setImages] = useState<string[]>([])
    const [isUploading, setIsUploading] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const form = useForm<z.infer<typeof productSchema>>({
        resolver: zodResolver(productSchema),
        defaultValues: {
            name: "",
            price: 0,
            stock_level: 0,
            description: "",
        },
    })

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setIsUploading(true)
        try {
            const url = await uploadProductImage(file)
            setImages(prev => [...prev, url])
            toast.success("Image uploaded")
        } catch {
            toast.error("Upload failed")
        } finally {
            setIsUploading(false)
        }
    }

    const removeImage = (index: number) => {
        setImages(prev => prev.filter((_, i) => i !== index))
    }

    const onSubmit = async (values: z.infer<typeof productSchema>) => {
        if (images.length === 0) {
            toast.error("Please upload at least one image")
            return
        }

        setIsSubmitting(true)
        try {
            await createProduct({
                ...values,
                images,
                image_url: images[0] // Primary image
            })
            toast.success("Product created! Waiting for approval.")
            setOpen(false)
            form.reset()
            setImages([])
        } catch {
            toast.error("Failed to create product")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-[#1E1E66] hover:bg-[#1E1E66]/90 text-white font-bold h-12 md:h-14 px-6 md:px-8 rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-2">
                    <Plus className="h-5 w-5" /> Add Product
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-[2.5rem] p-8">
                <DialogHeader>
                    <DialogTitle className="text-3xl font-black">Add New Product</DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mt-6">
                    {/* Left: Image Upload */}
                    <div className="space-y-6">
                        <div className="aspect-square rounded-3xl border-2 border-dashed border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50 flex flex-col items-center justify-center relative overflow-hidden group">
                            {images.length > 0 ? (
                                <img src={images[0]} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                                <div className="text-center p-6">
                                    <div className="h-16 w-16 bg-white dark:bg-zinc-800 rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                                        <Upload className="h-8 w-8 text-[#F58220]" />
                                    </div>
                                    <p className="font-bold text-gray-900 dark:text-white">Upload Product Gallery</p>
                                    <p className="text-sm text-gray-500 mt-1">PNG, JPG up to 10MB</p>
                                </div>
                            )}
                            <input
                                type="file"
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                onChange={handleImageUpload}
                                disabled={isUploading}
                            />
                            {isUploading && (
                                <div className="absolute inset-0 bg-white/60 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center">
                                    <Loader2 className="h-8 w-8 animate-spin text-[#F58220]" />
                                </div>
                            )}
                        </div>

                        {/* Thumbnail Grid */}
                        <div className="grid grid-cols-4 gap-4">
                            {images.map((img, idx) => (
                                <div key={idx} className="aspect-square rounded-xl overflow-hidden relative group border border-gray-100 dark:border-zinc-800">
                                    <img src={img} alt="" className="w-full h-full object-cover" />
                                    <button
                                        onClick={() => removeImage(idx)}
                                        className="absolute top-1 right-1 h-6 w-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                            ))}
                            {images.length < 4 && !isUploading && (
                                <div className="aspect-square rounded-xl border border-dashed border-gray-200 dark:border-zinc-700 flex items-center justify-center relative hover:bg-gray-50 transition-colors">
                                    <Plus className="h-5 w-5 text-gray-400" />
                                    <input
                                        type="file"
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                        onChange={handleImageUpload}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Form */}
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="font-bold text-gray-700">Product Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g. Bag of Rice" {...field} className="h-12 rounded-xl bg-gray-50/50 border-gray-100" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="category"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="font-bold text-gray-700">Category</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="h-12 rounded-xl bg-gray-50/50 border-gray-100">
                                                    <SelectValue placeholder="Select Category" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent className="rounded-xl border-gray-100 shadow-xl">
                                                {categories.map((cat) => (
                                                    <SelectItem key={cat.value} value={cat.value} className="py-3">
                                                        {cat.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="price"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="font-bold text-gray-700">Price (₦)</FormLabel>
                                            <FormControl>
                                                <Input type="number" {...field} className="h-12 rounded-xl bg-gray-50/50 border-gray-100" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="stock_level"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="font-bold text-gray-700">Stock</FormLabel>
                                            <FormControl>
                                                <Input type="number" {...field} className="h-12 rounded-xl bg-gray-50/50 border-gray-100" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full bg-[#F58220] hover:bg-[#E57210] text-white font-bold h-14 rounded-2xl shadow-lg shadow-orange-500/20 mt-4"
                            >
                                {isSubmitting ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                    "Save and Post Product"
                                )}
                            </Button>
                        </form>
                    </Form>
                </div>
            </DialogContent>
        </Dialog>
    )
}
