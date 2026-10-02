"use client"

import { useState } from "react"
import { EntryScreen } from "@/components/entry-screen"
import { Room } from "@/components/room"
import { WebSocketProvider } from "@/components/websocket-provider"
import { PresenceProvider } from "@/components/presence-provider"
import { CallProvider } from "@/components/call-provider"

export default function Home() {
  const [session, setSession] = useState<{ me: string; friend: string } | null>(null)

  if (!session) return <EntryScreen onJoin={(me, friend) => setSession({ me, friend })} />

  return (
    <WebSocketProvider peerId={session.me}>
      <PresenceProvider peerId={session.me} targetId={session.friend}>
        <CallProvider peerId={session.me} targetId={session.friend}>
          <main>
            <Room me={session.me} friend={session.friend} onLeave={() => setSession(null)} />
          </main>
        </CallProvider>
      </PresenceProvider>
    </WebSocketProvider>
  )
}
