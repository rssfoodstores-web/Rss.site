import Link from "next/link"
import { Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

interface AccountInProcessProps {
    roleLabel: string
    status: string | null
    embedded?: boolean
}

function formatStatus(status: string | null) {
    if (!status) {
        return "awaiting setup"
    }

    return status.replace(/_/g, " ")
}

export function AccountInProcess({ roleLabel, status, embedded = false }: AccountInProcessProps) {
    const card = (
        <Card className="w-full border-orange-200 bg-white shadow-sm dark:border-orange-950 dark:bg-zinc-950">
            <CardContent className="flex flex-col items-center justify-center px-6 py-14 text-center sm:px-10">
                <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-950/40">
                    <Clock className="h-10 w-10 text-[#F58220]" />
                </div>

                <Badge className="mb-4 border-orange-200 bg-orange-50 text-[#F58220] dark:border-orange-950 dark:bg-orange-950/20">
                    {formatStatus(status)}
                </Badge>

                <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">
                    Account in process
                </h1>
                <p className="mt-3 max-w-xl text-base text-gray-600 dark:text-gray-300">
                    Your {roleLabel} account has not been fully approved yet. Workspace access stays locked
                    until admin approval is complete.
                </p>
                <p className="mt-2 max-w-xl text-sm text-gray-500 dark:text-gray-400">
                    Once your account is approved, these pages will open automatically after you sign in.
                </p>

                <div className="mt-8">
                    <Button asChild className="bg-[#F58220] text-white hover:bg-[#E57210]">
                        <Link href="/account">Back to account</Link>
                    </Button>
                </div>
            </CardContent>
        </Card>
    )

    if (embedded) {
        return <div className="mx-auto max-w-3xl py-6">{card}</div>
    }

    return (
        <div className="min-h-screen bg-[#FAFAFA] px-4 py-10 dark:bg-black sm:px-6 lg:px-8">
            <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center">
                {card}
            </div>
        </div>
    )
}
