import { getWalletFeeSettings, getWalletFinanceSummary } from "./actions"
import { WalletFeeForm } from "./WalletFeeForm"
import { formatKobo } from "@/lib/money"

export const dynamic = "force-dynamic"

export default async function AdminFinancesPage() {
    const [settings, summary] = await Promise.all([getWalletFeeSettings(), getWalletFinanceSummary()])
    const recent = Array.isArray(summary.recent) ? summary.recent as Array<Record<string, unknown>> : []
    return <div className="space-y-6 p-4 sm:p-6">
        <div><h1 className="text-2xl font-bold">Wallet finance rules</h1><p className="text-sm text-gray-500">Update Monnify charges without deploying the application. New quotes use the new rules; old transactions keep their original quote.</p></div>
        <WalletFeeForm initialSettings={settings} />
        <div className="grid gap-4 md:grid-cols-4">
            <FinanceCard label="Wallet credit promised" value={Number(summary.quoted_wallet_credit_kobo ?? 0)} />
            <FinanceCard label="Customers charged" value={Number(summary.actual_amount_paid_kobo ?? 0)} />
            <FinanceCard label="Monnify settled" value={Number(summary.actual_settlement_kobo ?? 0)} />
            <FinanceCard label="Provider fees" value={Number(summary.actual_provider_fees_kobo ?? 0)} />
        </div>
        <div className="overflow-x-auto rounded-2xl border bg-white dark:bg-zinc-900"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-4">Reference</th><th className="p-4">Wallet credit</th><th className="p-4">Customer paid</th><th className="p-4">Settled</th><th className="p-4">Fee</th><th className="p-4">Check</th></tr></thead><tbody>{recent.map((row) => <tr key={String(row.reference)} className="border-b last:border-0"><td className="p-4 font-mono text-xs">{String(row.reference)}</td><td className="p-4">{formatKobo(Number(row.wallet_credit_kobo ?? 0))}</td><td className="p-4">{formatKobo(Number(row.actual_amount_paid_kobo ?? row.total_charge_kobo ?? 0))}</td><td className="p-4">{row.actual_settlement_kobo == null ? "Pending" : formatKobo(Number(row.actual_settlement_kobo))}</td><td className="p-4">{row.actual_processor_fee_kobo == null ? formatKobo(Number(row.processor_fee_kobo ?? 0)+Number(row.processor_fee_vat_kobo ?? 0)) : formatKobo(Number(row.actual_processor_fee_kobo))}</td><td className="p-4">{String(row.reconciliation_status ?? "pending")}</td></tr>)}</tbody></table></div>
    </div>
}

function FinanceCard({ label, value }: { label: string; value: number }) {
    return <div className="rounded-2xl border bg-white p-5 dark:bg-zinc-900"><p className="text-xs font-semibold uppercase text-gray-500">{label}</p><p className="mt-2 text-2xl font-bold">{formatKobo(value)}</p></div>
}

