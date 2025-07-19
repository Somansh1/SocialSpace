"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, Video, VideoOff, Move, Wifi } from "lucide-react"
import { useCall } from "@/components/call-provider"

export function FloatingVideoInterface() {
  const {
    callState,
    isMuted,
    isVideoMuted,
    isDeafened,
    isTranscribing,
    transcriptionLanguage,
    transcriptionConfidence,
    translationService,
    localStream,
    remoteStream,
    connectionState,
    startCall,
    endCall,
    acceptCall,
    rejectCall,
    toggleMute,
    toggleVideo,
    toggleDeafen,
    toggleTranscription,
    setTranscriptionLanguage,
    localVideoRef,
    remoteVideoRef,
  } = useCall()

  const [position, setPosition] = useState({ x: 20, y: window.innerHeight - 180 })
  const [size, setSize] = useState({ width: 280, height: 160 })
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  const containerRef = useRef<HTMLDivElement>(null)
  const ringtoneRef = useRef<HTMLAudioElement>(null)
  const pickupSoundRef = useRef<HTMLAudioElement>(null)
  const aspectRatio = 16 / 9 // 16:9 aspect ratio for more compact design

  // Initialize call sounds
  useEffect(() => {
    // Ringtone - classic phone ring
    ringtoneRef.current = new Audio()
    ringtoneRef.current.src =
      "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT"
    ringtoneRef.current.loop = true
    ringtoneRef.current.volume = 0.7

    // Call pickup sound - short beep
    pickupSoundRef.current = new Audio()
    pickupSoundRef.current.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA="
    pickupSoundRef.current.volume = 0.5

    return () => {
      if (ringtoneRef.current) {
        ringtoneRef.current.pause()
      }
      if (pickupSoundRef.current) {
        pickupSoundRef.current.pause()
      }
    }
  }, [])

  // Handle call state changes for sounds
  useEffect(() => {
    if (callState === "ringing" || callState === "calling") {
      // Start ringtone
      if (ringtoneRef.current) {
        ringtoneRef.current.currentTime = 0
        ringtoneRef.current.play().catch(console.error)
      }
    } else if (callState === "active") {
      // Stop ringtone and play pickup sound
      if (ringtoneRef.current) {
        ringtoneRef.current.pause()
      }
      if (pickupSoundRef.current) {
        pickupSoundRef.current.currentTime = 0
        pickupSoundRef.current.play().catch(console.error)
      }
    } else {
      // Stop all sounds
      if (ringtoneRef.current) {
        ringtoneRef.current.pause()
      }
    }
  }, [callState])

  useEffect(() => {
    // Update position when window resizes
    const handleResize = () => {
      setPosition((prev) => ({
        x: Math.min(prev.x, window.innerWidth - size.width - 20),
        y: Math.min(prev.y, window.innerHeight - size.height - 20),
      }))
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [size])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains("drag-handle")) {
      e.preventDefault()
      setIsDragging(true)
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      })
    }
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains("drag-handle")) {
      e.preventDefault()
      const touch = e.touches[0]
      setIsDragging(true)
      setDragStart({
        x: touch.clientX - position.x,
        y: touch.clientY - position.y,
      })
    }
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      const newX = Math.max(0, Math.min(e.clientX - dragStart.x, window.innerWidth - size.width))
      const newY = Math.max(0, Math.min(e.clientY - dragStart.y, window.innerHeight - size.height))
      setPosition({ x: newX, y: newY })
    }
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (isDragging) {
      e.preventDefault()
      const touch = e.touches[0]
      const newX = Math.max(0, Math.min(touch.clientX - dragStart.x, window.innerWidth - size.width))
      const newY = Math.max(0, Math.min(touch.clientY - dragStart.y, window.innerHeight - size.height))
      setPosition({ x: newX, y: newY })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    setIsResizing(false)
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
    setIsResizing(false)
  }

  const handleResize = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)

    const startX = e.clientX
    const startY = e.clientY
    const startWidth = size.width
    const startHeight = size.height

    const handleMouseMoveResize = (e: MouseEvent) => {
      const deltaX = e.clientX - startX
      const deltaY = e.clientY - startY

      // Calculate new width based on the larger delta to maintain aspect ratio
      const newWidth = Math.max(240, Math.min(500, startWidth + deltaX))
      const newHeight = newWidth / aspectRatio

      // Ensure it doesn't go off screen
      const maxWidth = window.innerWidth - position.x - 20
      const maxHeight = window.innerHeight - position.y - 20

      const finalWidth = Math.min(newWidth, maxWidth)
      const finalHeight = Math.min(newHeight, maxHeight, finalWidth / aspectRatio)

      setSize({ width: finalWidth, height: finalHeight })
    }

    const handleMouseUpResize = () => {
      document.removeEventListener("mousemove", handleMouseMoveResize)
      document.removeEventListener("mouseup", handleMouseUpResize)
      setIsResizing(false)
    }

    document.addEventListener("mousemove", handleMouseMoveResize)
    document.addEventListener("mouseup", handleMouseUpResize)
  }

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      document.addEventListener("touchmove", handleTouchMove, { passive: false })
      document.addEventListener("touchend", handleTouchEnd)
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      document.removeEventListener("touchmove", handleTouchMove)
      document.removeEventListener("touchend", handleTouchEnd)
    }
  }, [isDragging, dragStart])

  const getCallStateDisplay = () => {
    switch (callState) {
      case "calling":
        return "📞 Calling..."
      case "ringing":
        return "📱 Incoming Call"
      case "active":
        return "🟢 Connected"
      default:
        return "Ready"
    }
  }

  const getStatusColor = () => {
    if (callState === "active") return "bg-green-500"
    if (callState === "calling" || callState === "ringing") return "bg-yellow-500"
    if (connectionState === "connected") return "bg-blue-500"
    return "bg-red-500"
  }

  const getTranslationStatusColor = () => {
    if (translationService.includes("Online")) return "text-green-400"
    if (translationService.includes("Offline")) return "text-yellow-400"
    return "text-gray-400"
  }

  const handleAcceptCall = () => {
    console.log("Accept call button clicked")
    acceptCall()
  }

  const handleRejectCall = () => {
    console.log("Reject call button clicked")
    rejectCall()
  }

  const handleStartVoiceCall = () => {
    console.log("Start voice call button clicked")
    startCall(false)
  }

  const handleStartVideoCall = () => {
    console.log("Start video call button clicked")
    startCall(true)
  }

  const handleEndCall = () => {
    console.log("End call button clicked")
    endCall()
  }

  return (
    <div
      ref={containerRef}
      className="fixed z-50 select-none"
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
      }}
    >
      {/* Header Bar */}
      <div
        className="bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-t-lg px-2 py-1.5 cursor-move drag-handle flex items-center justify-between touch-none"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
          <Move className="w-3 h-3 text-gray-400" />
          <span className="text-xs text-white">{getCallStateDisplay()}</span>
        </div>

        {/* Call Controls in Header */}
        <div className="flex items-center gap-1">
          {callState === "idle" && (
            <>
              <Button
                onClick={handleStartVoiceCall}
                size="sm"
                className="bg-green-600 hover:bg-green-700 rounded-full h-5 w-5 p-0"
                disabled={connectionState !== "connected"}
              >
                <Phone className="w-2.5 h-2.5" />
              </Button>
              <Button
                onClick={handleStartVideoCall}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 rounded-full h-5 w-5 p-0"
                disabled={connectionState !== "connected"}
              >
                <Video className="w-2.5 h-2.5" />
              </Button>
            </>
          )}

          {callState === "calling" && (
            <Button onClick={handleEndCall} size="sm" className="bg-red-600 hover:bg-red-700 rounded-full h-5 w-5 p-0">
              <PhoneOff className="w-2.5 h-2.5" />
            </Button>
          )}

          {callState === "ringing" && (
            <>
              <Button
                onClick={handleAcceptCall}
                size="sm"
                className="bg-green-600 hover:bg-green-700 rounded-full h-5 w-5 p-0"
              >
                <Phone className="w-2.5 h-2.5" />
              </Button>
              <Button
                onClick={handleRejectCall}
                size="sm"
                className="bg-red-600 hover:bg-red-700 rounded-full h-5 w-5 p-0"
              >
                <PhoneOff className="w-2.5 h-2.5" />
              </Button>
            </>
          )}

          {callState === "active" && (
            <Button onClick={handleEndCall} size="sm" className="bg-red-600 hover:bg-red-700 rounded-full h-5 w-5 p-0">
              <PhoneOff className="w-2.5 h-2.5" />
            </Button>
          )}
        </div>
      </div>

      <div className="bg-black/85 backdrop-blur-sm border-x border-b border-gray-700 rounded-b-lg p-2 h-full">
        {/* Video Display - Maximized */}
        <div className="grid grid-cols-2 gap-1.5 h-4/5">
          <div className="relative">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full bg-gray-800 rounded object-cover"
            />
            <div className="absolute bottom-0.5 left-0.5 text-xs bg-black/80 px-1 rounded text-white">You</div>
            {localStream && (
              <div className="absolute top-0.5 right-0.5 flex gap-0.5">
                <Button
                  onClick={toggleVideo}
                  size="sm"
                  variant={isVideoMuted ? "destructive" : "secondary"}
                  className="h-4 w-4 p-0 opacity-80 hover:opacity-100"
                >
                  {isVideoMuted ? <VideoOff className="w-2 h-2" /> : <Video className="w-2 h-2" />}
                </Button>
                <Button
                  onClick={toggleMute}
                  size="sm"
                  variant={isMuted ? "destructive" : "secondary"}
                  className="h-4 w-4 p-0 opacity-80 hover:opacity-100"
                >
                  {isMuted ? <MicOff className="w-2 h-2" /> : <Mic className="w-2 h-2" />}
                </Button>
              </div>
            )}
          </div>
          <div className="relative">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full bg-gray-800 rounded object-cover"
            />
            <div className="absolute bottom-0.5 left-0.5 text-xs bg-black/80 px-1 rounded text-white">
              {remoteStream ? "Friend" : "Waiting..."}
            </div>
            {remoteStream && (
              <div className="absolute top-0.5 right-0.5">
                <Button
                  onClick={toggleDeafen}
                  size="sm"
                  variant={isDeafened ? "destructive" : "secondary"}
                  className="h-4 w-4 p-0 opacity-80 hover:opacity-100"
                >
                  {isDeafened ? <VolumeX className="w-2 h-2" /> : <Volume2 className="w-2 h-2" />}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Enhanced Transcription Controls - Only during active calls */}
        {callState === "active" && (
          <div className="flex items-center justify-between mt-1 gap-1">
            <div className="flex items-center gap-1">
              <Button
                onClick={toggleTranscription}
                size="sm"
                variant={isTranscribing ? "default" : "outline"}
                className="h-5 px-2 text-xs"
              >
                <Mic className="w-2.5 h-2.5 mr-1" />
                {isTranscribing ? "Recording" : "Transcribe"}
              </Button>
              {isTranscribing && (
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                  {transcriptionConfidence > 0 && (
                    <span className="text-xs text-green-400">{Math.round(transcriptionConfidence * 100)}%</span>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1">
              <Wifi className="w-2 h-2" />
              <span className={`text-xs ${getTranslationStatusColor()}`}>{translationService}</span>
              <Select value={transcriptionLanguage} onValueChange={setTranscriptionLanguage}>
                <SelectTrigger className="w-16 h-5 text-xs bg-gray-800 border-gray-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en-US" className="text-xs">
                    EN
                  </SelectItem>
                  <SelectItem value="zh-CN" className="text-xs">
                    中文
                  </SelectItem>
                  <SelectItem value="hi-IN" className="text-xs">
                    हिंदी
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Resize Handle */}
        <div
          className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize opacity-50 hover:opacity-100 bg-gray-400"
          style={{
            clipPath: "polygon(100% 0%, 0% 100%, 100% 100%)",
            touchAction: "none",
          }}
          onMouseDown={handleResize}
        />
      </div>
    </div>
  )
}
