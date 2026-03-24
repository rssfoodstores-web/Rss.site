import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CategoryProvider } from "@/context/CategoryContext";
import Script from "next/script";

export const metadata: Metadata = {
  title: "RSS Foods | Fresh Groceries Delivered",
  description: "Shop premium groceries, fresh produce, and household essentials online. Fast delivery across Nigeria.",
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
              <Header />
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
