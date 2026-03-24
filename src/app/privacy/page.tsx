import Link from "next/link"
import { Home } from "lucide-react"

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-white dark:bg-black font-sans">
            {/* Breadcrumb */}
            <div className="container mx-auto px-4 md:px-8 py-6">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Link href="/" className="hover:text-[#F58220] transition-colors">
                        <Home className="h-4 w-4" />
                    </Link>
                    <span>{">"}</span>
                    <span className="text-[#F58220]">Privacy Policy</span>
                </div>
            </div>

            <div className="container mx-auto px-4 md:px-8 py-8 pb-20">
                <h1 className="text-[48px] font-semibold text-[#1A1A1A] dark:text-white mb-12 leading-tight font-[Poppins]">
                    RSS FOODS – Privacy Policy
                </h1>

                <div className="max-w-[1578px] space-y-12 text-[22px] text-[#666666] dark:text-gray-400 leading-relaxed font-[Mixed] font-bold">

                    {/* Section 1 */}
                    <section className="space-y-4">
                        <h2 className="font-bold text-[#1A1A1A] dark:text-white">1. Introduction</h2>
                        <div className="space-y-4 pl-0">
                            <p>
                                <span className="text-[#1A1A1A] dark:text-gray-200">1.1.</span> “RSS FOODS” (“we”, “our”, or “us”) operates an e-commerce platform that includes a website and mobile application (“Marketplace”). This Privacy & Data Protection Policy explains how we collect, use, store, and protect personal information belonging to buyers and sellers who use our Marketplace.
                            </p>
                            <p>
                                <span className="text-[#1A1A1A] dark:text-gray-200">1.2.</span> These general terms and conditions apply to all users and govern how personal information is handled within the Marketplace and its supporting systems such as payment processing, logistics, and customer support.
                            </p>
                            <p>
                                <span className="text-[#1A1A1A] dark:text-gray-200">1.3.</span> By accessing or using our Marketplace, you fully accept these Privacy Terms. If you disagree with any part of these terms, you must not use our Marketplace.
                            </p>
                            <div className="space-y-2">
                                <p>
                                    <span className="text-[#1A1A1A] dark:text-gray-200">1.4.</span> If you use the Marketplace on behalf of a business or organization, you:
                                </p>
                                <ul className="pl-8 space-y-2 list-none">
                                    <li>1.4.1. Confirm that you have the authority to accept these Privacy Terms on their behalf;</li>
                                    <li>1.4.2. Bind both yourself and the represented business or organization to these Privacy Terms;</li>
                                    <li>1.4.3. Agree that “you” in this agreement refers to both the individual user and the business entity unless clearly stated otherwise.</li>
                                </ul>
                            </div>
                        </div>
                    </section>

                    {/* Section 2 */}
                    <section className="space-y-4">
                        <h2 className="font-bold text-[#1A1A1A] dark:text-white">2. Collection and Use of Personal Information</h2>
                        <div className="space-y-4 pl-0">
                            <p>
                                <span className="text-[#1A1A1A] dark:text-gray-200">2.1.</span> You must be at least 18 years old to use our Marketplace. By using our services, you represent and warrant that you meet this requirement.
                            </p>
                            <div className="space-y-2">
                                <p>
                                    <span className="text-[#1A1A1A] dark:text-gray-200">2.2.</span> When you register for an account on the Marketplace, we collect personal information including but not limited to:
                                </p>
                                <ul className="pl-8 space-y-1 list-none">
                                    <li>Full name</li>
                                    <li>Email address</li>
                                    <li>Phone number</li>
                                    <li>Delivery or billing address</li>
                                    <li>Password</li>
                                    <li>Payment information (processed securely via third-party partners)</li>
                                </ul>
                            </div>
                            <div className="space-y-2">
                                <p>
                                    <span className="text-[#1A1A1A] dark:text-gray-200">2.3.</span> You agree to the following regarding the personal data in your account:
                                </p>
                                <ul className="pl-8 space-y-2 list-none">
                                    <li>2.3.1. Keep your login credentials confidential and secure;</li>
                                    <li>2.3.2. Notify us immediately (using the contact information in Section 10) if your password or personal information is compromised;</li>
                                    <li>2.3.3. Accept responsibility for actions performed through your account if you fail to protect your login information;</li>
                                    <li>2.3.4. Ensure that your account is used only by you. Any third-party access is at your own risk.</li>
                                </ul>
                            </div>
                            <p>
                                <span className="text-[#1A1A1A] dark:text-gray-200">2.4.</span> RSS FOODS may suspend, restrict, or delete your account at our discretion, especially in situations involving security risks, misuse of personal information, or breach of these terms. If we cancel an order you have paid for and you are not at fault, you will receive a refund.
                            </p>
                            <p>
                                <span className="text-[#1A1A1A] dark:text-gray-200">2.5.</span> You may request account closure at any time by contacting us.
                            </p>
                        </div>
                    </section>

                    {/* Section 3 */}
                    <section className="space-y-4">
                        <h2 className="font-bold text-[#1A1A1A] dark:text-white">3. Consent to Data Processing</h2>
                        <div className="space-y-4 pl-0">
                            <div className="space-y-2">
                                <p>
                                    <span className="text-[#1A1A1A] dark:text-gray-200">3.1.</span> By using our Marketplace, you acknowledge and agree that:
                                </p>
                                <ul className="pl-8 space-y-1 list-none">
                                    <li>Your personal data may be collected, stored, and processed for the purpose of fulfilling orders, improving platform services, and providing a personalized experience;</li>
                                    <li>Your information may be shared with trusted partners such as delivery companies, payment processors, and customer support providers strictly for service-related reasons;</li>
                                    <li>Certain data may be processed automatically for fraud detection, analytics, or system security;</li>
                                </ul>
                            </div>
                            <div className="space-y-2">
                                <p>
                                    <span className="text-[#1A1A1A] dark:text-gray-200">3.2.</span> You further agree that:
                                </p>
                                <ul className="pl-8 space-y-1 list-none">
                                    <li>Your data may be stored securely for as long as legally necessary or operationally relevant;</li>
                                    <li>RSS FOODS will take reasonable measures to safeguard your personal information from unauthorized access or misuse.</li>
                                </ul>
                            </div>
                        </div>
                    </section>

                    {/* Section 4 */}
                    <section className="space-y-4">
                        <h2 className="font-bold text-[#1A1A1A] dark:text-white">4. Data Accuracy and User Responsibility</h2>
                        <div className="space-y-4 pl-0">
                            <p>
                                <span className="text-[#1A1A1A] dark:text-gray-200">4.1.</span> You commit to providing accurate and up-to-date information when registering or updating your account.
                            </p>
                            <p>
                                <span className="text-[#1A1A1A] dark:text-gray-200">4.2.</span> RSS FOODS is not responsible for issues caused by incorrect, outdated, or misleading personal information supplied by the user.
                            </p>
                        </div>
                    </section>

                    {/* Section 5 */}
                    <section className="space-y-4">
                        <h2 className="font-bold text-[#1A1A1A] dark:text-white">5. Disclosure of Personal Information</h2>
                        <div className="space-y-4 pl-0">
                            <p>
                                <span className="text-[#1A1A1A] dark:text-gray-200">5.1.</span> We do not sell personal data to third parties.
                            </p>
                            <div className="space-y-2">
                                <p>
                                    <span className="text-[#1A1A1A] dark:text-gray-200">5.2.</span> We may share limited personal data only with:
                                </p>
                                <ul className="pl-8 space-y-1 list-none">
                                    <li>Sellers fulfilling your order</li>
                                    <li>Delivery, logistics, or courier partners</li>
                                    <li>Payment processors</li>
                                    <li>Security and verification systems</li>
                                    <li>Law enforcement or regulatory authorities when legally required</li>
                                </ul>
                            </div>
                            <p>
                                <span className="text-[#1A1A1A] dark:text-gray-200">5.3.</span> Any shared data will be limited to what is necessary to complete a service or comply with applicable laws.
                            </p>
                        </div>
                    </section>

                    {/* Section 6 */}
                    <section className="space-y-4">
                        <h2 className="font-bold text-[#1A1A1A] dark:text-white">6. Security and Data Protection Measures</h2>
                        <div className="space-y-4 pl-0">
                            <div className="space-y-2">
                                <p>
                                    <span className="text-[#1A1A1A] dark:text-gray-200">6.1.</span> We implement industry-standard security technologies to protect your information from:
                                </p>
                                <ul className="pl-8 space-y-1 list-none">
                                    <li>Unauthorized access</li>
                                    <li>Data alteration</li>
                                    <li>Misuse</li>
                                    <li>Loss or destruction</li>
                                </ul>
                            </div>
                            <p>
                                <span className="text-[#1A1A1A] dark:text-gray-200">6.2.</span> While we take strong measures, you acknowledge that no online system is completely risk-free.
                            </p>
                        </div>
                    </section>

                    {/* Section 7 */}
                    <section className="space-y-4">
                        <h2 className="font-bold text-[#1A1A1A] dark:text-white">7. User Rights</h2>
                        <div className="space-y-4 pl-0">
                            <div className="space-y-2">
                                <p>You may request any of the following actions where applicable:</p>
                                <ul className="pl-8 space-y-1 list-none">
                                    <li>Access to the personal data we hold</li>
                                    <li>Correction of inaccurate information</li>
                                    <li>Deletion of your account and stored data</li>
                                    <li>Restriction of certain processing activities</li>
                                    <li>Opt-out from promotional communications</li>
                                </ul>
                            </div>
                            <p>Requests can be submitted through the contact information provided in Section 10.</p>
                        </div>
                    </section>

                    {/* Section 8 */}
                    <section className="space-y-4">
                        <h2 className="font-bold text-[#1A1A1A] dark:text-white">8. Data Retention</h2>
                        <div className="space-y-4 pl-0">
                            <div className="space-y-2">
                                <p>
                                    <span className="text-[#1A1A1A] dark:text-gray-200">8.1.</span> We retain your personal information only as long as necessary to:
                                </p>
                                <ul className="pl-8 space-y-1 list-none">
                                    <li>Provide services</li>
                                    <li>Complete order processing</li>
                                    <li>Meet legal obligations</li>
                                    <li>Resolve disputes</li>
                                    <li>Prevent fraud</li>
                                </ul>
                            </div>
                            <p>
                                <span className="text-[#1A1A1A] dark:text-gray-200">8.2.</span> Inactive accounts may be archived or deleted in line with our retention policy.
                            </p>
                        </div>
                    </section>

                    {/* Section 9 */}
                    <section className="space-y-4">
                        <h2 className="font-bold text-[#1A1A1A] dark:text-white">9. Third-Party Websites and Services</h2>
                        <div className="space-y-4 pl-0">
                            <p>
                                <span className="text-[#1A1A1A] dark:text-gray-200">9.1.</span> RSS FOODS may contain links to external platforms. We are not responsible for the privacy practices of these platforms.
                            </p>
                            <p>
                                <span className="text-[#1A1A1A] dark:text-gray-200">9.2.</span> We recommend reviewing the privacy policies of any linked third-party sites before interacting with them.
                            </p>
                        </div>
                    </section>

                    {/* Section 10 */}
                    <section className="space-y-4">
                        <h2 className="font-bold text-[#1A1A1A] dark:text-white">10. Contact Information</h2>
                        <div className="space-y-4 pl-0">
                            <p>For questions, concerns, or privacy-related requests, you may contact our support team via:</p>
                            <ul className="pl-0 space-y-1 list-none">
                                <li>Email: support@rssfoods.com</li>
                                <li>Phone: (Insert your phone number)</li>
                                <li>Address: (Insert your company address)</li>
                            </ul>
                        </div>
                    </section>

                </div>
            </div>
        </div>
    )
}
