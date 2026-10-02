import type { MetadataRoute } from "next"

// Served by Next.js at /manifest.webmanifest and linked from every page automatically.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "SocialSpace",
    short_name: "SocialSpace",
    description: "A private table for two: talk, chat, draw and watch together.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F4EDE0",
    theme_color: "#F4EDE0",
    categories: ["social", "communication"],
    icons: [
      { src: "/icon-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
