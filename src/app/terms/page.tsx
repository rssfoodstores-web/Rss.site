import Link from "next/link"
import { Home } from "lucide-react"

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-white dark:bg-black font-sans">
            {/* Breadcrumb */}
            <div className="container mx-auto px-4 md:px-8 py-6">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Link href="/" className="hover:text-[#F58220] transition-colors">
                        <Home className="h-4 w-4" />
                    </Link>
                    <span>{">"}</span>
                    <span className="text-[#F58220]">Terms & Condition</span>
                </div>
            </div>

            <div className="container mx-auto px-4 md:px-8 py-8 pb-20">
                <h1 className="text-[48px] font-semibold text-[#1A1A1A] dark:text-white mb-12 leading-tight">
                    Terms & Condition
                </h1>

                <div className="max-w-[1578px] space-y-12 text-[18px] text-[#666666] dark:text-gray-400 leading-relaxed font-[Mixed]">

                    {/* Section 1 */}
                    <section className="space-y-4">
                        <h2 className="font-bold text-[#1A1A1A] dark:text-white">1. Introduction</h2>
                        <div className="space-y-4 pl-0">
                            <p>
                                <span className="font-semibold text-[#1A1A1A] dark:text-gray-200">1.1.</span> “RSS FOODS” is the trading name for the RSS Foods E-commerce Platform, operated through our website and mobile application (“marketplace”). We provide an online marketplace together with supporting technology, logistics services, and secure payment infrastructure for the buying and selling of food products and related goods (“products”).
                            </p>
                            <p>
                                <span className="font-semibold text-[#1A1A1A] dark:text-gray-200">1.2.</span> These General Terms and Conditions apply to all buyers and sellers on the marketplace and govern your access to and use of RSS FOODS and all related services.
                            </p>
                            <p>
                                <span className="font-semibold text-[#1A1A1A] dark:text-gray-200">1.3.</span> By using our marketplace, you agree to these terms in full. If you do not agree with any part of these terms, you must not use RSS FOODS.
                            </p>
                            <div className="space-y-2">
                                <p>
                                    <span className="font-semibold text-[#1A1A1A] dark:text-gray-200">1.4.</span> If you are using our marketplace on behalf of a business, company, or other organization, then by doing so you:
                                </p>
                                <ul className="pl-8 space-y-2 list-none">
                                    <li>1.4.1. Confirm you have the authority to accept these terms on their behalf;</li>
                                    <li>1.4.2. Agree that both you and the represented organization are bound by these terms;</li>
                                    <li>1.4.3. Understand that references to “you” in these terms refer to both the individual user and the represented organization, unless stated otherwise.</li>
                                </ul>
                            </div>
                        </div>
                    </section>

                    {/* Section 2 */}
                    <section className="space-y-4">
                        <h2 className="font-bold text-[#1A1A1A] dark:text-white">2. Registration and Account</h2>
                        <div className="space-y-4 pl-0">
                            <p>
                                <span className="font-semibold text-[#1A1A1A] dark:text-gray-200">2.1.</span> You may not register on our marketplace if you are under 18 years of age. By registering or using RSS FOODS, you confirm that you are at least 18.
                            </p>
                            <div className="space-y-2">
                                <p>
                                    <span className="font-semibold text-[#1A1A1A] dark:text-gray-200">2.2.</span> When creating an account, you agree to provide accurate information. You will be required to provide an email address or username and create a secure password. You agree to:
                                </p>
                                <ul className="pl-8 space-y-2 list-none">
                                    <li>2.2.1. Keep your login credentials confidential;</li>
                                    <li>2.2.2. Notify us immediately if your password is disclosed or compromised;</li>
                                    <li>2.2.3. Accept responsibility for any activity carried out through your account due to your failure to protect your password;</li>
                                    <li>2.2.4. Use your account solely for yourself—your account is personal and non-transferable. Any third-party access is at your own risk;</li>
                                    <li>2.2.5. Ensure all account information remains accurate and up to date.</li>
                                </ul>
                            </div>
                            <p>
                                <span className="font-semibold text-[#1A1A1A] dark:text-gray-200">2.3.</span> RSS FOODS reserves the right to suspend, restrict, or cancel your account at any time at our discretion. If a cancellation affects products or services you have already paid for and you have not breached these terms, we will provide an appropriate refund.
                            </p>
                            <p>
                                <span className="font-semibold text-[#1A1A1A] dark:text-gray-200">2.4.</span> You may request to close your account at any time by contacting our customer support team.
                            </p>
                        </div>
                    </section>

                    {/* Section 3 */}
                    <section className="space-y-4">
                        <h2 className="font-bold text-[#1A1A1A] dark:text-white">3. Terms and Conditions of Sale</h2>
                        <div className="space-y-4 pl-0">
                            <div className="space-y-2">
                                <p>
                                    <span className="font-semibold text-[#1A1A1A] dark:text-gray-200">3.1.</span> By using the marketplace, you acknowledge and agree that:
                                </p>
                                <ul className="pl-8 space-y-2 list-none">
                                    <li>3.1.1. RSS FOODS provides the platform through which buyers and sellers connect, but we may not be the direct seller of all products listed;</li>
                                    <li>3.1.2. Product listings, descriptions, prices, delivery timelines, and availability are the responsibility of the respective seller;</li>
                                    <li>3.1.3. Orders placed on the marketplace represent an offer to purchase products, which the seller may accept or decline;</li>
                                    <li>3.1.4. Payment must be made using our approved payment channels;</li>
                                    <li>3.1.5. Delivery times are estimates and may vary based on location, product type, and logistics conditions.</li>
                                </ul>
                            </div>
                            <p>
                                <span className="font-semibold text-[#1A1A1A] dark:text-gray-200">3.2.</span> All users agree to act in good faith when buying or selling on the platform, ensuring honesty, accuracy, and transparency.
                            </p>
                            <p>
                                <span className="font-semibold text-[#1A1A1A] dark:text-gray-200">3.3.</span> Sellers agree to honor confirmed orders, maintain product quality, and comply with all food safety, handling, and packaging regulations.
                            </p>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    )
}
