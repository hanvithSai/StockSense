import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "StockSense · Inventory Management",
    template: "%s · StockSense",
  },
  description:
    "Real-time inventory management: receipts, deliveries, internal transfers, adjustments and a complete stock ledger.",
  applicationName: "StockSense",
  appleWebApp: { capable: true, title: "StockSense", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf9fb" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1519" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-svh antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
