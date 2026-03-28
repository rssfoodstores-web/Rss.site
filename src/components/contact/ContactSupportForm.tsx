"use client"

import { useActionState, useEffect, useRef } from "react"
import { Loader2 } from "lucide-react"
import { submitContactSupportForm, type ContactSupportFormState } from "@/app/contact/supportActions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

const initialState: ContactSupportFormState = {
    error: null,
    success: null,
}

export function ContactSupportForm({
    buttonText,
    emailPlaceholder,
    firstNamePlaceholder,
    lastNamePlaceholder,
    messagePlaceholder,
}: {
    buttonText: string
    emailPlaceholder: string
    firstNamePlaceholder: string
    lastNamePlaceholder: string
    messagePlaceholder: string
}) {
    const formRef = useRef<HTMLFormElement | null>(null)
    const [state, formAction, pending] = useActionState(submitContactSupportForm, initialState)

    useEffect(() => {
        if (state.success) {
            formRef.current?.reset()
        }
    }, [state.success])

    return (
        <form ref={formRef} action={formAction} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <Input
                    name="first_name"
                    placeholder={firstNamePlaceholder}
                    className="h-[52px] rounded-lg border-gray-200 bg-white px-4 text-base placeholder:text-gray-300 focus-visible:border-[#F58220] focus-visible:ring-[#F58220]"
                    required
                />
                <Input
                    name="last_name"
                    placeholder={lastNamePlaceholder}
                    className="h-[52px] rounded-lg border-gray-200 bg-white px-4 text-base placeholder:text-gray-300 focus-visible:border-[#F58220] focus-visible:ring-[#F58220]"
                    required
                />
            </div>

            <Input
                name="email"
                type="email"
                placeholder={emailPlaceholder}
                className="h-[52px] rounded-lg border-gray-200 bg-white px-4 text-base placeholder:text-gray-300 focus-visible:border-[#F58220] focus-visible:ring-[#F58220]"
                required
            />

            <Textarea
                name="message"
                placeholder={messagePlaceholder}
                className="min-h-[120px] resize-none rounded-lg border-gray-200 bg-white px-4 py-4 text-base placeholder:text-gray-300 focus-visible:border-[#F58220] focus-visible:ring-[#F58220]"
                required
            />

            {state.error ? <p className="text-sm text-red-500">{state.error}</p> : null}
            {state.success ? <p className="text-sm text-emerald-600 dark:text-emerald-400">{state.success}</p> : null}

            <Button
                type="submit"
                disabled={pending}
                className="min-w-[200px] rounded-full bg-[#F58220] px-8 text-base font-bold text-white hover:bg-[#F58220]/90"
            >
                {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {buttonText}
            </Button>
        </form>
    )
}
