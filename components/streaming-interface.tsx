"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Video, Play, Pause, Volume2, VolumeX, Maximize, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useCall } from "@/components/call-provider"

interface StreamingInterfaceProps {
  peerId: string
  targetId: string
}

interface SyncData {
  currentTime: number
  isPlaying: boolean
  timestamp: number
}

export function StreamingInterface({ peerId, targetId }: StreamingInterfaceProps) {
  const [videoUrl, setVideoUrl] = useState("")
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isHost, setIsHost] = useState(false)
  const [ws, setWs] = useState<WebSocket | null>(null)
  const [lastSyncTime, setLastSyncTime] = useState(0)

  const videoRef = useRef<HTMLVideoElement>(null)
  const { toast } = useToast()
  const { callState } = useCall()

  const supportedPlatforms = [
    { name: "YouTube", domain: "youtube.com", supported: false },
    { name: "Netflix", domain: "netflix.com", supported: false },
    { name: "Twitch", domain: "twitch.tv", supported: false },
    { name: "Direct Video Link", domain: "direct", supported: true },
  ]

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

      if (data.type === "video-sync") {
        handleVideoSync(data.syncData)
      } else if (data.type === "video-url") {
        setVideoUrl(data.url)
        setIsHost(false)
        toast({
          title: "Video Shared",
          description: "Friend shared a video to watch together",
        })
      }
    }

    return () => {
      websocket.close()
    }
  }, [peerId])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime)

      // Sync with peer every 5 seconds if host
      if (isHost && Date.now() - lastSyncTime > 5000) {
        sendVideoSync()
        setLastSyncTime(Date.now())
      }
    }

    const handleLoadedMetadata = () => {
      setDuration(video.duration)
    }

    const handlePlay = () => {
      setIsPlaying(true)
      if (isHost) sendVideoSync()
    }

    const handlePause = () => {
      setIsPlaying(false)
      if (isHost) sendVideoSync()
    }

    video.addEventListener("timeupdate", handleTimeUpdate)
    video.addEventListener("loadedmetadata", handleLoadedMetadata)
    video.addEventListener("play", handlePlay)
    video.addEventListener("pause", handlePause)

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate)
      video.removeEventListener("loadedmetadata", handleLoadedMetadata)
      video.removeEventListener("play", handlePlay)
      video.removeEventListener("pause", handlePause)
    }
  }, [isHost, lastSyncTime])

  const loadVideo = () => {
    if (!videoUrl.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid video URL",
        variant: "destructive",
      })
      return
    }

    // Check if URL is supported
    const isDirectVideo = videoUrl.match(/\.(mp4|webm|ogg)$/i)
    if (!isDirectVideo) {
      toast({
        title: "Limited Support",
        description: "Only direct video links are fully supported. Streaming platforms have restrictions.",
        variant: "destructive",
      })
      return
    }

    setIsHost(true)

    // Share video URL with peer
    if (ws) {
      ws.send(
        JSON.stringify({
          type: "video-url",
          url: videoUrl,
          targetId,
          senderId: peerId,
        }),
      )
    }

    toast({
      title: "Video Loaded",
      description: "Video shared with your friend",
    })
  }

  const sendVideoSync = () => {
    const video = videoRef.current
    if (!video || !ws) return

    const syncData: SyncData = {
      currentTime: video.currentTime,
      isPlaying: !video.paused,
      timestamp: Date.now(),
    }

    ws.send(
      JSON.stringify({
        type: "video-sync",
        syncData,
        targetId,
        senderId: peerId,
      }),
    )
  }

  const handleVideoSync = (syncData: SyncData) => {
    const video = videoRef.current
    if (!video || isHost) return

    const latency = Date.now() - syncData.timestamp
    const adjustedTime = syncData.currentTime + latency / 1000

    // Sync time if difference is significant
    if (Math.abs(video.currentTime - adjustedTime) > 1) {
      video.currentTime = adjustedTime
    }

    // Sync play/pause state
    if (syncData.isPlaying && video.paused) {
      video.play()
    } else if (!syncData.isPlaying && !video.paused) {
      video.pause()
    }
  }

  const togglePlayPause = () => {
    const video = videoRef.current
    if (!video) return

    if (video.paused) {
      video.play()
    } else {
      video.pause()
    }
  }

  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return

    video.muted = !video.muted
    setIsMuted(video.muted)
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current
    if (!video) return

    const newTime = (Number.parseFloat(e.target.value) / 100) * duration
    video.currentTime = newTime

    if (isHost) {
      sendVideoSync()
    }
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  const toggleFullscreen = () => {
    const video = videoRef.current
    if (!video) return

    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      video.requestFullscreen()
    }
  }

  return (
    <>
      {callState !== "idle" && (
        <div className="mb-4 p-2 bg-blue-900/50 rounded-lg text-center text-sm">
          📞 Call {callState} - Watch together remains active during call
        </div>
      )}
      <div className="space-y-6">
        {/* Platform Support Notice */}
        <Card className="bg-yellow-900/20 border-yellow-600">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5" />
              <div>
                <h3 className="font-semibold text-yellow-200 mb-2">Platform Limitations</h3>
                <p className="text-sm text-yellow-100 mb-3">
                  Due to CORS policies and DRM protection, most streaming platforms cannot be synchronized. Only direct
                  video links (.mp4, .webm, .ogg) are fully supported.
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {supportedPlatforms.map((platform) => (
                    <div key={platform.name} className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${platform.supported ? "bg-green-500" : "bg-red-500"}`} />
                      <span className={platform.supported ? "text-green-200" : "text-red-200"}>{platform.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Video URL Input */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="w-5 h-5" />
              Watch Together
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="Enter direct video URL (.mp4, .webm, .ogg)"
                className="bg-gray-800 border-gray-700 text-white flex-1"
              />
              <Button onClick={loadVideo} className="bg-blue-600 hover:bg-blue-700">
                Load Video
              </Button>
            </div>

            {isHost && <p className="text-sm text-green-400">You are hosting this video session</p>}
          </CardContent>
        </Card>

        {/* Video Player */}
        {videoUrl && (
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-0">
              <div className="relative">
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className="w-full h-auto max-h-[60vh] bg-black"
                  crossOrigin="anonymous"
                />

                {/* Custom Controls */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                  <div className="space-y-2">
                    {/* Progress Bar */}
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={duration ? (currentTime / duration) * 100 : 0}
                      onChange={handleSeek}
                      className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                      disabled={!isHost}
                    />

                    {/* Control Buttons */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={togglePlayPause}
                          size="sm"
                          variant="ghost"
                          className="text-white hover:bg-white/20"
                          disabled={!isHost}
                        >
                          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </Button>

                        <Button onClick={toggleMute} size="sm" variant="ghost" className="text-white hover:bg-white/20">
                          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                        </Button>

                        <span className="text-sm text-white">
                          {formatTime(currentTime)} / {formatTime(duration)}
                        </span>
                      </div>

                      <Button
                        onClick={toggleFullscreen}
                        size="sm"
                        variant="ghost"
                        className="text-white hover:bg-white/20"
                      >
                        <Maximize className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
