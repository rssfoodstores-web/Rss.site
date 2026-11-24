import { Suspense } from "react"
import AffiliateSection from "../referrals/AffiliateSection"
import WalletClient from "./WalletClient"

export default function WalletPage() {
    return <WalletClient affiliate={
        <Suspense fallback={<p id="affiliate" className="text-sm text-muted-foreground">Loading affiliate link…</p>}>
            <AffiliateSection />
        </Suspense>
    } />
}
