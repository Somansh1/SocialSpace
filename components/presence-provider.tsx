"use client"

import type React from "react"
import { createContext, useContext, useEffect, useRef, useState } from "react"
import { useWebSocket } from "@/components/websocket-provider"
import { play } from "@/lib/sounds"

/**
 * Who is actually at the table, worked out on the clients alone.
 *
 * The relay only forwards JSON by `targetId`, so presence is a tiny message of our own:
 *   { type: "presence", kind: "ping" | "pong" | "bye", senderId, targetId }
 * Every PING_MS we ping the friend; whoever receives a ping answers with a pong.
 * Hearing anything from the friend within STALE_MS means they are here.
 * Two optional hints from the relay make "left" faster, but nothing depends on them:
 *   - { type: "error", message: "Target client <id> not found" } after a ping to someone not registered
 *   - { type: "user-disconnected", userId }
 */
export type PresenceStatus =
  | "server-connecting" // opening the socket to the relay
  | "server-down" // socket closed or failed; auto-retrying, user can retry now
  | "waiting" // on the relay, friend has never answered
  | "here" // friend answered recently
  | "left" // friend was here and has stopped answering

interface PresenceContextType {
  status: PresenceStatus
  friendHere: boolean
  retry: () => void
  /** Tell the friend we are leaving on purpose (so they see "left" at once). */
  sayGoodbye: () => void
}

const PresenceContext = createContext<PresenceContextType | undefined>(undefined)

export function usePresence() {
  const ctx = useContext(PresenceContext)
  if (!ctx) throw new Error("usePresence must be used within a PresenceProvider")
  return ctx
}

const PING_MS = 4000
const STALE_MS = 11000 // three missed pings

export function PresenceProvider({
  peerId,
  targetId,
  children,
}: {
  peerId: string
  targetId: string
  children: React.ReactNode
}) {
  const { connectionState, sendMessage, registerMessageHandler, reconnect } = useWebSocket()
  const [friendHere, setFriendHere] = useState(false)
  const [everSeen, setEverSeen] = useState(false)
  const lastHeard = useRef(0)

  // keep the latest sender without re-creating the interval on every render
  const sendRef = useRef(sendMessage)
  sendRef.current = sendMessage

  const markHere = () => {
    lastHeard.current = Date.now()
    setFriendHere(true)
    setEverSeen(true)
  }
  const markGone = () => {
    lastHeard.current = 0
    setFriendHere(false)
  }

  // answer / listen
  useEffect(() => {
    return registerMessageHandler((data: any) => {
      if (data.type === "presence" && data.senderId === targetId) {
        if (data.kind === "bye") {
          markGone()
          return
        }
        markHere()
        if (data.kind === "ping") {
          sendRef.current({ type: "presence", kind: "pong", targetId, senderId: peerId })
        }
      } else if (data.type === "user-disconnected" && data.userId === targetId) {
        markGone()
      } else if (data.type === "error" && typeof data.message === "string" && data.message.includes(targetId)) {
        markGone()
      }
    })
  })

  // ping on a timer while the socket is open, and expire stale friends
  useEffect(() => {
    if (connectionState !== "connected") {
      markGone()
      return
    }
    const ping = () => sendRef.current({ type: "presence", kind: "ping", targetId, senderId: peerId })
    ping()
    const timer = setInterval(() => {
      ping()
      if (lastHeard.current && Date.now() - lastHeard.current > STALE_MS) markGone()
    }, PING_MS)
    return () => clearInterval(timer)
  }, [connectionState, peerId, targetId])

  // sound only on real changes, never for the initial "not here" state
  const wasHere = useRef(false)
  useEffect(() => {
    if (friendHere !== wasHere.current) play(friendHere ? "join" : "leave")
    wasHere.current = friendHere
  }, [friendHere])

  // a new friend id means a new table
  useEffect(() => {
    setEverSeen(false)
    markGone()
  }, [targetId])

  let status: PresenceStatus
  if (connectionState === "connecting") status = "server-connecting"
  else if (connectionState === "disconnected") status = "server-down"
  else if (friendHere) status = "here"
  else status = everSeen ? "left" : "waiting"

  const value: PresenceContextType = {
    status,
    friendHere,
    retry: reconnect,
    sayGoodbye: () => sendRef.current({ type: "presence", kind: "bye", targetId, senderId: peerId }),
  }

  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>
}
