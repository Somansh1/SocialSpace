"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MessageCircle, Send, Volume2, VolumeX, Move, X, Languages, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useCall } from "@/components/call-provider"
import { useWebSocket } from "@/components/websocket-provider"
import { FreeTranslationService, getLanguageName, getOfflineTranslation } from "@/lib/translation"

interface Message {
  id: string
  text: string
  sender: string
  timestamp: Date
  isOwn: boolean
}

interface FloatingChatInterfaceProps {
  peerId: string
  targetId: string
  isVisible: boolean
  onClose: () => void
}

export function FloatingChatInterface({ peerId, targetId, isVisible, onClose }: FloatingChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState("")
  const [isTTSEnabled, setIsTTSEnabled] = useState(true)
  const [position, setPosition] = useState({ x: window.innerWidth - 370, y: 50 })
  const [size, setSize] = useState({ width: 350, height: 500 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [isTranslating, setIsTranslating] = useState(false)
  const [translatingMessageId, setTranslatingMessageId] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const synthRef = useRef<SpeechSynthesis | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const translationServiceRef = useRef<FreeTranslationService | null>(null)

  const { toast } = useToast()
  const { callState, translationService } = useCall()
  const { sendMessage, connectionState, registerMessageHandler } = useWebSocket()

  useEffect(() => {
    synthRef.current = window.speechSynthesis
    translationServiceRef.current = new FreeTranslationService()
  }, [])

  const translateMessage = async (message: Message) => {
    if (!translationServiceRef.current || isTranslating) return

    setIsTranslating(true)
    setTranslatingMessageId(message.id)

    try {
      // Use the simplified translateToEnglish method
      const result = await translationServiceRef.current.translateToEnglish(message.text)

      if (result && result.translatedText && result.translatedText !== message.text) {
        // Add translated message to chat
        const translatedMessage: Message = {
          id: Date.now().toString() + Math.random(),
          text: `🌐 [${getLanguageName(result.detectedLanguage || "unknown")} → English] (${result.service}): ${result.translatedText}`,
          sender: peerId,
          timestamp: new Date(),
          isOwn: true,
        }

        setMessages((prev) => [...prev, translatedMessage])

        toast({
          title: "Translation Complete",
          description: `Translated from ${getLanguageName(result.detectedLanguage || "unknown")} using ${result.service}`,
        })
      } else {
        // Try offline translation as fallback
        const offlineTranslation = getOfflineTranslation(message.text)
        if (offlineTranslation) {
          const translatedMessage: Message = {
            id: Date.now().toString() + Math.random(),
            text: `🌐 [Offline Translation]: ${offlineTranslation}`,
            sender: peerId,
            timestamp: new Date(),
            isOwn: true,
          }

          setMessages((prev) => [...prev, translatedMessage])

          toast({
            title: "Offline Translation",
            description: "Used offline translation for common phrase",
          })
        } else {
          toast({
            title: "Translation Failed",
            description: "Could not translate this message",
            variant: "destructive",
          })
        }
      }
    } catch (error) {
      console.error("Translation error:", error)
      toast({
        title: "Translation Error",
        description: "Translation service failed",
        variant: "destructive",
      })
    } finally {
      setIsTranslating(false)
      setTranslatingMessageId(null)
    }
  }

  useEffect(() => {
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
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
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

  // Register message handler for chat messages
  useEffect(() => {
    const unregister = registerMessageHandler((data: any) => {
      if (data.type === "chat-message") {
        const newMessage: Message = {
          id: Date.now().toString() + Math.random(),
          text: data.message,
          sender: data.senderId,
          timestamp: new Date(),
          isOwn: false,
        }

        setMessages((prev) => [...prev, newMessage])

        // Text-to-speech for incoming messages
        if (isTTSEnabled && synthRef.current) {
          const utterance = new SpeechSynthesisUtterance(data.message)
          utterance.rate = 0.9
          utterance.volume = 0.8
          synthRef.current.speak(utterance)
        }
      }
    })

    return unregister
  }, [registerMessageHandler, isTTSEnabled])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const sendChatMessage = () => {
    if (!inputMessage.trim()) return

    if (connectionState !== "connected") {
      toast({
        title: "Error",
        description: "Not connected to chat server",
        variant: "destructive",
      })
      return
    }

    const newMessage: Message = {
      id: Date.now().toString() + Math.random(),
      text: inputMessage,
      sender: peerId,
      timestamp: new Date(),
      isOwn: true,
    }

    setMessages((prev) => [...prev, newMessage])

    sendMessage({
      type: "chat-message",
      message: inputMessage,
      targetId,
      senderId: peerId,
    })

    setInputMessage("")
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendChatMessage()
    }
  }

  const toggleTTS = () => {
    setIsTTSEnabled(!isTTSEnabled)
    toast({
      title: isTTSEnabled ? "TTS Disabled" : "TTS Enabled",
      description: isTTSEnabled ? "Text-to-speech turned off" : "Text-to-speech turned on",
    })
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  if (!isVisible) return null

  return (
    <div
      ref={containerRef}
      className="fixed z-40 select-none"
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
      }}
    >
      {/* Header Bar */}
      <div
        className="bg-gray-900/90 backdrop-blur-sm border border-gray-700 rounded-t-lg px-3 py-2 cursor-move drag-handle flex items-center justify-between touch-none"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-blue-400" />
          <Move className="w-3 h-3 text-gray-400" />
          <span className="text-xs text-white">Chat</span>
          {callState !== "idle" && <span className="text-xs text-blue-400">• Call {callState}</span>}
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-gray-400">{connectionState === "connected" ? "🟢" : "🔴"}</div>
          <div className="text-xs text-green-400">{translationService}</div>
          <Button
            onClick={toggleTTS}
            variant={isTTSEnabled ? "default" : "secondary"}
            size="sm"
            className="h-5 w-5 p-0"
          >
            {isTTSEnabled ? <Volume2 className="w-2 h-2" /> : <VolumeX className="w-2 h-2" />}
          </Button>
          <Button onClick={onClose} variant="ghost" size="sm" className="h-5 w-5 p-0 text-gray-400 hover:text-white">
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Chat Content */}
      <div className="bg-black/80 backdrop-blur-sm border-x border-b border-gray-700 rounded-b-lg flex flex-col h-full">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {messages.length === 0 ? (
            <div className="text-center text-gray-400 py-8 text-sm">No messages yet. Start the conversation!</div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className={`flex ${message.isOwn ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-lg p-2 ${
                    message.isOwn ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-100"
                  } ${message.text.includes("🎤 [") ? "border-l-2 border-green-500" : ""} ${
                    message.text.includes("🌐 [") ? "border-l-2 border-purple-500" : ""
                  }`}
                >
                  <p className="text-sm">{message.text}</p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs opacity-70">{formatTime(message.timestamp)}</p>
                    {!message.isOwn &&
                      !message.text.includes("[Translated") &&
                      !message.text.includes("🎤 [") &&
                      !message.text.includes("🌐 [") && (
                        <Button
                          onClick={() => translateMessage(message)}
                          size="sm"
                          variant="ghost"
                          className="h-4 px-1 text-xs opacity-90 hover:opacity-100 hover:bg-gray-600"
                          disabled={isTranslating && translatingMessageId === message.id}
                        >
                          {isTranslating && translatingMessageId === message.id ? (
                            <Loader2 className="w-2 h-2 animate-spin" />
                          ) : (
                            <Languages className="w-2 h-2" />
                          )}
                        </Button>
                      )}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-700 p-3">
          <div className="flex gap-2">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className="bg-gray-800 border-gray-700 text-white flex-1 text-sm"
            />
            <Button
              onClick={sendChatMessage}
              disabled={!inputMessage.trim()}
              className="bg-blue-600 hover:bg-blue-700 h-8 w-8 p-0"
            >
              <Send className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
