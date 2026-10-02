const { WebSocketServer } = require("ws")

// Hosting platforms hand the port in through PORT; locally it stays 8080.
const PORT = Number(process.env.PORT) || 8080
// maxPayload: pictures and videos shared in the draw activity travel as base64 data URLs, so allow 10 MiB.
// Anything larger makes ws close that one connection (code 1009); the relay itself carries on.
const wss = new WebSocketServer({ port: PORT, maxPayload: 10 * 1024 * 1024 })

// A map to store connections, with the peerId as the key.
const clients = new Map()

console.log(`Signaling server started on port ${PORT}...`)

wss.on("connection", (ws) => {
  console.log("Client connected")

  // Send ping every 30 seconds to keep connection alive
  const pingInterval = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      ws.ping()
    } else {
      clearInterval(pingInterval)
    }
  }, 30000)

  ws.on("message", (message) => {
    let data
    try {
      data = JSON.parse(message)
    } catch (e) {
      console.error("Invalid JSON received:", message)
      return
    }

    // Valid JSON that is not an object (null, 5, "x", [..]) would crash the property reads below.
    if (typeof data !== "object" || data === null || Array.isArray(data)) return

    // Until a client has registered a usable ID it may only send "register".
    if (!ws.peerId && data.type !== "register") return

    console.log("Received message:", data.type, "from:", data.senderId, "to:", data.targetId)

    // Handle user registration
    if (data.type === "register") {
      // Never register an empty / non-string / absurdly long ID. (No authentication: any client may claim any ID.)
      if (typeof data.id !== "string" || !data.id.trim() || data.id.length > 64) return

      // If this socket already held a different ID, release it (only if it is still ours).
      if (ws.peerId && ws.peerId !== data.id && clients.get(ws.peerId) === ws) clients.delete(ws.peerId)

      // Newest connection wins. The previous holder of this ID (typically a half-dead socket from before a quick
      // reconnect) is detached, not closed: it stops receiving and its later close does nothing. Closing it would
      // make a second open tab with the same name reconnect and steal the ID back in a loop.
      const previous = clients.get(data.id)
      if (previous && previous !== ws) previous.peerId = null

      clients.set(data.id, ws)
      console.log(`Registered client with ID: ${data.id}`)
      ws.peerId = data.id // Store the peerId on the WebSocket object itself

      // Send confirmation back to client
      ws.send(
        JSON.stringify({
          type: "registered",
          id: data.id,
          message: "Successfully registered",
        }),
      )
      return
    }

    // Handle call requests
    if (data.type === "call-request") {
      console.log(`Call request from ${data.senderId} to ${data.targetId}`)
      if (clients.has(data.targetId)) {
        const targetClient = clients.get(data.targetId)
        if (targetClient.readyState === ws.OPEN) {
          targetClient.send(
            JSON.stringify({
              type: "call-request",
              senderId: data.senderId,
              isVideo: data.isVideo,
            }),
          )
        }
      } else {
        // Send back user not found
        ws.send(
          JSON.stringify({
            type: "call-failed",
            reason: "User not found",
          }),
        )
      }
      return
    }

    // Handle call responses
    if (data.type === "call-accepted" || data.type === "call-rejected" || data.type === "call-ended") {
      console.log(`Call ${data.type} from ${data.senderId} to ${data.targetId}`)
      if (clients.has(data.targetId)) {
        const targetClient = clients.get(data.targetId)
        if (targetClient.readyState === ws.OPEN) {
          targetClient.send(
            JSON.stringify({
              type: data.type,
              senderId: data.senderId,
            }),
          )
        }
      }
      return
    }

    // Handle WebRTC signaling (offer, answer, ice-candidate)
    if (data.type === "offer" || data.type === "answer" || data.type === "ice-candidate") {
      console.log(`WebRTC ${data.type} from ${data.senderId} to ${data.targetId}`)
      if (clients.has(data.targetId)) {
        const targetClient = clients.get(data.targetId)
        if (targetClient.readyState === ws.OPEN) {
          targetClient.send(JSON.stringify(data))
        }
      }
      return
    }

    // Handle voice translation
    if (data.type === "voice-translation") {
      console.log(
        `Voice translation from ${data.senderId} to ${data.targetId}: ${data.originalText} -> ${data.translatedText}`,
      )
      if (clients.has(data.targetId)) {
        const targetClient = clients.get(data.targetId)
        if (targetClient.readyState === ws.OPEN) {
          targetClient.send(JSON.stringify(data))
        }
      }
      return
    }

    // Handle chat messages
    if (data.type === "chat-message") {
      console.log(`Chat message from ${data.senderId} to ${data.targetId}: ${data.message}`)
      if (clients.has(data.targetId)) {
        const targetClient = clients.get(data.targetId)
        if (targetClient.readyState === ws.OPEN) {
          targetClient.send(JSON.stringify(data))
        }
      }
      return
    }

    // Handle media sharing
    if (data.type === "media-share" || data.type === "drawing-data") {
      console.log(`Media ${data.type} from ${data.senderId} to ${data.targetId}`)
      if (clients.has(data.targetId)) {
        const targetClient = clients.get(data.targetId)
        if (targetClient.readyState === ws.OPEN) {
          targetClient.send(JSON.stringify(data))
        }
      }
      return
    }

    // Handle video sync
    if (data.type === "video-sync" || data.type === "video-url") {
      console.log(`Video ${data.type} from ${data.senderId} to ${data.targetId}`)
      if (data.type === "video-url") {
        console.log(`Video URL: ${data.url}, Platform: ${data.platformType}`)
      }

      if (clients.has(data.targetId)) {
        const targetClient = clients.get(data.targetId)
        if (targetClient.readyState === 1) {
          // WebSocket.OPEN
          targetClient.send(JSON.stringify(data))
          console.log(`Successfully relayed ${data.type} to ${data.targetId}`)
        } else {
          console.log(`Target client ${data.targetId} connection not open`)
        }
      } else {
        console.log(`Target client ${data.targetId} not found for video message`)
      }
      return
    }

    // Generic relay for any other message types
    if (data.targetId && clients.has(data.targetId)) {
      console.log(`Relaying ${data.type} message from ${data.senderId} to ${data.targetId}`)
      const targetClient = clients.get(data.targetId)
      if (targetClient.readyState === ws.OPEN) {
        targetClient.send(JSON.stringify(data))
      }
    } else if (data.targetId) {
      console.warn(`Target client ${data.targetId} not found.`)
      // Send back error message
      ws.send(
        JSON.stringify({
          type: "error",
          message: `Target client ${data.targetId} not found`,
        }),
      )
    }
  })

  ws.on("close", () => {
    clearInterval(pingInterval)
    // peerId is null if this socket was replaced by a newer one with the same ID; then there is nothing to remove
    // and the person is still here, so nobody is told they left.
    if (ws.peerId && clients.get(ws.peerId) === ws) {
      clients.delete(ws.peerId)
      console.log(`Client ${ws.peerId} disconnected and removed.`)

      // Notify other clients about disconnection if needed
      clients.forEach((client, clientId) => {
        if (client.readyState === ws.OPEN) {
          client.send(
            JSON.stringify({
              type: "user-disconnected",
              userId: ws.peerId,
            }),
          )
        }
      })
    } else {
      console.log("An unregistered or replaced client disconnected.")
    }
  })

  ws.on("error", (error) => {
    console.error("WebSocket error:", error)
  })

})

// Handle server shutdown gracefully
process.on("SIGTERM", () => {
  console.log("Server shutting down...")
  wss.close(() => {
    console.log("WebSocket server closed")
    process.exit(0)
  })
})
