import type { Metadata } from "next";
import { Geist, Geist_Mono, DM_Mono, Inter } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const dmMono = DM_Mono({ variable: "--font-dm-mono", subsets: ["latin"], weight: ["400", "500"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Price Checker — Masjid Indonesia Frankfurt",
  description: "Look up product prices and stock for the Masjid Indonesia Frankfurt shop.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} ${dmMono.variable} ${inter.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
