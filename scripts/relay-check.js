// Starts server.js on a random port and checks the relay with real ws clients. Usage: node scripts/relay-check.js [path/to/server.js]
const assert = require("node:assert/strict")
const net = require("node:net")
const path = require("node:path")
const { spawn } = require("node:child_process")
const WebSocket = require("ws")

const serverPath = path.resolve(process.argv[2] || path.join(__dirname, "..", "server.js"))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const timeout = (ms, what) => new Promise((_, rej) => setTimeout(() => rej(new Error("timed out: " + what)), ms))

function freePort() {
  return new Promise((res) => {
    const s = net.createServer().listen(0, () => {
      const { port } = s.address()
      s.close(() => res(port))
    })
  })
}

// Opens a socket, registers `id`, resolves once the relay confirms. Received messages collect in .inbox.
async function client(url, id) {
  const ws = new WebSocket(url)
  ws.inbox = []
  ws.on("message", (m) => ws.inbox.push(JSON.parse(m)))
  await new Promise((res, rej) => (ws.once("open", res), ws.once("error", rej)))
  if (id) {
    ws.send(JSON.stringify({ type: "register", id }))
    await waitFor(() => ws.inbox.some((m) => m.type === "registered"), "registered " + id)
  }
  return ws
}
async function waitFor(fn, what, ms = 3000) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (fn()) return
    await sleep(20)
  }
  throw new Error("timed out: " + what)
}

async function main() {
  const port = await freePort()
  const child = spawn(process.execPath, [serverPath], { env: { ...process.env, PORT: String(port) }, stdio: ["ignore", "pipe", "pipe"] })
  let exited = false
  child.on("exit", () => (exited = true))
  await Promise.race([new Promise((r) => child.stdout.on("data", (d) => String(d).includes("started") && r())), timeout(5000, "relay start")])
  const url = `ws://localhost:${port}`
  const open = []
  const track = (ws) => (open.push(ws), ws)
  try {
    // 1. forwarded to its target, message untouched
    const a = track(await client(url, "alice")), b = track(await client(url, "bob"))
    a.send(JSON.stringify({ type: "chat-message", message: "hi", targetId: "bob", senderId: "alice" }))
    await waitFor(() => b.inbox.some((m) => m.type === "chat-message" && m.message === "hi" && m.senderId === "alice"), "chat forwarded")
    console.log("ok  message is forwarded to its target")

    // 2. quick reconnect: new socket registers, THEN the old one closes
    const b2 = track(await client(url, "bob"))
    b.close()
    await waitFor(() => b.readyState === WebSocket.CLOSED, "old socket closed")
    await sleep(100)
    a.send(JSON.stringify({ type: "chat-message", message: "still there?", targetId: "bob", senderId: "alice" }))
    await waitFor(() => b2.inbox.some((m) => m.message === "still there?"), "reconnected client reachable")
    assert.ok(!a.inbox.some((m) => m.type === "user-disconnected"), "a replaced socket closing must not announce the person left")
    console.log("ok  quick reconnect: new socket stays reachable after the old one closes")

    // 3. garbage does not crash the relay, and it keeps working
    const c = track(await client(url))
    for (const junk of ["not json {", "null", "5", '"x"', "[1]"]) c.send(junk)
    c.send(JSON.stringify({ type: "chat-message", message: "before register", targetId: "bob", senderId: "x" })) // ignored: not registered
    c.send(JSON.stringify({ type: "register", id: "   " })) // never an empty ID
    c.send(JSON.stringify({ type: "register", id: "" }))
    c.send(Buffer.alloc(11 * 1024 * 1024, "a")) // over maxPayload: that connection is closed, the relay is not
    await waitFor(() => c.readyState === WebSocket.CLOSED, "oversized message closes only that client")
    await sleep(100)
    assert.ok(!exited, "relay must still be running")
    assert.ok(!b2.inbox.some((m) => m.message === "before register"), "unregistered client must be ignored")
    a.send(JSON.stringify({ type: "chat-message", message: "after junk", targetId: "bob", senderId: "alice" }))
    await waitFor(() => b2.inbox.some((m) => m.message === "after junk"), "relay still forwards after junk")
    const d = track(await client(url, "carol"))
    d.send(JSON.stringify({ type: "chat-message", message: "x", targetId: "", senderId: "carol" })) // "" must not resolve to a client
    console.log("ok  non-JSON, non-object, oversized, unregistered and empty-ID input handled without a crash")
  } finally {
    open.forEach((w) => w.terminate())
    child.kill()
  }
}
main().then(() => console.log("relay-check: ok"), (e) => (console.error("relay-check FAILED:", e.message), process.exit(1)))
