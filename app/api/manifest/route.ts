import { NextResponse } from "next/server"

export async function GET() {
  const manifest = {
    name: "SocialSpace",
    short_name: "SocialSpace",
    description: "A private table for two: talk, chat, draw and watch together.",
    start_url: "/",
    display: "standalone",
    background_color: "#F4EDE0",
    theme_color: "#F4EDE0",
    orientation: "portrait",
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
    categories: ["social", "communication"],
    shortcuts: [
      {
        name: "Start Call",
        short_name: "Call",
        description: "Start a voice call",
        url: "/call",
        icons: [{ src: "/icon-192x192.png", sizes: "192x192" }],
      },
      {
        name: "Chat",
        short_name: "Chat",
        description: "Open chat",
        url: "/chat",
        icons: [{ src: "/icon-192x192.png", sizes: "192x192" }],
      },
    ],
  }

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
    },
  })
}
