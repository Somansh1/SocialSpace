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

// Absolute URL used for the share image. Set NEXT_PUBLIC_SITE_URL (for example https://socialspace.example)
// in the deployment's environment; the host's production-URL variable is used if it is present.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")

const description = "A private table for two: talk, chat, draw and watch together."

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "SocialSpace",
  description,
  applicationName: "SocialSpace",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "SocialSpace" },
  openGraph: { type: "website", siteName: "SocialSpace", title: "SocialSpace, a table for two", description },
  twitter: { card: "summary_large_image", title: "SocialSpace, a table for two", description },
}

// Zoom stays enabled on purpose.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F4EDE0",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${text.variable}`}>
      <body>
        <PWAInstaller />
        {children}
        <Toaster />
      </body>
    </html>
  )
}
