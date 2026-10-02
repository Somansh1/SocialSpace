"use client"

import { useEffect, useState } from "react"
import { Mic, MicOff, Video, VideoOff, Volume2, VolumeX, PhoneOff, Phone, MessageCircle, Captions, X } from "lucide-react"
import { useCall } from "@/components/call-provider"

const LANGS = [
  { code: "en-US", label: "English" },
  { code: "zh-CN", label: "Chinese" },
  { code: "hi-IN", label: "Hindi" },
]

function useElapsed(running: boolean) {
  const [s, setS] = useState(0)
  useEffect(() => {
    if (!running) {
      setS(0)
      return
    }
    const t = setInterval(() => setS((v) => v + 1), 1000)
    return () => clearInterval(t)
  }, [running])
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

/** Shown wherever you are in the room when the phone rings. */
export function IncomingCallBanner({ friend }: { friend: string }) {
  const { callState, isVideoCall, acceptCall, rejectCall } = useCall()
  if (callState !== "ringing") return null
  return (
    <div
      role="alert"
      className="kt-enter kt-panel fixed left-3 right-3 top-3 z-50 flex flex-wrap items-center gap-3 p-3 md:left-auto md:right-6 md:top-6 md:w-[460px]"
    >
      <div className="min-w-0 flex-1">
        <p className="kt-eyebrow">Incoming {isVideoCall ? "video" : "voice"} call</p>
        <p className="truncate font-display text-xl font-semibold italic text-friend-ink">{friend} is calling</p>
      </div>
      <div className="flex gap-2">
        <button onClick={acceptCall} className="kt-btn kt-btn-primary">
          <Phone className="h-4 w-4" aria-hidden />
          Accept
        </button>
        <button onClick={rejectCall} className="kt-btn">
          Decline
        </button>
      </div>
    </div>
  )
}

/** Thin bar for when you are on a call but looking at another activity. */
export function CallStrip({ friend, onBack }: { friend: string; onBack: () => void }) {
  const { callState, isMuted, toggleMute, endCall } = useCall()
  const elapsed = useElapsed(callState === "active")
  if (callState !== "active" && callState !== "calling") return null
  return (
    <div className="kt-panel mb-3 flex flex-wrap items-center gap-2 bg-friend-tint px-3 py-2" role="status">
      <span className="font-semibold">
        {callState === "calling" ? `Ringing ${friend}` : `On a call with ${friend}`}
        {callState === "active" && <span className="ml-2 tabular-nums text-mute">{elapsed}</span>}
      </span>
      <span className="ml-auto flex flex-wrap gap-2">
        <button onClick={onBack} className="kt-btn kt-btn-sm">
          Back to call
        </button>
        {callState === "active" && (
          <button onClick={toggleMute} aria-pressed={isMuted} className="kt-btn kt-btn-sm">
            {isMuted ? "Unmute" : "Mute"}
          </button>
        )}
        <button onClick={endCall} className="kt-btn kt-btn-sm kt-btn-danger">
          Hang up
        </button>
      </span>
    </div>
  )
}

function Polaroid({
  who,
  tone,
  children,
  caption,
  className = "",
}: {
  who: string
  tone: "you" | "friend"
  children: React.ReactNode
  caption: string
  className?: string
}) {
  const frame = tone === "you" ? "border-you" : "border-friend"
  const nameColor = tone === "you" ? "text-you-ink" : "text-friend-ink"
  return (
    <figure className={`rounded-[6px] border-2 border-ink bg-surface p-2.5 pb-3 shadow-hard ${className}`}>
      <div className={`relative aspect-[4/3] overflow-hidden border-[5px] bg-ink ${frame}`}>{children}</div>
      <figcaption className="mt-2 flex items-baseline justify-between gap-2 px-1">
        <span className={`truncate font-display text-lg font-semibold italic ${nameColor}`}>{who}</span>
        <span className="shrink-0 text-xs font-semibold text-mute">{caption}</span>
      </figcaption>
    </figure>
  )
}

export function CallPanel({
  me,
  friend,
  friendHere,
  chatUnread,
  onOpenChat,
}: {
  me: string
  friend: string
  friendHere: boolean
  chatUnread: number
  onOpenChat: () => void
}) {
  const {
    callState,
    isMuted,
    isVideoMuted,
    isDeafened,
    isTranscribing,
    transcriptionLanguage,
    localStream,
    remoteStream,
    startCall,
    endCall,
    toggleMute,
    toggleVideo,
    toggleDeafen,
    toggleTranscription,
    setTranscriptionLanguage,
    localVideoRef,
    remoteVideoRef,
    callNotice,
    clearCallNotice,
    connectionState,
  } = useCall()

  const elapsed = useElapsed(callState === "active")

  // attach streams whenever they appear (the elements are always mounted)
  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream
  }, [localStream, localVideoRef])
  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream
  }, [remoteStream, remoteVideoRef])

  const canRing = connectionState === "connected" && friendHere
  const live = callState === "active" || callState === "calling"

  let friendCaption = "not on a call"
  if (callState === "calling") friendCaption = "ringing..."
  else if (callState === "ringing") friendCaption = "calling you"
  else if (callState === "active") friendCaption = remoteStream ? elapsed : "connecting..."

  return (
    <section aria-label="Talk" className="flex flex-col gap-4">
      {callNotice && (
        <div role="alert" className="kt-panel flex items-start gap-3 border-danger bg-surface p-3 text-danger" style={{ boxShadow: "4px 4px 0 #B3261E" }}>
          <p className="flex-1 font-semibold">{callNotice}</p>
          <button onClick={clearCallNotice} className="kt-btn kt-btn-sm min-w-[44px] px-2" aria-label="Dismiss this message">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}

      <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,240px)] lg:grid-cols-[minmax(0,1fr)_280px]">
        <Polaroid who={friend} tone="friend" caption={friendCaption} className="md:-rotate-[0.8deg]">
          <video
            key={remoteStream ? "live" : "idle"}
            ref={remoteVideoRef}
            autoPlay
            playsInline
            aria-label={`${friend}'s video`}
            className={`kt-develop h-full w-full object-cover ${remoteStream ? "" : "invisible"}`}
          />
          {!remoteStream && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-friend-tint px-4 text-center text-ink">
              <span className="font-display text-6xl font-semibold italic text-friend-ink" aria-hidden>
                {friend.charAt(0).toUpperCase()}
              </span>
              <span className="text-sm font-semibold">
                {callState === "idle" ? (friendHere ? `${friend} is at the table. Ring them.` : `Waiting for ${friend} to sit down.`) : "Getting the picture..."}
              </span>
            </div>
          )}
        </Polaroid>

        <Polaroid who={`${me} (you)`} tone="you" caption={isVideoMuted ? "camera off" : isMuted ? "muted" : "live"} className="mx-auto w-full max-w-[280px] md:rotate-[1deg]">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            aria-label="Your video"
            className={`h-full w-full -scale-x-100 object-cover ${localStream && !isVideoMuted ? "" : "invisible"}`}
          />
          {(!localStream || isVideoMuted) && (
            <div className="absolute inset-0 flex items-center justify-center bg-you-tint px-3 text-center text-sm font-semibold text-ink">
              {isVideoMuted ? "Your camera is off" : "Waiting for camera permission"}
            </div>
          )}
        </Polaroid>
      </div>

      {/* controls */}
      <div className="kt-panel flex flex-wrap items-center gap-2 p-3" role="group" aria-label="Call controls">
        {!live && (
          <>
            <button onClick={() => startCall(false)} disabled={!canRing} className="kt-btn kt-btn-primary">
              <Phone className="h-4 w-4" aria-hidden />
              Call
            </button>
            <button onClick={() => startCall(true)} disabled={!canRing} className="kt-btn">
              <Video className="h-4 w-4" aria-hidden />
              Video call
            </button>
            {!canRing && <span className="text-sm text-mute">{connectionState !== "connected" ? "Calling needs the server." : `Calling opens once ${friend} is here.`}</span>}
          </>
        )}
        {callState === "calling" && (
          <>
            <span className="font-semibold" role="status">
              Ringing {friend}...
            </span>
            <button onClick={endCall} className="kt-btn ml-auto kt-btn-danger">
              <PhoneOff className="h-4 w-4" aria-hidden />
              Cancel
            </button>
          </>
        )}
        {callState === "active" && (
          <>
            <button onClick={toggleMute} aria-pressed={isMuted} className="kt-btn">
              {isMuted ? <MicOff className="h-4 w-4" aria-hidden /> : <Mic className="h-4 w-4" aria-hidden />}
              {isMuted ? "Unmute" : "Mute"}
            </button>
            <button onClick={toggleVideo} aria-pressed={isVideoMuted} className="kt-btn">
              {isVideoMuted ? <VideoOff className="h-4 w-4" aria-hidden /> : <Video className="h-4 w-4" aria-hidden />}
              {isVideoMuted ? "Camera on" : "Camera off"}
            </button>
            <button onClick={toggleDeafen} aria-pressed={isDeafened} className="kt-btn">
              {isDeafened ? <VolumeX className="h-4 w-4" aria-hidden /> : <Volume2 className="h-4 w-4" aria-hidden />}
              {isDeafened ? "Hear them" : "Silence them"}
            </button>
            <button onClick={onOpenChat} className="kt-btn relative">
              <MessageCircle className="h-4 w-4" aria-hidden />
              Chat
              {chatUnread > 0 && <span className="ml-1 rounded-full border-2 border-ink bg-mustard px-1.5 text-xs">{chatUnread} new</span>}
            </button>
            <button onClick={endCall} className="kt-btn kt-btn-danger ml-auto">
              <PhoneOff className="h-4 w-4" aria-hidden />
              Hang up
            </button>
          </>
        )}
      </div>

      {callState === "active" && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button onClick={toggleTranscription} aria-pressed={isTranscribing} className="kt-btn kt-btn-sm">
            <Captions className="h-4 w-4" aria-hidden />
            {isTranscribing ? "Stop writing down what I say" : "Write down what I say in chat"}
          </button>
          <label className="flex items-center gap-2 text-mute">
            I speak
            <select
              value={transcriptionLanguage}
              onChange={(e) => setTranscriptionLanguage(e.target.value)}
              className="min-h-[44px] rounded-[6px] border-2 border-ink bg-surface px-2 font-semibold text-ink"
            >
              {LANGS.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </section>
  )
}
