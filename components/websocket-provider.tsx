"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect, useRef } from "react"
import { useToast } from "@/hooks/use-toast"

interface WebSocketContextType {
  ws: WebSocket | null
  connectionState: "disconnected" | "connecting" | "connected"
  sendMessage: (message: any) => void
  registerMessageHandler: (handler: (data: any) => void) => () => void
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
  const [connectionState, setConnectionState] = useState<"disconnected" | "connecting" | "connected">("disconnected")
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()
  const messageHandlersRef = useRef<Set<(data: any) => void>>(new Set())
  const { toast } = useToast()

  const connect = () => {
    if (ws?.readyState === WebSocket.OPEN) return

    setConnectionState("connecting")
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "wss://socialspace-bakend.onrender.com"
    console.log("WebSocket connecting to:", backendUrl)

    const websocket = new WebSocket(backendUrl)

    websocket.onopen = () => {
      console.log("WebSocket connected")
      websocket.send(JSON.stringify({ type: "register", id: peerId }))
      setWs(websocket)
      setConnectionState("connected")

      // Clear any pending reconnection
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }

      toast({
        title: "Connected",
        description: "Connected to server",
      })
    }

    websocket.onmessage = (event) => {
      console.log("WebSocket received message:", event.data)
      try {
        const data = JSON.parse(event.data)
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

    websocket.onclose = () => {
      console.log("WebSocket disconnected")
      setConnectionState("disconnected")
      setWs(null)

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
    connect()

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (ws) {
        ws.close()
      }
    }
  }, [peerId])

  const sendMessage = (message: any) => {
    if (ws?.readyState === WebSocket.OPEN) {
      console.log("Sending message:", message)
      ws.send(JSON.stringify(message))
    } else {
      console.warn("WebSocket not connected, message not sent:", message)
      toast({
        title: "Connection Error",
        description: "Message not sent - reconnecting...",
        variant: "destructive",
      })
    }
  }

  const registerMessageHandler = (handler: (data: any) => void) => {
    messageHandlersRef.current.add(handler)
    return () => {
      messageHandlersRef.current.delete(handler)
    }
  }

  const value: WebSocketContextType = {
    ws,
    connectionState,
    sendMessage,
    registerMessageHandler,
  }

  return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>
}
