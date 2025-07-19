const { WebSocketServer } = require("ws")

const wss = new WebSocketServer({ port: 8080 })

// A map to store connections, with the peerId as the key.
const clients = new Map()

console.log("Enhanced signaling server started on port 8080...")

wss.on("connection", (ws) => {
  console.log("Client connected")

  ws.on("message", (message) => {
    let data
    try {
      data = JSON.parse(message)
    } catch (e) {
      console.error("Invalid JSON received:", message)
      return
    }

    console.log("Received message:", data.type, "from:", data.senderId, "to:", data.targetId)

    // Handle user registration
    if (data.type === "register" && data.id) {
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
    if (ws.peerId) {
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
      console.log("An unregistered client disconnected.")
    }
  })

  ws.on("error", (error) => {
    console.error("WebSocket error:", error)
  })

  // Send ping every 30 seconds to keep connection alive
  const pingInterval = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      ws.ping()
    } else {
      clearInterval(pingInterval)
    }
  }, 30000)
})

// Handle server shutdown gracefully
process.on("SIGTERM", () => {
  console.log("Server shutting down...")
  wss.close(() => {
    console.log("WebSocket server closed")
    process.exit(0)
  })
})
