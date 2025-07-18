import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SocialSpace",
    short_name: "SocialSpace",
    description: "Real-time communication app with voice calls, chat, and media sharing",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#3b82f6",
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
}
