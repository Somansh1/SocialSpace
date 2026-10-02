import type { Config } from "tailwindcss"

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-text)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        hard: "4px 4px 0 #231F1A",
        "hard-sm": "2px 2px 0 #231F1A",
      },
      colors: {
        paper: "#F4EDE0",
        surface: "#FFFDF7",
        ink: "#231F1A",
        mute: "#6B6257",
        tan: "#D9B382",
        mustard: "#E0A526",
        danger: "#B3261E",
        you: { DEFAULT: "#E4572E", ink: "#B8401E", tint: "#F8D9CC" },
        friend: { DEFAULT: "#2F7F79", ink: "#256A65", tint: "#D3E8E4" },
        // names used by the toast component
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        border: "hsl(var(--border))",
        ring: "hsl(var(--ring))",
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
export default config
