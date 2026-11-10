import type { ReactNode } from "react"
import { DashboardSidebar, DashboardTopBar, type DashboardRole } from "@/components/account/DashboardNavigation"
import { cn } from "@/lib/utils"

interface AccountWorkspaceShellProps {
    children: ReactNode
    role: DashboardRole
    approved?: boolean
    name?: string
    avatarUrl?: string | null
    actions?: ReactNode
    className?: string
    showHeader?: boolean
    title?: string
    description?: string
}

export function AccountWorkspaceShell({
    actions,
    children,
    role,
    approved = true,
    name,
    avatarUrl,
    className,
    showHeader = false,
    title = "My Workspace",
    description = "Manage your account and role pages from one place.",
}: AccountWorkspaceShellProps) {
    const Content = role === "customer" ? "div" : "main"
    return (
        <div className="min-h-screen w-full min-w-0 max-w-full overflow-x-clip bg-gray-50/50 py-5 dark:bg-black sm:py-8 lg:py-12">
            <div className="container mx-auto w-full min-w-0 px-3 sm:px-6">
                <DashboardTopBar role={role} approved={approved} name={name} avatarUrl={avatarUrl} />
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
                    <aside className="hidden w-56 shrink-0 lg:sticky lg:top-4 lg:block lg:self-start">
                        <DashboardSidebar role={role} approved={approved} />
                    </aside>

                    <Content className={cn("min-w-0 flex-1", className)}>
                        {children}
                    </Content>
                </div>
            </div>
        </div>
    )
}
