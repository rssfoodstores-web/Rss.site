const NGN_FORMATTER = new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
})

export function nairaToKobo(amountNaira: number): number {
    return Math.round(amountNaira * 100)
}

export function koboToNaira(amountKobo: number): number {
    return amountKobo / 100
}

export function formatKobo(amountKobo: number | null | undefined): string {
    return NGN_FORMATTER.format(koboToNaira(amountKobo ?? 0))
}

export function formatMaybeNaira(amount: number | null | undefined): string {
    return NGN_FORMATTER.format(amount ?? 0)
}
