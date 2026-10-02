"use client"

import type React from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { Check, Eraser, ImageIcon, LinkIcon, Upload, Video as VideoIcon } from "lucide-react"
import { useWebSocket } from "@/components/websocket-provider"
import { safeHttpUrl, safeMediaSrc } from "@/lib/safe-url"

// Drawing runs on a fixed-size canvas, so both people share the same coordinate space whatever their screen size.
// Points travel as 0..1 fractions (the existing "drawing-data" message, unchanged).
const W = 1200
const H = 800
const YOU = "#E4572E"
const FRIEND = "#2F7F79"

// On each screen "you" are tomato and your friend is teal. A stroke that arrives in the sender's own colour
// is shown in the sender's identity colour here, so every line is clearly one person's.
const mirrorColour = (c: string) => (c.toLowerCase() === YOU.toLowerCase() ? FRIEND : c.toLowerCase() === FRIEND.toLowerCase() ? YOU : c)

const INKS = [
  { value: YOU, name: "Your colour" },
  { value: "#231F1A", name: "Ink" },
  { value: "#E0A526", name: "Mustard" },
  { value: "#5E8C3A", name: "Green" },
]

interface MediaItem {
  id: string
  type: "image" | "video" | "link"
  url: string
  name: string
}

export function DrawActivity({ me, friend }: { me: string; friend: string }) {
  const [colour, setColour] = useState(YOU)
  const [size, setSize] = useState(10)
  const [items, setItems] = useState<MediaItem[]>([])
  const [selected, setSelected] = useState<MediaItem | null>(null)
  const [linkInput, setLinkInput] = useState("")
  const [notice, setNotice] = useState("")
  const [dims, setDims] = useState({ w: W, h: H })

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const remoteLast = useRef<{ x: number; y: number } | null>(null)

  const { sendMessage, registerMessageHandler } = useWebSocket()

  const ctx = () => canvasRef.current?.getContext("2d") ?? null

  const line = (x1: number, y1: number, x2: number, y2: number, c: string, s: number) => {
    const g = ctx()
    if (!g) return
    g.strokeStyle = c
    g.lineWidth = s
    g.lineCap = "round"
    g.lineJoin = "round"
    g.beginPath()
    g.moveTo(x1, y1)
    g.lineTo(x2, y2)
    g.stroke()
  }

  const wipe = () => {
    const c = canvasRef.current
    ctx()?.clearRect(0, 0, c?.width ?? W, c?.height ?? H)
  }

  // messages from the friend
  useEffect(() => {
    return registerMessageHandler((data: any) => {
      if (data.type === "drawing-data") {
        const c = canvasRef.current
        if (!c) return
        const x = data.x * c.width
        const y = data.y * c.height
        const col = mirrorColour(String(data.color))
        if (data.isStart || !remoteLast.current) {
          line(x, y, x + 0.1, y + 0.1, col, data.size)
        } else {
          line(remoteLast.current.x, remoteLast.current.y, x, y, col, data.size)
        }
        remoteLast.current = { x, y }
      } else if (data.type === "drawing-clear") {
        wipe() // a remote clear must NOT be echoed back, or the two sides would clear each other forever
        remoteLast.current = null
      } else if (data.type === "media-share") {
        // untrusted: only known kinds, and only http(s) (or an uploaded picture/video data URL for image/video)
        const type = data.mediaType
        if (type !== "image" && type !== "video" && type !== "link") return
        const url = type === "link" ? safeHttpUrl(data.url) : safeMediaSrc(data.url)
        if (!url) return
        setItems((prev) => [...prev, { id: `${Date.now()}${Math.random()}`, type, url, name: String(data.name ?? "").slice(0, 200) }])
      }
    })
  })

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const fx = (e.clientX - r.left) / r.width
    const fy = (e.clientY - r.top) / r.height
    return { fx, fy, x: fx * e.currentTarget.width, y: fy * e.currentTarget.height }
  }

  const send = useCallback(
    (fx: number, fy: number, isStart: boolean) =>
      sendMessage({ type: "drawing-data", x: fx, y: fy, isStart, color: colour, size, targetId: friend, senderId: me, timestamp: Date.now() }),
    [sendMessage, colour, size, friend, me],
  )

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = point(e)
    drawing.current = true
    last.current = { x: p.x, y: p.y }
    line(p.x, p.y, p.x + 0.1, p.y + 0.1, colour, size)
    send(p.fx, p.fy, true)
  }
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current) return
    const p = point(e)
    line(last.current.x, last.current.y, p.x, p.y, colour, size)
    send(p.fx, p.fy, false)
    last.current = { x: p.x, y: p.y }
  }
  const up = () => {
    drawing.current = false
    last.current = null
  }

  const clearForBoth = () => {
    wipe()
    sendMessage({ type: "drawing-clear", targetId: friend, senderId: me })
  }

  const share = (m: MediaItem) => sendMessage({ type: "media-share", mediaType: m.type, url: m.url, name: m.name, targetId: friend, senderId: me })

  const onFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files ?? []).forEach((file) => {
      const reader = new FileReader()
      reader.onload = () => {
        const m: MediaItem = { id: `${Date.now()}${Math.random()}`, type: file.type.startsWith("image/") ? "image" : "video", url: String(reader.result), name: file.name }
        setItems((prev) => [...prev, m])
        share(m)
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ""
  }

  const addLink = () => {
    try {
      const href = safeHttpUrl(linkInput)
      if (!href) throw new Error("not an http(s) link")
      const m: MediaItem = { id: `${Date.now()}${Math.random()}`, type: "link", url: href, name: new URL(href).hostname }
      setItems((prev) => [...prev, m])
      share(m)
      setLinkInput("")
      setNotice("")
    } catch {
      setNotice("That does not look like a link. Paste the whole address, starting with https://")
    }
  }

  // choosing a picture swaps the canvas to the picture's shape (a new size clears the lines)
  const pick = (m: MediaItem | null) => {
    setSelected(m)
    remoteLast.current = null
    if (m?.type === "image") {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, W / img.naturalWidth)
        setDims({ w: Math.round(img.naturalWidth * scale), h: Math.round(img.naturalHeight * scale) })
      }
      img.src = m.url
    } else {
      setDims({ w: W, h: H })
    }
  }

  const showCanvas = !selected || selected.type === "image"

  return (
    <section aria-label="Draw" className="flex flex-col gap-3">
      <div className="kt-panel flex flex-wrap items-center gap-x-4 gap-y-2 p-3" role="group" aria-label="Drawing tools">
        <fieldset className="flex items-center gap-2">
          <legend className="sr-only">Ink colour</legend>
          {INKS.map((c) => (
            <label key={c.value} className="relative cursor-pointer">
              <input type="radio" name="ink" value={c.value} checked={colour === c.value} onChange={() => setColour(c.value)} className="peer sr-only" />
              <span
                className="block h-11 w-11 rounded-[6px] border-2 border-ink peer-checked:shadow-hard-sm peer-checked:ring-2 peer-checked:ring-ink peer-checked:ring-offset-2 peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-4 peer-focus-visible:outline-ink"
                style={{ background: c.value }}
              />
              <span className="sr-only">{c.name}</span>
              {colour === c.value && (
                <span aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-ink bg-surface">
                    <Check className="h-3 w-3" />
                  </span>
                </span>
              )}
            </label>
          ))}
        </fieldset>
        <label className="flex items-center gap-2 text-sm font-semibold">
          Pen width
          <input type="range" min={3} max={48} value={size} onChange={(e) => setSize(Number(e.target.value))} className="h-11 w-28 accent-ink" />
          <span className="w-8 tabular-nums text-mute">{size}</span>
        </label>
        <button onClick={clearForBoth} className="kt-btn kt-btn-sm ml-auto" title="Wipes the paper for both of you">
          <Eraser className="h-4 w-4" aria-hidden />
          Clear for both
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-mute">
          <span className="font-semibold text-you-ink">you</span> draw in tomato, <span className="font-display font-semibold italic text-friend-ink">{friend}</span> draws in teal.
        </span>
      </div>

      {showCanvas ? (
        <div className="kt-panel kt-dots relative mx-auto w-full overflow-hidden" style={{ aspectRatio: `${dims.w} / ${dims.h}`, maxHeight: "68vh", maxWidth: `calc(68vh * ${dims.w / dims.h})` }}>
          {selected?.type === "image" && <img src={selected.url} alt={selected.name} className="absolute inset-0 h-full w-full select-none object-fill" draggable={false} />}
          <canvas
            key={`${dims.w}x${dims.h}`}
            ref={canvasRef}
            width={dims.w}
            height={dims.h}
            aria-label="Shared drawing paper. Draw with a pointer or finger; your friend sees it as you draw."
            role="img"
            className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            onLostPointerCapture={up}
          />
        </div>
      ) : selected?.type === "video" ? (
        <video src={selected.url} controls className="kt-panel mx-auto max-h-[68vh] w-full bg-ink" />
      ) : (
        <div className="kt-panel flex flex-col items-start gap-3 p-5">
          <p className="font-display text-xl font-semibold">{selected?.name}</p>
          <a href={safeHttpUrl(selected?.url) ?? undefined} target="_blank" rel="noopener noreferrer" className="kt-btn">
            Open the link in a new tab
          </a>
        </div>
      )}

      <details className="kt-panel p-3">
        <summary className="min-h-[44px] cursor-pointer py-2 font-semibold">Pictures and links to share (draw on top of a picture)</summary>
        <div className="mt-2 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => fileRef.current?.click()} className="kt-btn kt-btn-sm">
              <Upload className="h-4 w-4" aria-hidden />
              Upload a picture or video
            </button>
            <input ref={fileRef} type="file" multiple accept="image/*,video/*" onChange={onFiles} className="sr-only" tabIndex={-1} aria-label="Choose files to share" />
            <label className="flex flex-1 items-center gap-2" style={{ minWidth: 240 }}>
              <span className="sr-only">Link to share</span>
              <input value={linkInput} onChange={(e) => setLinkInput(e.target.value)} placeholder="Paste a link to share" className="kt-field" />
              <button onClick={addLink} disabled={!linkInput.trim()} className="kt-btn kt-btn-sm shrink-0">
                <LinkIcon className="h-4 w-4" aria-hidden />
                Share link
              </button>
            </label>
          </div>
          {notice && (
            <p role="alert" className="text-sm font-semibold text-danger">
              {notice}
            </p>
          )}
          <ul className="flex flex-wrap gap-2">
            <li>
              <button onClick={() => pick(null)} aria-pressed={!selected} className="kt-btn kt-btn-sm">
                Blank paper
              </button>
            </li>
            {items.map((m) => (
              <li key={m.id}>
                <button onClick={() => pick(m)} aria-pressed={selected?.id === m.id} className="kt-btn kt-btn-sm max-w-[220px]">
                  {m.type === "image" ? <ImageIcon className="h-4 w-4 shrink-0" aria-hidden /> : m.type === "video" ? <VideoIcon className="h-4 w-4 shrink-0" aria-hidden /> : <LinkIcon className="h-4 w-4 shrink-0" aria-hidden />}
                  <span className="truncate">{m.name}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="text-sm text-mute">Pictures you pick here are shared with {friend}, but each of you chooses what to draw on.</p>
        </div>
      </details>
    </section>
  )
}
