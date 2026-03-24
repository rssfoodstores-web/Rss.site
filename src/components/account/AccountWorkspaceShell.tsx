import type { ReactNode } from "react"
import { ProfileSidebar } from "@/components/account/ProfileSidebar"
import { cn } from "@/lib/utils"

interface AccountWorkspaceShellProps {
    children: ReactNode
    actions?: ReactNode
    className?: string
    showHeader?: boolean
    title?: string
    description?: string
}

export function AccountWorkspaceShell({
    actions,
    children,
    className,
    showHeader = false,
    title = "My Workspace",
    description = "Manage your account and role pages from one place.",
}: AccountWorkspaceShellProps) {
    return (
        <div className="min-h-screen bg-gray-50/50 py-6 dark:bg-black sm:py-8 lg:py-12">
            <div className="container mx-auto px-4 sm:px-6">
                {showHeader ? (
                    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">{title}</h1>
                            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 sm:text-base">{description}</p>
                        </div>
                        {actions ? <div className="shrink-0">{actions}</div> : null}
                    </div>
                ) : null}

                <div className="flex flex-col gap-5 sm:gap-6 lg:flex-row lg:gap-8">
                    <aside className="w-full flex-shrink-0 lg:sticky lg:top-4 lg:w-80 lg:self-start">
                        <ProfileSidebar />
                    </aside>

                    <main className={cn("min-w-0 flex-1", className)}>
                        {children}
                    </main>
                </div>
            </div>
        </div>
    )
}
