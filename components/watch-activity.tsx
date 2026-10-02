"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { ExternalLink, Maximize, Pause, Play, Volume2, VolumeX } from "lucide-react"
import { useWebSocket } from "@/components/websocket-provider"
import { safeHttpUrl } from "@/lib/safe-url"

interface SyncData {
  currentTime: number
  isPlaying: boolean
  timestamp: number
  url?: string
}

const PLATFORMS = [
  { name: "YouTube", pattern: /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/ },
  { name: "Twitch", pattern: /twitch\.tv\/videos\/(\d+)|twitch\.tv\/(\w+)/ },
  { name: "Vimeo", pattern: /vimeo\.com\/(\d+)/ },
  { name: "Dailymotion", pattern: /dailymotion\.com\/video\/([^_]+)/ },
  { name: "Direct Video", pattern: /\.(mp4|webm|ogg)$/i },
]

const detect = (url: string) => PLATFORMS.find((p) => p.pattern.test(url)) ?? null

function embedUrl(url: string, name: string) {
  const m = url.match(PLATFORMS.find((p) => p.name === name)!.pattern)
  if (!m) return url
  switch (name) {
    case "YouTube":
      return `https://www.youtube.com/embed/${encodeURIComponent(m[1])}?enablejsapi=1&origin=${window.location.origin}`
    case "Twitch":
      return m[1] ? `https://player.twitch.tv/?video=${encodeURIComponent(m[1])}&parent=${window.location.hostname}` : `https://player.twitch.tv/?channel=${encodeURIComponent(m[2])}&parent=${window.location.hostname}`
    case "Vimeo":
      return `https://player.vimeo.com/video/${encodeURIComponent(m[1])}`
    case "Dailymotion":
      return `https://www.dailymotion.com/embed/video/${encodeURIComponent(m[1])}`
    default:
      return url
  }
}

const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`

export function WatchActivity({ me, friend, friendHere }: { me: string; friend: string; friendHere: boolean }) {
  const [input, setInput] = useState("")
  const [videoUrl, setVideoUrl] = useState("")
  const [isHost, setIsHost] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [notice, setNotice] = useState("")

  const videoRef = useRef<HTMLVideoElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const lastSync = useRef(0)

  const { sendMessage, registerMessageHandler } = useWebSocket()

  const platform = videoUrl ? detect(videoUrl) : null
  const isDirect = platform?.name === "Direct Video"

  const pushSync = () => {
    const v = videoRef.current
    if (!v) return
    const syncData: SyncData = { currentTime: v.currentTime, isPlaying: !v.paused, timestamp: Date.now(), url: videoUrl }
    sendMessage({ type: "video-sync", syncData, targetId: friend, senderId: me })
  }

  // friend's messages
  useEffect(() => {
    return registerMessageHandler((data: any) => {
      if (data.type === "video-url") {
        const url = safeHttpUrl(data.url) // untrusted: http(s) only
        if (!url) return
        setVideoUrl(url)
        setInput(url)
        setIsHost(false)
        setNotice("")
      } else if (data.type === "video-sync" && !isHost) {
        const v = videoRef.current
        const s: SyncData = data.syncData
        if (!v || !isDirect || !s) return
        const adjusted = s.currentTime + (s.isPlaying ? (Date.now() - s.timestamp) / 1000 : 0)
        if (Math.abs(v.currentTime - adjusted) > 1) v.currentTime = adjusted
        if (s.isPlaying && v.paused) v.play().catch(() => setNotice("Your browser blocked autoplay. Press Play to join in."))
        else if (!s.isPlaying && !v.paused) v.pause()
      }
    })
  })

  // the host's own player drives the sync
  useEffect(() => {
    const v = videoRef.current
    if (!v || !isDirect) return
    const onTime = () => {
      setTime(v.currentTime)
      if (isHost && Date.now() - lastSync.current > 5000) {
        lastSync.current = Date.now()
        pushSync()
      }
    }
    const onMeta = () => setDuration(v.duration)
    const onPlay = () => {
      setIsPlaying(true)
      if (isHost) pushSync()
    }
    const onPause = () => {
      setIsPlaying(false)
      if (isHost) pushSync()
    }
    v.addEventListener("timeupdate", onTime)
    v.addEventListener("loadedmetadata", onMeta)
    v.addEventListener("play", onPlay)
    v.addEventListener("pause", onPause)
    return () => {
      v.removeEventListener("timeupdate", onTime)
      v.removeEventListener("loadedmetadata", onMeta)
      v.removeEventListener("play", onPlay)
      v.removeEventListener("pause", onPause)
    }
  })

  const load = (e: React.FormEvent) => {
    e.preventDefault()
    const url = safeHttpUrl(input)
    const p = url ? detect(url) : null
    if (!url || !p) {
      setNotice("That address is not one we can play. Use a YouTube, Twitch, Vimeo or Dailymotion link, or a direct .mp4, .webm or .ogg file.")
      return
    }
    setNotice("")
    setVideoUrl(url)
    setIsHost(true)
    sendMessage({ type: "video-url", url, platformType: p.name.toLowerCase().replace(" ", ""), targetId: friend, senderId: me })
  }

  const toggle = () => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) v.play().catch(() => {})
    else v.pause()
  }
  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current
    if (!v || !duration) return
    v.currentTime = (Number(e.target.value) / 100) * duration
    if (isHost) pushSync()
  }

  return (
    <section aria-label="Watch" className="flex flex-col gap-4">
      <form onSubmit={load} className="kt-panel flex flex-wrap items-end gap-3 p-3">
        <label className="min-w-[240px] flex-1">
          <span className="mb-1 block text-sm font-semibold">Video link</span>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="https://..." className="kt-field" inputMode="url" />
        </label>
        <button type="submit" disabled={!input.trim()} className="kt-btn kt-btn-primary">
          Put it on the TV
        </button>
        <p className="basis-full text-sm text-mute">
          A direct video file (.mp4, .webm, .ogg) stays in step for both of you, and {isHost || !videoUrl ? "whoever starts it" : friend} holds the remote. YouTube, Twitch, Vimeo and Dailymotion links open for both of you, but each of you controls your own player.
          {!friendHere && ` ${friend} is not here right now, so they will not see it yet.`}
        </p>
      </form>

      {notice && (
        <p role="alert" className="kt-panel border-danger p-3 font-semibold text-danger" style={{ boxShadow: "4px 4px 0 #B3261E" }}>
          {notice}
        </p>
      )}

      {/* the TV */}
      <div className="rounded-[14px] border-[3px] border-ink bg-friend p-3 shadow-hard sm:p-4">
        <div className="relative overflow-hidden rounded-[8px] border-[3px] border-ink bg-ink">
          {!videoUrl && (
            <div className="flex aspect-video flex-col items-center justify-center gap-2 bg-surface px-4 text-center">
              <p className="font-display text-2xl font-semibold">The TV is off.</p>
              <p className="text-mute">Paste a link above and it turns on for both of you.</p>
            </div>
          )}
          {videoUrl && isDirect && <video ref={videoRef} src={videoUrl} playsInline className="aspect-video w-full bg-ink" crossOrigin="anonymous" />}
          {videoUrl && platform && !isDirect && (
            <iframe
              ref={iframeRef}
              title={`${platform.name} player`}
              src={embedUrl(videoUrl, platform.name)}
              className="aspect-video w-full bg-ink"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )}
        </div>
        {videoUrl && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-[6px] bg-surface p-2">
            {isDirect && (
              <>
                <button onClick={toggle} disabled={!isHost} className="kt-btn kt-btn-sm" aria-label={isPlaying ? "Pause" : "Play"}>
                  {isPlaying ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
                  {isPlaying ? "Pause" : "Play"}
                </button>
                <button
                  onClick={() => {
                    const v = videoRef.current
                    if (!v) return
                    v.muted = !v.muted
                    setMuted(v.muted)
                  }}
                  aria-pressed={muted}
                  className="kt-btn kt-btn-sm"
                >
                  {muted ? <VolumeX className="h-4 w-4" aria-hidden /> : <Volume2 className="h-4 w-4" aria-hidden />}
                  {muted ? "Unmute" : "Mute"}
                </button>
                <label className="flex min-w-[140px] flex-1 items-center gap-2 text-sm">
                  <span className="sr-only">Seek</span>
                  <input type="range" min={0} max={100} value={duration ? (time / duration) * 100 : 0} onChange={seek} disabled={!isHost} className="h-11 flex-1 accent-ink" />
                  <span className="tabular-nums text-mute">
                    {fmt(time)} / {fmt(duration || 0)}
                  </span>
                </label>
              </>
            )}
            <span className="text-sm text-mute">
              {isHost ? "You have the remote." : (
                <>
                  <span className="font-display font-semibold italic text-friend-ink">{friend}</span> has the remote.
                </>
              )}
            </span>
            <span className="ml-auto flex gap-2">
              <button
                onClick={() => (isDirect ? videoRef.current : iframeRef.current)?.requestFullscreen?.()}
                className="kt-btn kt-btn-sm"
              >
                <Maximize className="h-4 w-4" aria-hidden />
                Full screen
              </button>
              <a href={safeHttpUrl(videoUrl) ?? undefined} target="_blank" rel="noopener noreferrer" className="kt-btn kt-btn-sm">
                <ExternalLink className="h-4 w-4" aria-hidden />
                Open in a tab
              </a>
            </span>
          </div>
        )}
      </div>
    </section>
  )
}
