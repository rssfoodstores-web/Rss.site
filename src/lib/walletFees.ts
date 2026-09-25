export interface WalletFeeSettings {
    collectionFeeBps: number
    collectionFeeCapKobo: number
    feeVatBps: number
    rssTopupFeeBps: number
    payoutBelow10kKobo: number
    payoutBelow50kKobo: number
    payout50kPlusKobo: number
    rssWithdrawalFeeBps: number
}

export const DEFAULT_WALLET_FEE_SETTINGS: WalletFeeSettings = {
    collectionFeeBps: 150,
    collectionFeeCapKobo: 200000,
    feeVatBps: 750,
    rssTopupFeeBps: 0,
    payoutBelow10kKobo: 1000,
    payoutBelow50kKobo: 2000,
    payout50kPlusKobo: 4000,
    rssWithdrawalFeeBps: 0,
}

function safeNumber(value: unknown, fallback: number) {
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : fallback
}

export function normalizeWalletFeeSettings(value: unknown): WalletFeeSettings {
    const raw = value && typeof value === "object" ? value as Record<string, unknown> : {}
    return {
        collectionFeeBps: safeNumber(raw.collection_fee_bps, DEFAULT_WALLET_FEE_SETTINGS.collectionFeeBps),
        collectionFeeCapKobo: safeNumber(raw.collection_fee_cap_kobo, DEFAULT_WALLET_FEE_SETTINGS.collectionFeeCapKobo),
        feeVatBps: safeNumber(raw.fee_vat_bps, DEFAULT_WALLET_FEE_SETTINGS.feeVatBps),
        rssTopupFeeBps: safeNumber(raw.rss_topup_fee_bps, DEFAULT_WALLET_FEE_SETTINGS.rssTopupFeeBps),
        payoutBelow10kKobo: safeNumber(raw.payout_below_10k_kobo, DEFAULT_WALLET_FEE_SETTINGS.payoutBelow10kKobo),
        payoutBelow50kKobo: safeNumber(raw.payout_below_50k_kobo, DEFAULT_WALLET_FEE_SETTINGS.payoutBelow50kKobo),
        payout50kPlusKobo: safeNumber(raw.payout_50k_plus_kobo, DEFAULT_WALLET_FEE_SETTINGS.payout50kPlusKobo),
        rssWithdrawalFeeBps: safeNumber(raw.rss_withdrawal_fee_bps, DEFAULT_WALLET_FEE_SETTINGS.rssWithdrawalFeeBps),
    }
}

export function calculateTopupQuote(walletCreditKobo: number, settings: WalletFeeSettings) {
    const rssFeeKobo = Math.round(walletCreditKobo * settings.rssTopupFeeBps / 10000)
    const targetSettlementKobo = walletCreditKobo + rssFeeKobo
    let totalChargeKobo = targetSettlementKobo
    let processorFeeKobo = 0
    let processorVatKobo = 0

    for (let attempt = 0; attempt < 20; attempt += 1) {
        processorFeeKobo = Math.min(
            Math.round(totalChargeKobo * settings.collectionFeeBps / 10000),
            settings.collectionFeeCapKobo
        )
        processorVatKobo = Math.round(processorFeeKobo * settings.feeVatBps / 10000)
        const nextTotal = targetSettlementKobo + processorFeeKobo + processorVatKobo
        if (nextTotal === totalChargeKobo) break
        totalChargeKobo = nextTotal
    }

    return { walletCreditKobo, processorFeeKobo, processorVatKobo, rssFeeKobo, totalChargeKobo }
}

export function calculateWithdrawalQuote(walletDebitKobo: number, settings: WalletFeeSettings) {
    const processorFeeKobo = walletDebitKobo < 1000000
        ? settings.payoutBelow10kKobo
        : walletDebitKobo < 5000000
            ? settings.payoutBelow50kKobo
            : settings.payout50kPlusKobo
    const processorVatKobo = Math.round(processorFeeKobo * settings.feeVatBps / 10000)
    const rssFeeKobo = Math.round(walletDebitKobo * settings.rssWithdrawalFeeBps / 10000)
    const bankReceivesKobo = walletDebitKobo - processorFeeKobo - processorVatKobo - rssFeeKobo
    return { walletDebitKobo, processorFeeKobo, processorVatKobo, rssFeeKobo, bankReceivesKobo }
}

