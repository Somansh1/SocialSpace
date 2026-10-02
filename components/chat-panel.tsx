"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { Loader2, Languages, Send, Volume2, VolumeX, X } from "lucide-react"
import { useWebSocket } from "@/components/websocket-provider"
import { useCall } from "@/components/call-provider"
import { FreeTranslationService, getLanguageName, getOfflineTranslation } from "@/lib/translation"

type Kind = "text" | "voice" | "translation"
interface Message {
  id: string
  text: string
  sender: string
  timestamp: Date
  isOwn: boolean
  kind: Kind
  /** small line above the text, e.g. who said it aloud or what a translation is */
  label?: string
  /** English version that came along with a spoken message */
  english?: string
}

// Spoken messages travel as "🎤 [en-US]: words → [EN]: words". Older clients rely on that text, so the wire format
// stays; here it is turned into a proper message and the marker never reaches the screen.
function parseIncoming(data: any): Pick<Message, "text" | "kind" | "label" | "english"> {
  const raw: string = String(data.message ?? "")
  const m = raw.match(/^🎤 \[([^\]]*)\]: ([\s\S]*?)(?: → \[EN\]: ([\s\S]*))?$/)
  if (data.transcribed || m) {
    return {
      kind: "voice",
      text: m ? m[2] : raw,
      label: `Said aloud${m && m[1] ? ` (${getLanguageName(m[1]) || m[1]})` : ""}`,
      english: m?.[3],
    }
  }
  return { kind: "text", text: raw }
}

export function ChatPanel({
  me,
  friend,
  friendHere,
  open,
  onClose,
  onUnreadChange,
}: {
  me: string
  friend: string
  friendHere: boolean
  open: boolean
  onClose: () => void
  onUnreadChange: (n: number) => void
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState("")
  const [readAloud, setReadAloud] = useState(false)
  const [unread, setUnread] = useState(0)
  const [translatingId, setTranslatingId] = useState<string | null>(null)
  const [notice, setNotice] = useState("")

  const endRef = useRef<HTMLDivElement>(null)
  const openRef = useRef(open)
  openRef.current = open
  const readAloudRef = useRef(readAloud)
  readAloudRef.current = readAloud
  const translator = useRef<FreeTranslationService | null>(null)

  const { sendMessage, connectionState, registerMessageHandler } = useWebSocket()
  const { translationService } = useCall()

  useEffect(() => {
    translator.current = new FreeTranslationService()
  }, [])

  useEffect(() => {
    return registerMessageHandler((data: any) => {
      if (data.type !== "chat-message" || data.senderId === me) return
      const parsed = parseIncoming(data)
      setMessages((prev) => [
        ...prev,
        { id: `${Date.now()}${Math.random()}`, sender: data.senderId, timestamp: new Date(), isOwn: false, ...parsed },
      ])
      if (!openRef.current) setUnread((n) => n + 1)
      if (readAloudRef.current && typeof window !== "undefined" && window.speechSynthesis) {
        const u = new SpeechSynthesisUtterance(parsed.text)
        u.rate = 0.9
        window.speechSynthesis.speak(u)
      }
    })
  })

  useEffect(() => {
    if (open) setUnread(0)
  }, [open])
  useEffect(() => onUnreadChange(unread), [unread, onUnreadChange])
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" })
  }, [messages, open])

  const send = (e: React.FormEvent) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    if (connectionState !== "connected") {
      setNotice("Not connected to the server, so this was not sent. Your text is still here.")
      return
    }
    setNotice("")
    setMessages((prev) => [...prev, { id: `${Date.now()}${Math.random()}`, text, sender: me, timestamp: new Date(), isOwn: true, kind: "text" }])
    sendMessage({ type: "chat-message", message: text, targetId: friend, senderId: me })
    setDraft("")
  }

  const translate = async (m: Message) => {
    if (!translator.current || translatingId) return
    setTranslatingId(m.id)
    setNotice("")
    const add = (text: string, label: string) =>
      setMessages((prev) => [...prev, { id: `${Date.now()}${Math.random()}`, text, sender: me, timestamp: new Date(), isOwn: true, kind: "translation", label }])
    try {
      const result = await translator.current.translateToEnglish(m.text)
      if (result?.translatedText && result.translatedText !== m.text) {
        add(result.translatedText, `Translated from ${getLanguageName(result.detectedLanguage || "unknown")} to English (${result.service}). Only you see this.`)
      } else {
        const offline = getOfflineTranslation(m.text)
        if (offline) add(offline, "Translated from a built-in phrase list. Only you see this.")
        else setNotice("Could not translate that message.")
      }
    } catch {
      setNotice("The translation service did not answer.")
    } finally {
      setTranslatingId(null)
    }
  }

  const time = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

  return (
    <section aria-label="Chat" className="flex h-full min-h-0 flex-col bg-surface">
      <header className="flex items-center gap-2 border-b-2 border-ink px-3 py-2">
        <h2 className="font-display text-2xl font-semibold">Chat</h2>
        <button onClick={() => setReadAloud((v) => !v)} aria-pressed={readAloud} title={`Translations use ${translationService}`} className="kt-btn kt-btn-sm ml-auto whitespace-nowrap">
          {readAloud ? <Volume2 className="h-4 w-4" aria-hidden /> : <VolumeX className="h-4 w-4" aria-hidden />}
          Read aloud: {readAloud ? "on" : "off"}
        </button>
        <button onClick={onClose} className="kt-btn kt-btn-sm min-w-[44px] px-2" aria-label="Close chat">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </header>

      <div role="log" aria-live="polite" aria-label="Messages" className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-4">
        {messages.length === 0 && (
          <p className="py-10 text-center text-mute">
            Nothing said yet.
            <br />
            {friendHere ? `Say hello to ${friend}.` : `${friend} has not sat down yet.`}
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex flex-col ${m.isOwn ? "items-end" : "items-start"}`}>
            <span className={`mb-0.5 font-display text-sm font-semibold italic ${m.isOwn ? "text-you-ink" : "text-friend-ink"}`}>
              {m.isOwn ? "you" : friend}
            </span>
            <div
              className={`kt-enter max-w-[85%] rounded-[6px] border-2 px-3 py-2 ${
                m.isOwn ? "border-you bg-you-tint" : "border-friend bg-friend-tint"
              } ${m.kind === "translation" ? "border-dashed" : ""}`}
            >
              {m.label && <p className="mb-1 text-xs font-semibold text-mute">{m.label}</p>}
              <p className="whitespace-pre-wrap break-words text-[15px] text-ink">{m.text}</p>
              {m.english && <p className="mt-1 border-t border-ink/30 pt-1 text-sm text-ink">In English: {m.english}</p>}
              <div className="mt-1 flex items-center gap-2 text-xs text-mute">
                <time>{time(m.timestamp)}</time>
                {!m.isOwn && m.kind === "text" && (
                  <button
                    onClick={() => translate(m)}
                    disabled={translatingId !== null}
                    className="inline-flex min-h-[32px] items-center gap-1 rounded px-1 font-semibold underline underline-offset-2"
                  >
                    {translatingId === m.id ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <Languages className="h-3 w-3" aria-hidden />}
                    Translate
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="border-t-2 border-ink p-3">
        {notice && (
          <p role="alert" className="mb-2 text-sm font-semibold text-danger">
            {notice}
          </p>
        )}
        {!friendHere && connectionState === "connected" && (
          <p className="mb-2 text-sm text-mute">{friend} is not here, so they will not receive messages right now.</p>
        )}
        <div className="flex gap-2">
          <label htmlFor="chat-draft" className="sr-only">
            Message to {friend}
          </label>
          <input
            id="chat-draft"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a message"
            autoComplete="off"
            className="kt-field flex-1"
          />
          <button type="submit" disabled={!draft.trim()} className="kt-btn kt-btn-primary">
            <Send className="h-4 w-4" aria-hidden />
            Send
          </button>
        </div>
      </form>
    </section>
  )
}
