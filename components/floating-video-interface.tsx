"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Video,
  VideoOff,
  Minimize2,
  Maximize2,
  Move,
  Languages,
} from "lucide-react"
import { useCall } from "@/components/call-provider"

export function FloatingVideoInterface() {
  const {
    callState,
    isVideoCall,
    isMuted,
    isVideoMuted,
    isDeafened,
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
    localVideoRef,
    remoteVideoRef,
  } = useCall()

  const [isMinimized, setIsMinimized] = useState(false)
  const [position, setPosition] = useState({ x: 20, y: 20 })
  const [size, setSize] = useState({ width: 320, height: 280 })
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [isTranslationEnabled, setIsTranslationEnabled] = useState(false)
  const [sourceLanguage, setSourceLanguage] = useState("en-US")
  const [targetLanguage, setTargetLanguage] = useState("es-ES")

  const containerRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)
  const synthRef = useRef<SpeechSynthesis | null>(null)

  const languages = [
    { code: "en-US", name: "English (US)" },
    { code: "es-ES", name: "Spanish" },
    { code: "fr-FR", name: "French" },
    { code: "de-DE", name: "German" },
    { code: "it-IT", name: "Italian" },
    { code: "pt-BR", name: "Portuguese" },
    { code: "ja-JP", name: "Japanese" },
    { code: "ko-KR", name: "Korean" },
    { code: "zh-CN", name: "Chinese" },
  ]

  useEffect(() => {
    synthRef.current = window.speechSynthesis
  }, [])

  useEffect(() => {
    if (isTranslationEnabled && callState === "active") {
      startVoiceTranslation()
    } else if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
  }, [isTranslationEnabled, callState])

  const startVoiceTranslation = () => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      return
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SpeechRecognition()

    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = sourceLanguage

    recognition.onresult = async (event: any) => {
      const transcript = event.results[event.results.length - 1][0].transcript

      if (event.results[event.results.length - 1].isFinal) {
        const utterance = new SpeechSynthesisUtterance(transcript)
        utterance.lang = targetLanguage
        utterance.rate = 0.8
        utterance.volume = 0.7

        if (synthRef.current) {
          synthRef.current.speak(utterance)
        }
      }
    }

    recognition.start()
    recognitionRef.current = recognition
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains("drag-handle")) {
      setIsDragging(true)
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      })
    }
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    setIsResizing(false)
  }

  const handleResize = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)

    const startX = e.clientX
    const startY = e.clientY
    const startWidth = size.width
    const startHeight = size.height

    const handleMouseMoveResize = (e: MouseEvent) => {
      const newWidth = Math.max(280, startWidth + (e.clientX - startX))
      const newHeight = Math.max(200, startHeight + (e.clientY - startY))
      setSize({ width: newWidth, height: newHeight })
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
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isDragging, dragStart])

  const getCallStateDisplay = () => {
    switch (callState) {
      case "calling":
        return "Calling..."
      case "ringing":
        return "Incoming Call"
      case "active":
        return "Call Active"
      default:
        return "Ready to Call"
    }
  }

  const getStatusColor = () => {
    if (callState === "active") return "bg-green-500"
    if (callState === "calling" || callState === "ringing") return "bg-yellow-500"
    if (connectionState === "connected") return "bg-blue-500"
    return "bg-red-500"
  }

  return (
    <div
      ref={containerRef}
      className="fixed z-50 select-none"
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: isMinimized ? "auto" : size.height,
      }}
    >
      {/* Header Bar */}
      <div
        className="bg-gray-900/90 backdrop-blur-sm border border-gray-700 rounded-t-lg px-3 py-2 cursor-move drag-handle flex items-center justify-between"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
          <Move className="w-3 h-3 text-gray-400" />
          <span className="text-xs text-white">Video Call</span>
        </div>
        <Button
          onClick={() => setIsMinimized(!isMinimized)}
          size="sm"
          variant="ghost"
          className="h-5 w-5 p-0 text-gray-400 hover:text-white"
        >
          {isMinimized ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
        </Button>
      </div>

      {!isMinimized && (
        <div className="bg-black/80 backdrop-blur-sm border-x border-b border-gray-700 rounded-b-lg p-3 space-y-3">
          {/* Video Display */}
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-20 bg-gray-800 rounded object-cover"
              />
              <div className="absolute bottom-1 left-1 text-xs bg-black/70 px-1 rounded text-white">You</div>
              {/* Local video controls overlay */}
              {localStream && (
                <div className="absolute top-1 right-1 flex gap-1">
                  <Button
                    onClick={toggleVideo}
                    size="sm"
                    variant={isVideoMuted ? "destructive" : "secondary"}
                    className="h-5 w-5 p-0 opacity-80 hover:opacity-100"
                  >
                    {isVideoMuted ? <VideoOff className="w-2 h-2" /> : <Video className="w-2 h-2" />}
                  </Button>
                  <Button
                    onClick={toggleMute}
                    size="sm"
                    variant={isMuted ? "destructive" : "secondary"}
                    className="h-5 w-5 p-0 opacity-80 hover:opacity-100"
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
                className="w-full h-20 bg-gray-800 rounded object-cover"
              />
              <div className="absolute bottom-1 left-1 text-xs bg-black/70 px-1 rounded text-white">
                {remoteStream ? "Friend" : "Waiting..."}
              </div>
              {remoteStream && (
                <div className="absolute top-1 right-1">
                  <Button
                    onClick={toggleDeafen}
                    size="sm"
                    variant={isDeafened ? "destructive" : "secondary"}
                    className="h-5 w-5 p-0 opacity-80 hover:opacity-100"
                  >
                    {isDeafened ? <VolumeX className="w-2 h-2" /> : <Volume2 className="w-2 h-2" />}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Call Status */}
          <div className="text-center">
            <p className="text-xs text-gray-300 mb-2">{getCallStateDisplay()}</p>

            {/* Call Controls */}
            {callState === "idle" && (
              <div className="flex justify-center gap-2">
                <Button
                  onClick={() => startCall(false)}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 rounded-full h-8 w-8 p-0"
                  disabled={connectionState !== "connected"}
                >
                  <Phone className="w-3 h-3" />
                </Button>
                <Button
                  onClick={() => startCall(true)}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 rounded-full h-8 w-8 p-0"
                  disabled={connectionState !== "connected"}
                >
                  <Video className="w-3 h-3" />
                </Button>
              </div>
            )}

            {callState === "calling" && (
              <div className="flex justify-center gap-1">
                <Button onClick={endCall} size="sm" className="bg-red-600 hover:bg-red-700 rounded-full h-8 w-8 p-0">
                  <PhoneOff className="w-3 h-3" />
                </Button>
              </div>
            )}

            {callState === "ringing" && (
              <div className="flex justify-center gap-2">
                <Button
                  onClick={acceptCall}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 rounded-full h-8 w-8 p-0"
                >
                  <Phone className="w-3 h-3" />
                </Button>
                <Button onClick={rejectCall} size="sm" className="bg-red-600 hover:bg-red-700 rounded-full h-8 w-8 p-0">
                  <PhoneOff className="w-3 h-3" />
                </Button>
              </div>
            )}

            {callState === "active" && (
              <div className="space-y-2">
                <div className="flex justify-center gap-1">
                  <Button
                    onClick={() => setIsTranslationEnabled(!isTranslationEnabled)}
                    size="sm"
                    variant={isTranslationEnabled ? "default" : "secondary"}
                    className="h-7 w-7 p-0"
                  >
                    <Languages className="w-3 h-3" />
                  </Button>

                  <Button onClick={endCall} size="sm" className="bg-red-600 hover:bg-red-700 h-7 w-7 p-0">
                    <PhoneOff className="w-3 h-3" />
                  </Button>
                </div>

                {/* Translation Settings */}
                {isTranslationEnabled && (
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <Select value={sourceLanguage} onValueChange={setSourceLanguage}>
                      <SelectTrigger className="bg-gray-800 border-gray-700 h-6 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {languages.map((lang) => (
                          <SelectItem key={lang.code} value={lang.code} className="text-xs">
                            {lang.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                      <SelectTrigger className="bg-gray-800 border-gray-700 h-6 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {languages.map((lang) => (
                          <SelectItem key={lang.code} value={lang.code} className="text-xs">
                            {lang.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Resize Handle */}
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize opacity-30 hover:opacity-60"
            onMouseDown={handleResize}
          >
            <div className="w-full h-full">
              <div className="absolute bottom-1 right-1 w-2 h-2 border-r-2 border-b-2 border-gray-400"></div>
            </div>
          </div>
        </div>
      )}

      {isMinimized && (
        <div className="bg-black/80 backdrop-blur-sm border-x border-b border-gray-700 rounded-b-lg px-3 py-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-300">{getCallStateDisplay()}</span>
            {callState === "ringing" && (
              <div className="flex gap-1">
                <Button
                  onClick={acceptCall}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 rounded-full h-6 w-6 p-0"
                >
                  <Phone className="w-2 h-2" />
                </Button>
                <Button onClick={rejectCall} size="sm" className="bg-red-600 hover:bg-red-700 rounded-full h-6 w-6 p-0">
                  <PhoneOff className="w-2 h-2" />
                </Button>
              </div>
            )}
            {callState === "active" && (
              <Button onClick={endCall} size="sm" className="bg-red-600 hover:bg-red-700 rounded-full h-6 w-6 p-0">
                <PhoneOff className="w-2 h-2" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
