/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // The service worker must always be re-checked so a new deploy reaches returning visitors.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ]
  },
  async redirects() {
    // Older installs asked for /manifest.json; the manifest now lives at the Next.js default path.
    return [{ source: "/manifest.json", destination: "/manifest.webmanifest", permanent: true }]
  },
}

export default nextConfig
