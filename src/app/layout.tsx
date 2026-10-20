import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import type { ReactNode } from "react"

import { ToastProvider } from "@/components/ui/toast"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: { default: "Voltaxis ERP", template: "%s · Voltaxis ERP" },
  description: "Inventory, production, GST billing and receivables for a battery manufacturer and trader.",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-IN" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-background">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  )
}
