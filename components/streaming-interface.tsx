"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Video, Play, Pause, Volume2, VolumeX, Maximize, ExternalLink } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useCall } from "@/components/call-provider"
import { useWebSocket } from "@/components/websocket-provider"

interface StreamingInterfaceProps {
  peerId: string
  targetId: string
}

interface SyncData {
  currentTime: number
  isPlaying: boolean
  timestamp: number
  url?: string
}

export function StreamingInterface({ peerId, targetId }: StreamingInterfaceProps) {
  const [videoUrl, setVideoUrl] = useState("")
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isHost, setIsHost] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState(0)
  const [platformType, setPlatformType] = useState<string>("")

  const videoRef = useRef<HTMLVideoElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const { toast } = useToast()
  const { callState } = useCall()
  const { sendMessage, connectionState, registerMessageHandler } = useWebSocket()

  const supportedPlatforms = [
    {
      name: "YouTube",
      domain: "youtube.com",
      supported: true,
      embedPattern: /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
    },
    {
      name: "Twitch",
      domain: "twitch.tv",
      supported: true,
      embedPattern: /twitch\.tv\/videos\/(\d+)|twitch\.tv\/(\w+)/,
    },
    { name: "Vimeo", domain: "vimeo.com", supported: true, embedPattern: /vimeo\.com\/(\d+)/ },
    {
      name: "Dailymotion",
      domain: "dailymotion.com",
      supported: true,
      embedPattern: /dailymotion\.com\/video\/([^_]+)/,
    },
    { name: "Direct Video", domain: "direct", supported: true, embedPattern: /\.(mp4|webm|ogg)$/i },
  ]

  // Register message handler for streaming messages
  useEffect(() => {
    const unregister = registerMessageHandler((data: any) => {
      console.log("Streaming received message:", data.type, data)

      if (data.type === "video-sync") {
        handleVideoSync(data.syncData)
      } else if (data.type === "video-url") {
        console.log("Received video URL:", data.url, "Platform:", data.platformType)
        setVideoUrl(data.url)
        setPlatformType(data.platformType || "direct")
        setIsHost(false)
        toast({
          title: "Video Shared",
          description: `Friend shared a ${data.platformType || "video"} to watch together`,
        })
      }
    })

    return unregister
  }, [registerMessageHandler])

  useEffect(() => {
    const video = videoRef.current
    if (!video || platformType !== "direct") return

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
  }, [isHost, lastSyncTime, platformType])

  const detectPlatform = (url: string) => {
    for (const platform of supportedPlatforms) {
      if (platform.embedPattern.test(url)) {
        return platform
      }
    }
    return null
  }

  const getEmbedUrl = (url: string, platform: any) => {
    const match = url.match(platform.embedPattern)
    if (!match) return url

    switch (platform.name) {
      case "YouTube":
        const videoId = match[1]
        return `https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${window.location.origin}`

      case "Twitch":
        if (match[1]) {
          // Video ID
          return `https://player.twitch.tv/?video=${match[1]}&parent=${window.location.hostname}`
        } else if (match[2]) {
          // Channel name
          return `https://player.twitch.tv/?channel=${match[2]}&parent=${window.location.hostname}`
        }
        break

      case "Vimeo":
        return `https://player.vimeo.com/video/${match[1]}`

      case "Dailymotion":
        return `https://www.dailymotion.com/embed/video/${match[1]}`

      default:
        return url
    }
    return url
  }

  const loadVideo = () => {
    if (!videoUrl.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid video URL",
        variant: "destructive",
      })
      return
    }

    const platform = detectPlatform(videoUrl)
    if (!platform) {
      toast({
        title: "Unsupported Platform",
        description: "This video platform is not supported for synchronization",
        variant: "destructive",
      })
      return
    }

    console.log("Loading video:", videoUrl, "Platform:", platform.name)
    setIsHost(true)
    setPlatformType(platform.name.toLowerCase().replace(" ", ""))

    // Share video URL with peer
    sendMessage({
      type: "video-url",
      url: videoUrl,
      platformType: platform.name.toLowerCase().replace(" ", ""),
      targetId,
      senderId: peerId,
    })

    toast({
      title: "Video Loaded",
      description: `${platform.name} video shared with your friend`,
    })
  }

  const sendVideoSync = () => {
    const video = videoRef.current
    if (!video || platformType !== "direct") return

    const syncData: SyncData = {
      currentTime: video.currentTime,
      isPlaying: !video.paused,
      timestamp: Date.now(),
      url: videoUrl,
    }

    sendMessage({
      type: "video-sync",
      syncData,
      targetId,
      senderId: peerId,
    })
  }

  const handleVideoSync = (syncData: SyncData) => {
    const video = videoRef.current
    if (!video || isHost || platformType !== "direct") return

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
    if (!video || platformType !== "direct") return

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
    if (!video || platformType !== "direct") return

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
    const element = platformType === "direct" ? videoRef.current : iframeRef.current
    if (!element) return

    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      element.requestFullscreen()
    }
  }

  const openInNewTab = () => {
    if (videoUrl) {
      window.open(videoUrl, "_blank")
    }
  }

  const renderPlayer = () => {
    if (!videoUrl) return null

    console.log("Rendering player for:", videoUrl, "Platform type:", platformType)

    const platform = detectPlatform(videoUrl)
    if (!platform) {
      return (
        <div className="text-center p-8 text-gray-400">
          <p>Unsupported video format</p>
          <p className="text-sm mt-2">URL: {videoUrl}</p>
        </div>
      )
    }

    if (platform.name === "Direct Video" || platformType === "direct") {
      return (
        <div className="relative">
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-auto max-h-[60vh] bg-black rounded-lg"
            crossOrigin="anonymous"
          />

          {/* Custom Controls for Direct Video */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 rounded-b-lg">
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

                <div className="flex items-center gap-2">
                  <Button onClick={openInNewTab} size="sm" variant="ghost" className="text-white hover:bg-white/20">
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                  <Button onClick={toggleFullscreen} size="sm" variant="ghost" className="text-white hover:bg-white/20">
                    <Maximize className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    } else {
      // Embedded player for other platforms
      const embedUrl = getEmbedUrl(videoUrl, platform)
      console.log("Embed URL:", embedUrl)

      return (
        <div className="relative">
          <iframe
            ref={iframeRef}
            src={embedUrl}
            className="w-full h-[60vh] bg-black rounded-lg"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />

          {/* External link button for embedded players */}
          <div className="absolute top-2 right-2">
            <Button onClick={openInNewTab} size="sm" variant="secondary" className="opacity-80 hover:opacity-100">
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>

          {/* Debug info */}
          <div className="absolute bottom-2 left-2 text-xs bg-black/70 px-2 py-1 rounded text-white">
            Platform: {platform.name} | Host: {isHost ? "Yes" : "No"}
          </div>
        </div>
      )
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
        {/* Platform Support Info */}
        <Card className="bg-blue-900/20 border-blue-600">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Video className="w-5 h-5 text-blue-500 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-200 mb-2">Supported Platforms</h3>
                <p className="text-sm text-blue-100 mb-3">
                  Now supporting multiple streaming platforms with synchronized playback!
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
                placeholder="Enter YouTube, Twitch, Vimeo, Dailymotion, or direct video URL"
                className="bg-gray-800 border-gray-700 text-white flex-1"
              />
              <Button onClick={loadVideo} className="bg-blue-600 hover:bg-blue-700">
                Load Video
              </Button>
            </div>

            {isHost && <p className="text-sm text-green-400">You are hosting this video session</p>}
            {!isHost && videoUrl && <p className="text-sm text-blue-400">Watching video shared by friend</p>}
          </CardContent>
        </Card>

        {/* Video Player */}
        {videoUrl && (
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-0">{renderPlayer()}</CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
