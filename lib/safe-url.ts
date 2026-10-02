// Everything that arrives over the relay is untrusted (no login, anyone can claim any ID), and anything the user
// types is only as safe as what they paste. Only http(s) may become an href, src, iframe or video source.
export function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null
  try {
    const u = new URL(value.trim())
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null
  } catch {
    return null
  }
}

// Pictures and videos uploaded in the draw activity travel as base64 data URLs, so those (and only those, and only
// for <img>/<video>, never links or iframes) are also allowed there. SVG is excluded: it can carry script.
export function safeMediaSrc(value: unknown): string | null {
  if (typeof value === "string" && /^data:(image\/(png|jpe?g|gif|webp|avif|bmp)|video\/[a-z0-9.+-]+)[;,]/i.test(value)) return value
  return safeHttpUrl(value)
}
