"use client"

import { useEffect, useRef, useState } from "react"
import { Link2, Shuffle, Check } from "lucide-react"
import { TableScene } from "@/components/art"
import { buildInviteUrl, generateId, normalizeId, readInvite } from "@/lib/ids"

export function EntryScreen({ onJoin }: { onJoin: (me: string, friend: string) => void }) {
  const [me, setMe] = useState("")
  const [friend, setFriend] = useState("")
  const [fromInvite, setFromInvite] = useState(false)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)
  const friendRef = useRef<HTMLInputElement>(null)

  // generated in an effect so server and client markup match
  useEffect(() => {
    const invite = readInvite(window.location.search)
    if (invite) {
      setMe(invite.me)
      setFriend(invite.friend)
      setFromInvite(true)
    } else {
      setMe(generateId())
      setFriend(generateId())
    }
  }, [])

  const myId = normalizeId(me)
  const friendId = normalizeId(friend)

  const validate = () => {
    if (!myId) return "Write your name in the first blank."
    if (!friendId) return "Write who you are meeting in the second blank."
    if (myId === friendId) return "The two blanks need different names, or you would be meeting yourself."
    return ""
  }

  const join = (e: React.FormEvent) => {
    e.preventDefault()
    const problem = validate()
    setError(problem)
    if (!problem) onJoin(myId, friendId)
  }

  const copyInvite = async () => {
    const problem = validate()
    setError(problem)
    if (problem) return
    const url = buildInviteUrl(window.location.origin, myId, friendId)
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      window.prompt("Copy this invite link and send it to your friend:", url)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const shuffle = () => {
    setMe(generateId())
    setFriend(generateId())
    setFromInvite(false)
  }

  const blank = (value: string) => ({ width: `${Math.max(value.length, 8) + 1}ch`, maxWidth: "100%" })

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col justify-center gap-8 px-5 py-8 md:px-10 lg:flex-row lg:items-center lg:gap-14">
      <form onSubmit={join} className="w-full lg:w-[52%]" noValidate>
        <p className="kt-eyebrow mb-4">SocialSpace, a table for two</p>
        <h1 className="font-display text-[34px] font-semibold leading-[1.35] tracking-tight sm:text-5xl sm:leading-[1.3]">
          I&apos;m{" "}
          <input
            id="me"
            aria-label="Your name"
            value={me}
            onChange={(e) => setMe(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !friendId) {
                e.preventDefault()
                friendRef.current?.focus()
              }
            }}
            className="kt-blank border-you text-you-ink"
            style={blank(me)}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-describedby="entry-help"
          />{" "}
          and I&apos;m meeting{" "}
          <input
            id="friend"
            aria-label="Your friend's name"
            ref={friendRef}
            value={friend}
            onChange={(e) => {
              setFriend(e.target.value)
              setFromInvite(false)
            }}
            className="kt-blank border-friend text-friend-ink"
            style={blank(friend)}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-describedby="entry-help"
          />
          .
        </h1>

        <p id="entry-help" className="mt-5 max-w-prose text-[17px] leading-relaxed text-mute">
          {fromInvite
            ? "Your friend sent you here, so both names are already filled in. Pull up a chair and they will see you sit down."
            : "Those are the names you meet under. Copy the invite link and send it to your friend; it fills in both blanks for them. Then you both pull up a chair."}
        </p>

        {error && (
          <p role="alert" className="mt-4 rounded-[6px] border-2 border-danger bg-surface px-3 py-2 text-[15px] font-semibold text-danger">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="submit" className="kt-btn kt-btn-primary">
            Pull up a chair
          </button>
          <button type="button" onClick={copyInvite} className="kt-btn">
            {copied ? <Check className="h-4 w-4" aria-hidden /> : <Link2 className="h-4 w-4" aria-hidden />}
            {copied ? "Link copied" : "Copy invite link"}
          </button>
          <button type="button" onClick={shuffle} className="kt-btn kt-btn-sm border-transparent bg-transparent shadow-none underline underline-offset-4">
            <Shuffle className="h-4 w-4" aria-hidden />
            New names
          </button>
        </div>
        <span className="sr-only" role="status" aria-live="polite">
          {copied ? "Invite link copied to the clipboard" : ""}
        </span>
      </form>

      <div className="w-full max-w-[520px] self-center lg:w-[48%]">
        <TableScene className="h-auto w-full" />
        <p className="mt-2 text-center text-sm text-mute">One chair is yours. The other waits for them.</p>
      </div>
    </main>
  )
}
