import type React from "react"
import type { Metadata, Viewport } from "next"
import { Fraunces, DM_Sans } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"
import { PWAInstaller } from "@/components/pwa-installer"

// Fraunces carries the headings and both people's names (italic); DM Sans is for everything you read or press.
const display = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["SOFT", "WONK"],
  variable: "--font-display",
  display: "swap",
})
const text = DM_Sans({ subsets: ["latin"], variable: "--font-text", display: "swap" })

export const metadata: Metadata = {
  title: "SocialSpace",
  description: "A private table for two: talk, chat, draw and watch together.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SocialSpace",
  },
}

// Zoom stays enabled on purpose.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F4EDE0",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${display.variable} ${text.variable}`}>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="SocialSpace" />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
      </head>
      <body>
        <PWAInstaller />
        {children}
        <Toaster />
      </body>
    </html>
  )
}
