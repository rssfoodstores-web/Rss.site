export const WALLET_WITHDRAWAL_SETTINGS_KEY = "wallet_withdrawal_settings"

export type RoleWalletWithdrawalMode = "anytime" | "month_end_only"

export interface WalletWithdrawalSettings {
    roleWalletWithdrawalMode: RoleWalletWithdrawalMode
}

export interface RoleWalletWithdrawalAvailability {
    availableNow: boolean
    mode: RoleWalletWithdrawalMode
    label: string
    helpText: string
}

export const DEFAULT_WALLET_WITHDRAWAL_SETTINGS: WalletWithdrawalSettings = {
    roleWalletWithdrawalMode: "month_end_only",
}

function getLagosDateParts(now: Date) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Lagos",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(now)

    const year = Number(parts.find((part) => part.type === "year")?.value ?? "0")
    const month = Number(parts.find((part) => part.type === "month")?.value ?? "0")
    const day = Number(parts.find((part) => part.type === "day")?.value ?? "0")

    return { year, month, day }
}

function formatLagosDate(year: number, month: number, day: number) {
    return new Intl.DateTimeFormat("en-NG", {
        timeZone: "Africa/Lagos",
        day: "numeric",
        month: "short",
        year: "numeric",
    }).format(new Date(Date.UTC(year, month - 1, day, 12, 0, 0)))
}

export function normalizeWalletWithdrawalSettings(value: unknown): WalletWithdrawalSettings {
    if (!value || typeof value !== "object") {
        return DEFAULT_WALLET_WITHDRAWAL_SETTINGS
    }

    const raw = value as Record<string, unknown>
    const mode = raw.role_wallet_withdrawal_mode === "anytime" ? "anytime" : "month_end_only"

    return {
        roleWalletWithdrawalMode: mode,
    }
}

export function getRoleWalletWithdrawalAvailability(
    settings: WalletWithdrawalSettings,
    now = new Date()
): RoleWalletWithdrawalAvailability {
    if (settings.roleWalletWithdrawalMode === "anytime") {
        return {
            availableNow: true,
            mode: "anytime",
            label: "Withdraw anytime",
            helpText: "Operational wallets can withdraw as soon as payout funds settle.",
        }
    }

    const { year, month, day } = getLagosDateParts(now)
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
    const availableNow = day === lastDay
    const nextWindow = formatLagosDate(year, month, lastDay)

    return {
        availableNow,
        mode: "month_end_only",
        label: availableNow ? "Month-end window open" : "Month-end only",
        helpText: availableNow
            ? "Operational wallet withdrawals are open today because it is the last day of the month in Africa/Lagos."
            : `Operational wallet withdrawals reopen on ${nextWindow} (Africa/Lagos).`,
    }
}
