"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect, useRef } from "react"
import { useToast } from "@/hooks/use-toast"

interface WebSocketContextType {
  ws: WebSocket | null
  connectionState: "disconnected" | "connecting" | "connected"
  sendMessage: (message: any) => void
  registerMessageHandler: (handler: (data: any) => void) => () => void
  /** Drop the current socket (if any) and try again right now. */
  reconnect: () => void
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined)

export function useWebSocket() {
  const context = useContext(WebSocketContext)
  if (context === undefined) {
    throw new Error("useWebSocket must be used within a WebSocketProvider")
  }
  return context
}

interface WebSocketProviderProps {
  children: React.ReactNode
  peerId: string
}

export function WebSocketProvider({ children, peerId }: WebSocketProviderProps) {
  const [ws, setWs] = useState<WebSocket | null>(null)
  const [connectionState, setConnectionState] = useState<"disconnected" | "connecting" | "connected">("connecting")
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const socketRef = useRef<WebSocket | null>(null)
  const closedByUsRef = useRef(false)
  const messageHandlersRef = useRef<Set<(data: any) => void>>(new Set())
  const { toast } = useToast()

  const connect = () => {
    if (socketRef.current?.readyState === WebSocket.OPEN) return
    closedByUsRef.current = false

    setConnectionState("connecting")
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "wss://socialspace-bakend.onrender.com"
    console.log("WebSocket connecting to:", backendUrl)

    const websocket = new WebSocket(backendUrl)
    socketRef.current = websocket

    websocket.onopen = () => {
      console.log("WebSocket connected, registering with ID:", peerId)
      websocket.send(JSON.stringify({ type: "register", id: peerId }))
      setWs(websocket)
      setConnectionState("connected")

      // Clear any pending reconnection
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }

      console.log("WebSocket connection established successfully")
    }

    websocket.onmessage = (event) => {
      console.log("WebSocket received raw message:", event.data)
      try {
        const data = JSON.parse(event.data)
        console.log("WebSocket parsed message:", data.type, data)

        // Notify all registered handlers
        messageHandlersRef.current.forEach((handler) => {
          try {
            handler(data)
          } catch (error) {
            console.error("Error in message handler:", error)
          }
        })
      } catch (error) {
        console.error("Error parsing WebSocket message:", error)
      }
    }

    websocket.onclose = (event) => {
      console.log("WebSocket disconnected, code:", event.code, "reason:", event.reason)
      if (socketRef.current !== websocket) return // a newer socket replaced this one
      setConnectionState("disconnected")
      setWs(null)
      if (closedByUsRef.current) return

      // Auto-reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log("Attempting to reconnect...")
        connect()
      }, 3000)
    }

    websocket.onerror = (error) => {
      console.error("WebSocket error:", error)
      setConnectionState("disconnected")
    }
  }

  useEffect(() => {
    if (peerId) {
      console.log("Starting WebSocket connection for peer:", peerId)
      connect()
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      // Close the real socket (the old code closed a stale null), so leaving the room really leaves.
      closedByUsRef.current = true
      socketRef.current?.close()
      socketRef.current = null
    }
  }, [peerId])

  const sendMessage = (message: any) => {
    if (ws?.readyState === WebSocket.OPEN) {
      const messageStr = JSON.stringify(message)
      console.log("Sending WebSocket message:", message.type, message)
      ws.send(messageStr)
    } else {
      console.warn("WebSocket not connected, message not sent:", message)
      toast({
        title: "Connection Error",
        description: "Message not sent - reconnecting...",
        variant: "destructive",
      })
    }
  }

  const reconnect = () => {
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
    const old = socketRef.current
    socketRef.current = null
    old?.close()
    connect()
  }

  const registerMessageHandler = (handler: (data: any) => void) => {
    console.log("Registering message handler, total handlers:", messageHandlersRef.current.size + 1)
    messageHandlersRef.current.add(handler)
    return () => {
      console.log("Unregistering message handler, remaining handlers:", messageHandlersRef.current.size - 1)
      messageHandlersRef.current.delete(handler)
    }
  }

  const value: WebSocketContextType = {
    ws,
    connectionState,
    sendMessage,
    registerMessageHandler,
    reconnect,
  }

  return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>
}
