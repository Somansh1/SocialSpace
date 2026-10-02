import assert from "node:assert/strict"
import { safeHttpUrl, safeMediaSrc } from "../lib/safe-url.ts"

assert.equal(safeHttpUrl("https://example.com/a?b=1"), "https://example.com/a?b=1")
assert.equal(safeHttpUrl("  http://example.com  "), "http://example.com/")
for (const bad of ["javascript:alert(1)", " JaVaScript:alert(1)", "data:text/html,<script>1</script>", "vbscript:x", "file:///etc/passwd", "", "   ", "not a url", "//example.com", "https://", null, undefined, 5, {}]) {
  assert.equal(safeHttpUrl(bad), null, `should reject ${String(bad)}`)
}
assert.ok(safeMediaSrc("data:image/png;base64,AAAA"))
assert.ok(safeMediaSrc("data:video/mp4;base64,AAAA"))
assert.ok(safeMediaSrc("https://example.com/a.png"))
for (const bad of ["data:image/svg+xml;base64,AAAA", "data:text/html,x", "javascript:alert(1)", ""]) assert.equal(safeMediaSrc(bad), null, bad)
console.log("url-check: ok")
