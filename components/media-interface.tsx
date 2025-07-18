"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Upload, ImageIcon, Video, LinkIcon, Eraser, Share2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useCall } from "@/components/call-provider"

interface MediaInterfaceProps {
  peerId: string
  targetId: string
}

interface MediaItem {
  id: string
  type: "image" | "video" | "link"
  url: string
  name: string
  timestamp: Date
}

export function MediaInterface({ peerId, targetId }: MediaInterfaceProps) {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null)
  const [linkInput, setLinkInput] = useState("")
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawingColor, setDrawingColor] = useState("#ff0000")
  const [brushSize, setBrushSize] = useState(3)
  const [ws, setWs] = useState<WebSocket | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const { toast } = useToast()
  const { callState } = useCall()

  useEffect(() => {
    // Initialize WebSocket connection
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "wss://socialspace-bakend.onrender.com"
    const websocket = new WebSocket(backendUrl)

    websocket.onopen = () => {
      websocket.send(JSON.stringify({ type: "register", id: peerId }))
      setWs(websocket)
    }

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data)

      if (data.type === "media-share") {
        const newMedia: MediaItem = {
          id: Date.now().toString(),
          type: data.mediaType,
          url: data.url,
          name: data.name,
          timestamp: new Date(),
        }
        setMediaItems((prev) => [...prev, newMedia])

        toast({
          title: "Media Received",
          description: `${data.name} shared by friend`,
        })
      } else if (data.type === "drawing-data") {
        // Handle real-time drawing data
        drawOnCanvas(data.x, data.y, data.isDrawing, data.color, data.size)
      }
    }

    return () => {
      websocket.close()
    }
  }, [peerId])

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    Array.from(files).forEach((file) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        const mediaType = file.type.startsWith("image/") ? "image" : "video"

        const newMedia: MediaItem = {
          id: Date.now().toString() + Math.random(),
          type: mediaType,
          url: result,
          name: file.name,
          timestamp: new Date(),
        }

        setMediaItems((prev) => [...prev, newMedia])
        shareMedia(newMedia)
      }
      reader.readAsDataURL(file)
    })
  }

  const handleLinkAdd = () => {
    if (!linkInput.trim()) return

    // Extract platform and create media item
    let mediaType: "image" | "video" | "link" = "link"
    if (linkInput.includes("instagram.com") || linkInput.includes("facebook.com")) {
      mediaType = "video" // Assume social media links are videos
    }

    const newMedia: MediaItem = {
      id: Date.now().toString(),
      type: mediaType,
      url: linkInput,
      name: `Link: ${new URL(linkInput).hostname}`,
      timestamp: new Date(),
    }

    setMediaItems((prev) => [...prev, newMedia])
    shareMedia(newMedia)
    setLinkInput("")
  }

  const shareMedia = (media: MediaItem) => {
    if (ws) {
      ws.send(
        JSON.stringify({
          type: "media-share",
          mediaType: media.type,
          url: media.url,
          name: media.name,
          targetId,
          senderId: peerId,
        }),
      )
    }
  }

  const selectMedia = (media: MediaItem) => {
    setSelectedMedia(media)
    // Initialize canvas for drawing if it's an image
    if (media.type === "image") {
      setTimeout(() => {
        initializeCanvas()
      }, 100)
    }
  }

  const initializeCanvas = () => {
    const canvas = canvasRef.current
    const image = imageRef.current

    if (!canvas || !image) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set canvas size to match image
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true)
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = (e.clientX - rect.left) * (canvasRef.current!.width / rect.width)
    const y = (e.clientY - rect.top) * (canvasRef.current!.height / rect.height)

    drawOnCanvas(x, y, true, drawingColor, brushSize)
    sendDrawingData(x, y, true)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return

    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = (e.clientX - rect.left) * (canvasRef.current!.width / rect.width)
    const y = (e.clientY - rect.top) * (canvasRef.current!.height / rect.height)

    drawOnCanvas(x, y, false, drawingColor, brushSize)
    sendDrawingData(x, y, false)
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const drawOnCanvas = (x: number, y: number, isStart: boolean, color: string, size: number) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!ctx) return

    ctx.strokeStyle = color
    ctx.lineWidth = size
    ctx.lineCap = "round"

    if (isStart) {
      ctx.beginPath()
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
      ctx.stroke()
    }
  }

  const sendDrawingData = (x: number, y: number, isStart: boolean) => {
    if (ws) {
      ws.send(
        JSON.stringify({
          type: "drawing-data",
          x,
          y,
          isDrawing: !isStart,
          color: drawingColor,
          size: brushSize,
          targetId,
          senderId: peerId,
        }),
      )
    }
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  const colors = ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff", "#000000", "#ffffff"]

  return (
    <>
      {callState !== "idle" && (
        <div className="mb-4 p-2 bg-blue-900/50 rounded-lg text-center text-sm">
          📞 Call {callState} - Media sharing remains active during call
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Media Library */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Media Library
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Button onClick={() => fileInputRef.current?.click()} className="w-full bg-blue-600 hover:bg-blue-700">
                <Upload className="w-4 h-4 mr-2" />
                Upload Files
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            <div className="space-y-2">
              <Input
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                placeholder="Paste Instagram/Facebook link..."
                className="bg-gray-800 border-gray-700 text-white"
              />
              <Button
                onClick={handleLinkAdd}
                disabled={!linkInput.trim()}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                <LinkIcon className="w-4 h-4 mr-2" />
                Add Link
              </Button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {mediaItems.map((media) => (
                <div
                  key={media.id}
                  onClick={() => selectMedia(media)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedMedia?.id === media.id ? "bg-blue-600" : "bg-gray-800 hover:bg-gray-700"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {media.type === "image" && <ImageIcon className="w-4 h-4" />}
                    {media.type === "video" && <Video className="w-4 h-4" />}
                    {media.type === "link" && <LinkIcon className="w-4 h-4" />}
                    <span className="text-sm truncate">{media.name}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{media.timestamp.toLocaleTimeString()}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Media Viewer */}
        <Card className="lg:col-span-2 bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Media Viewer</span>
              {selectedMedia?.type === "image" && (
                <div className="flex items-center gap-2">
                  <Button onClick={clearCanvas} size="sm" variant="outline">
                    <Eraser className="w-4 h-4" />
                  </Button>
                  <div className="flex gap-1">
                    {colors.map((color) => (
                      <button
                        key={color}
                        onClick={() => setDrawingColor(color)}
                        className={`w-6 h-6 rounded-full border-2 ${
                          drawingColor === color ? "border-white" : "border-gray-600"
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <Input
                    type="range"
                    min="1"
                    max="10"
                    value={brushSize}
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                    className="w-20"
                  />
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedMedia ? (
              <div className="flex items-center justify-center h-96 text-gray-400">Select a media item to view</div>
            ) : (
              <div className="relative">
                {selectedMedia.type === "image" && (
                  <div className="relative">
                    <img
                      ref={imageRef}
                      src={selectedMedia.url || "/placeholder.svg"}
                      alt={selectedMedia.name}
                      className="max-w-full h-auto rounded-lg"
                      onLoad={initializeCanvas}
                    />
                    <canvas
                      ref={canvasRef}
                      className="absolute top-0 left-0 cursor-crosshair"
                      style={{
                        width: "100%",
                        height: "auto",
                        maxWidth: "100%",
                      }}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                    />
                  </div>
                )}

                {selectedMedia.type === "video" && (
                  <video ref={videoRef} src={selectedMedia.url} controls className="max-w-full h-auto rounded-lg" />
                )}

                {selectedMedia.type === "link" && (
                  <div className="p-6 text-center">
                    <LinkIcon className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-300 mb-4">{selectedMedia.name}</p>
                    <Button
                      onClick={() => window.open(selectedMedia.url, "_blank")}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Share2 className="w-4 h-4 mr-2" />
                      Open Link
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
