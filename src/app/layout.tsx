import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import Providers from "@/components/Providers";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CategoryProvider } from "@/context/CategoryContext";
import Script from "next/script";
import {
  DEFAULT_OG_IMAGE_PATH,
  DEFAULT_SITE_DESCRIPTION,
  SITE_NAME,
} from "@/lib/seo";
import { getConfiguredSiteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  applicationName: SITE_NAME,
  description: DEFAULT_SITE_DESCRIPTION,
  metadataBase: new URL(getConfiguredSiteUrl()),
  openGraph: {
    description: DEFAULT_SITE_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE_PATH],
    locale: "en_NG",
    siteName: SITE_NAME,
    title: "RSS Foods | Fresh Groceries Delivered",
    type: "website",
  },
  title: {
    default: "RSS Foods | Fresh Groceries Delivered",
    template: "%s | RSS Foods",
  },
  twitter: {
    card: "summary_large_image",
    description: DEFAULT_SITE_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE_PATH],
    title: "RSS Foods | Fresh Groceries Delivered",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          <CategoryProvider>
            <div className="flex min-h-screen flex-col">
              <Suspense fallback={null}>
                <Header />
              </Suspense>
              <main className="flex-1">
                {children}
              </main>
              <Footer />
            </div>
          </CategoryProvider>
        </Providers>
        <Script src="https://unpkg.com/@lottiefiles/dotlottie-wc@0.8.11/dist/dotlottie-wc.js" type="module" strategy="lazyOnload" />
      </body>
    </html>
  );
}
