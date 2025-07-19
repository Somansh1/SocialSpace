"use client"

import type React from "react"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Upload, ImageIcon, Video, LinkIcon, Eraser, Share2, Minus, Plus } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useCall } from "@/components/call-provider"
import { useWebSocket } from "@/components/websocket-provider"

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

interface DrawingPoint {
  x: number
  y: number
  color: string
  size: number
  isStart: boolean
  timestamp: number
}

export function MediaInterface({ peerId, targetId }: MediaInterfaceProps) {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null)
  const [linkInput, setLinkInput] = useState("")
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawingColor, setDrawingColor] = useState("#ff0000")
  const [brushSize, setBrushSize] = useState(3)
  const [drawingPoints, setDrawingPoints] = useState<DrawingPoint[]>([])
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })

  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)

  const { toast } = useToast()
  const { callState } = useCall()
  const { sendMessage, connectionState, registerMessageHandler } = useWebSocket()

  // Register message handler for media messages
  useEffect(() => {
    const unregister = registerMessageHandler((data: any) => {
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
        handleRemoteDrawing(data)
      } else if (data.type === "drawing-clear") {
        // Handle canvas clear
        clearCanvas()
      }
    })

    return unregister
  }, [registerMessageHandler])

  const handleRemoteDrawing = useCallback((data: any) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!ctx || !canvas) return

    // Convert relative coordinates to canvas coordinates
    const x = data.x * canvas.width
    const y = data.y * canvas.height

    ctx.strokeStyle = data.color
    ctx.lineWidth = data.size
    ctx.lineCap = "round"
    ctx.lineJoin = "round"

    if (data.isStart) {
      ctx.beginPath()
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
      ctx.stroke()
    }
  }, [])

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
    sendMessage({
      type: "media-share",
      mediaType: media.type,
      url: media.url,
      name: media.name,
      targetId,
      senderId: peerId,
    })
  }

  const selectMedia = (media: MediaItem) => {
    setSelectedMedia(media)
    setDrawingPoints([])
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
    const container = containerRef.current

    if (!canvas || !image || !container) return

    // Wait for image to load
    const setupCanvas = () => {
      const containerRect = container.getBoundingClientRect()
      const imageRect = image.getBoundingClientRect()

      // Set canvas size to match displayed image size
      canvas.width = imageRect.width
      canvas.height = imageRect.height

      setCanvasSize({ width: imageRect.width, height: imageRect.height })

      // Position canvas over image
      canvas.style.position = "absolute"
      canvas.style.left = "0"
      canvas.style.top = "0"
      canvas.style.width = `${imageRect.width}px`
      canvas.style.height = `${imageRect.height}px`

      // Clear canvas
      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        // Set up drawing context
        ctx.lineCap = "round"
        ctx.lineJoin = "round"
      }
    }

    if (image.complete) {
      setupCanvas()
    } else {
      image.onload = setupCanvas
    }
  }

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    let clientX: number, clientY: number

    if ("touches" in e) {
      // Touch event
      if (e.touches.length === 0) return null
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      // Mouse event
      clientX = e.clientX
      clientY = e.clientY
    }

    const x = clientX - rect.left
    const y = clientY - rect.top

    // Convert to canvas coordinates
    const canvasX = (x / rect.width) * canvas.width
    const canvasY = (y / rect.height) * canvas.height

    return { x: canvasX, y: canvasY, relativeX: x / rect.width, relativeY: y / rect.height }
  }

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const coords = getCanvasCoordinates(e)
    if (!coords) return

    setIsDrawing(true)
    lastPointRef.current = { x: coords.x, y: coords.y }

    drawOnCanvas(coords.x, coords.y, true, drawingColor, brushSize)
    sendDrawingData(coords.relativeX, coords.relativeY, true)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    e.preventDefault()

    const coords = getCanvasCoordinates(e)
    if (!coords || !lastPointRef.current) return

    // Smooth line drawing
    drawSmoothLine(lastPointRef.current.x, lastPointRef.current.y, coords.x, coords.y)
    sendDrawingData(coords.relativeX, coords.relativeY, false)

    lastPointRef.current = { x: coords.x, y: coords.y }
  }

  const stopDrawing = () => {
    setIsDrawing(false)
    lastPointRef.current = null
  }

  const drawSmoothLine = (x1: number, y1: number, x2: number, y2: number) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!ctx) return

    ctx.strokeStyle = drawingColor
    ctx.lineWidth = brushSize
    ctx.lineCap = "round"
    ctx.lineJoin = "round"

    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }

  const drawOnCanvas = (x: number, y: number, isStart: boolean, color: string, size: number) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!ctx) return

    ctx.strokeStyle = color
    ctx.lineWidth = size
    ctx.lineCap = "round"
    ctx.lineJoin = "round"

    if (isStart) {
      ctx.beginPath()
      ctx.moveTo(x, y)
      // Draw a small dot for single clicks
      ctx.lineTo(x + 0.1, y + 0.1)
      ctx.stroke()
    }
  }

  const sendDrawingData = useCallback(
    (relativeX: number, relativeY: number, isStart: boolean) => {
      sendMessage({
        type: "drawing-data",
        x: relativeX,
        y: relativeY,
        isStart,
        color: drawingColor,
        size: brushSize,
        targetId,
        senderId: peerId,
        timestamp: Date.now(),
      })
    },
    [sendMessage, drawingColor, brushSize, targetId, peerId],
  )

  const clearCanvas = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setDrawingPoints([])

    // Send clear command to peer
    sendMessage({
      type: "drawing-clear",
      targetId,
      senderId: peerId,
    })
  }

  const colors = [
    "#ff0000",
    "#00ff00",
    "#0000ff",
    "#ffff00",
    "#ff00ff",
    "#00ffff",
    "#000000",
    "#ffffff",
    "#ff8800",
    "#8800ff",
    "#00ff88",
    "#ff0088",
  ]

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
                  <Button
                    onClick={clearCanvas}
                    size="sm"
                    variant="outline"
                    className="flex items-center gap-1 bg-transparent"
                  >
                    <Eraser className="w-4 h-4" />
                    Clear
                  </Button>

                  {/* Brush Size */}
                  <div className="flex items-center gap-1">
                    <Button
                      onClick={() => setBrushSize(Math.max(1, brushSize - 1))}
                      size="sm"
                      variant="outline"
                      className="h-8 w-8 p-0"
                    >
                      <Minus className="w-3 h-3" />
                    </Button>
                    <span className="text-xs text-gray-400 min-w-[2rem] text-center">{brushSize}px</span>
                    <Button
                      onClick={() => setBrushSize(Math.min(20, brushSize + 1))}
                      size="sm"
                      variant="outline"
                      className="h-8 w-8 p-0"
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>

                  {/* Color Palette */}
                  <div className="flex gap-1">
                    {colors.map((color) => (
                      <button
                        key={color}
                        onClick={() => setDrawingColor(color)}
                        className={`w-6 h-6 rounded-full border-2 transition-all ${
                          drawingColor === color ? "border-white scale-110" : "border-gray-600 hover:border-gray-400"
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedMedia ? (
              <div className="flex items-center justify-center h-96 text-gray-400">Select a media item to view</div>
            ) : (
              <div ref={containerRef} className="relative">
                {selectedMedia.type === "image" && (
                  <div className="relative inline-block">
                    <img
                      ref={imageRef}
                      src={selectedMedia.url || "/placeholder.svg"}
                      alt={selectedMedia.name}
                      className="max-w-full h-auto rounded-lg"
                      onLoad={initializeCanvas}
                      style={{ display: "block" }}
                    />
                    <canvas
                      ref={canvasRef}
                      className="absolute top-0 left-0 cursor-crosshair touch-none"
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      style={{
                        pointerEvents: "auto",
                      }}
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
