"use client"

import { useCallback, useState } from "react"
import { Check, Link2, Loader2, LogOut } from "lucide-react"
import { Chair, NotepadObject, PhoneObject, SketchbookObject, TvObject } from "@/components/art"
import { CallPanel, CallStrip, IncomingCallBanner } from "@/components/call-panel"
import { ChatPanel } from "@/components/chat-panel"
import { DrawActivity } from "@/components/draw-activity"
import { WatchActivity } from "@/components/watch-activity"
import { useCall } from "@/components/call-provider"
import { usePresence, type PresenceStatus } from "@/components/presence-provider"
import { buildInviteUrl } from "@/lib/ids"

type Main = "talk" | "draw" | "watch"

const OBJECTS = [
  { id: "talk", label: "Talk", Icon: PhoneObject },
  { id: "chat", label: "Chat", Icon: NotepadObject },
  { id: "draw", label: "Draw", Icon: SketchbookObject },
  { id: "watch", label: "Watch", Icon: TvObject },
] as const

function StatusBanner({ status, friend, inviteUrl, retry }: { status: PresenceStatus; friend: string; inviteUrl: string; retry: () => void }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl)
    } catch {
      window.prompt("Copy this invite link and send it to your friend:", inviteUrl)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  if (status === "here") return null

  if (status === "server-connecting")
    return (
      <div role="status" className="kt-panel flex items-center gap-3 p-3">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        <p className="font-semibold">Connecting to the server...</p>
      </div>
    )

  if (status === "server-down")
    return (
      <div role="alert" className="kt-panel flex flex-wrap items-center gap-3 border-danger p-3" style={{ boxShadow: "4px 4px 0 #B3261E" }}>
        <p className="min-w-[200px] flex-1 font-semibold text-danger">
          Cannot reach the server. It may be starting up, or you may be offline. We keep trying every few seconds.
        </p>
        <button onClick={retry} className="kt-btn kt-btn-primary">
          Try again now
        </button>
      </div>
    )

  return (
    <div role="status" className="kt-panel flex flex-wrap items-center gap-3 bg-surface p-3">
      <div className="min-w-[220px] flex-1">
        <p className="font-semibold">
          {status === "left" ? (
            <>
              <span className="font-display italic text-friend-ink">{friend}</span> left the table.
            </>
          ) : (
            <>
              Waiting for <span className="font-display italic text-friend-ink">{friend}</span> to sit down.
            </>
          )}
        </p>
        <p className="break-all text-sm text-mute">
          {status === "left" ? "They can come back with the same link:" : "Send them this link. It fills in both names for them:"} <span className="select-all">{inviteUrl}</span>
        </p>
      </div>
      <button onClick={copy} className="kt-btn">
        {copied ? <Check className="h-4 w-4" aria-hidden /> : <Link2 className="h-4 w-4" aria-hidden />}
        {copied ? "Link copied" : "Copy invite link"}
      </button>
    </div>
  )
}

export function Room({ me, friend, onLeave }: { me: string; friend: string; onLeave: () => void }) {
  const [main, setMain] = useState<Main>("talk")
  const [chatOpen, setChatOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const { status, friendHere, retry, sayGoodbye } = usePresence()
  const { callState } = useCall()

  const onUnread = useCallback((n: number) => setUnread(n), [])
  const inviteUrl = typeof window === "undefined" ? "" : buildInviteUrl(window.location.origin, me, friend)

  // Desktop: chat is a side panel you can leave open next to any activity.
  // Mobile: chat is one of four tabs and fills the screen.
  const choose = (id: (typeof OBJECTS)[number]["id"]) => {
    if (id === "chat") {
      setChatOpen((v) => !v)
      return
    }
    setMain(id)
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) setChatOpen(false)
  }
  const isActive = (id: (typeof OBJECTS)[number]["id"]) => (id === "chat" ? chatOpen : main === id)

  const leave = () => {
    sayGoodbye()
    setTimeout(onLeave, 80)
  }

  const live = callState === "active" || callState === "calling"

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-7xl flex-col px-3 pb-[88px] pt-3 md:px-6 md:pb-6 md:pt-5">
      <IncomingCallBanner friend={friend} />

      {/* top line */}
      <header className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1">
        <h1 className="font-display text-2xl font-bold tracking-tight">SocialSpace</h1>
        <button onClick={leave} className="kt-btn kt-btn-sm ml-auto md:order-last">
          <LogOut className="h-4 w-4" aria-hidden />
          Leave table
        </button>
        <p className="flex basis-full flex-wrap items-baseline gap-x-4 text-[15px] md:basis-auto">
          <span>
            <span className="text-mute">you </span>
            <span className="font-display text-lg font-semibold italic text-you-ink">{me}</span>
          </span>
          <span>
            <span className="text-mute">with </span>
            <span className="font-display text-lg font-semibold italic text-friend-ink">{friend}</span>
            <span className="ml-2 text-sm font-semibold text-mute" aria-live="polite">
              {status === "here" ? "(here)" : status === "left" ? "(left)" : status === "waiting" ? "(not here yet)" : ""}
            </span>
          </span>
        </p>
      </header>

      <StatusBanner status={status} friend={friend} inviteUrl={inviteUrl} retry={retry} />

      {/* the table: desktop only. The same four choices are the dock on mobile. */}
      <nav aria-label="Activities" className="mx-auto mt-4 hidden items-end justify-center md:flex">
        <div className="flex w-[130px] flex-col items-end">
          <Chair color="#E4572E" occupied className="h-[112px] w-[68px]" title="Your chair, taken" />
          <span className="mt-1 max-w-full truncate font-display text-sm font-semibold italic text-you-ink">{me}</span>
        </div>
        <div className="relative pb-[22px]">
          <div className="flex items-end gap-2 rounded-[8px] border-[3px] border-ink bg-tan px-4 pb-3 pt-6 shadow-hard">
            {OBJECTS.map(({ id, label, Icon }) => {
              const active = isActive(id)
              return (
                <button
                  key={id}
                  onClick={() => choose(id)}
                  aria-pressed={id === "chat" ? chatOpen : undefined}
                  aria-current={id !== "chat" && main === id ? "page" : undefined}
                  className={`relative flex min-h-[44px] w-[104px] flex-col items-center gap-0.5 rounded-[6px] border-2 px-2 pb-1.5 pt-1 text-sm font-bold transition-transform duration-150 ease-out ${
                    active ? "-translate-y-2 border-ink bg-surface shadow-hard-sm" : "border-transparent hover:-translate-y-1"
                  }`}
                >
                  <Icon className="h-14 w-14" />
                  <span>{label}</span>
                  {id === "chat" && unread > 0 && (
                    <span className="absolute -right-1 -top-2 rounded-full border-2 border-ink bg-mustard px-1.5 text-xs font-bold">
                      {unread}
                      <span className="sr-only"> unread</span>
                    </span>
                  )}
                  {id === "talk" && live && <span className="absolute -right-1 -top-2 rounded-full border-2 border-ink bg-friend px-1.5 text-xs font-bold text-surface">live</span>}
                </button>
              )
            })}
          </div>
          <span aria-hidden className="absolute bottom-0 left-6 block h-[22px] w-3 border-2 border-t-0 border-ink bg-tan" />
          <span aria-hidden className="absolute bottom-0 right-6 block h-[22px] w-3 border-2 border-t-0 border-ink bg-tan" />
        </div>
        <div className="flex w-[130px] flex-col items-start pl-1">
          <Chair color="#2F7F79" occupied={friendHere} flip className="h-[112px] w-[68px]" title={friendHere ? `${friend}'s chair, taken` : `${friend}'s chair, empty`} />
          <span className="mt-1 max-w-full truncate pl-2 font-display text-sm font-semibold italic text-friend-ink">
            {friend}
            <span className="block pl-0 font-sans text-xs not-italic text-mute">{friendHere ? "is here" : status.startsWith("server") ? "status unknown" : status === "left" ? "left" : "not here yet"}</span>
          </span>
        </div>
      </nav>
      <div aria-hidden className="mx-auto mb-4 hidden h-0 w-full max-w-3xl border-t-2 border-ink md:block" />

      {/* activities */}
      <div className="mt-3 flex min-h-0 flex-1 gap-5 md:mt-0">
        <div className="min-w-0 flex-1">
          {main !== "talk" && <CallStrip friend={friend} onBack={() => setMain("talk")} />}
          {/* every activity stays mounted so drawings, video position and call video survive switching */}
          <div className={main === "talk" ? "" : "hidden"}>
            <CallPanel me={me} friend={friend} friendHere={friendHere} chatUnread={unread} onOpenChat={() => setChatOpen(true)} />
          </div>
          <div className={main === "draw" ? "" : "hidden"}>
            <DrawActivity me={me} friend={friend} />
          </div>
          <div className={main === "watch" ? "" : "hidden"}>
            <WatchActivity me={me} friend={friend} friendHere={friendHere} />
          </div>
        </div>

        {/* chat: a side panel on desktop, a full sheet above the dock on mobile */}
        <aside
          className={
            chatOpen
              ? "fixed inset-x-0 bottom-[76px] top-0 z-30 flex flex-col bg-paper md:static md:z-auto md:block md:w-[380px] md:shrink-0 md:bg-transparent"
              : "hidden"
          }
        >
          <div className="md:hidden">
            <div className="px-3 pt-3">
              <CallStrip friend={friend} onBack={() => { setChatOpen(false); setMain("talk") }} />
            </div>
          </div>
          <div className="kt-panel mx-3 mb-3 min-h-0 flex-1 overflow-hidden md:sticky md:top-4 md:mx-0 md:mb-0 md:h-[min(640px,calc(100dvh-300px))] md:min-h-[440px]">
            <ChatPanel me={me} friend={friend} friendHere={friendHere} open={chatOpen} onClose={() => setChatOpen(false)} onUnreadChange={onUnread} />
          </div>
        </aside>
      </div>

      {/* mobile dock */}
      <nav aria-label="Activities" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t-[3px] border-ink bg-tan md:hidden">
        {OBJECTS.map(({ id, label, Icon }) => {
          const active = id === "chat" ? chatOpen : !chatOpen && main === id
          return (
            <button
              key={id}
              onClick={() => choose(id)}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-h-[72px] flex-col items-center justify-center gap-0.5 text-[13px] font-bold ${active ? "bg-surface" : ""}`}
            >
              <Icon className="h-8 w-8" />
              <span className={active ? "underline decoration-2 underline-offset-4" : ""}>{label}</span>
              {id === "chat" && unread > 0 && (
                <span className="absolute right-3 top-1.5 rounded-full border-2 border-ink bg-mustard px-1.5 text-xs font-bold">
                  {unread}
                  <span className="sr-only"> unread</span>
                </span>
              )}
              {id === "talk" && live && <span className="absolute right-3 top-1.5 rounded-full border-2 border-ink bg-friend px-1.5 text-xs font-bold text-surface">live</span>}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
