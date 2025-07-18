"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { MessageCircle, Send, Volume2, VolumeX } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useCall } from "@/components/call-provider"
import { useWebSocket } from "@/components/websocket-provider"

interface Message {
  id: string
  text: string
  sender: string
  timestamp: Date
  isOwn: boolean
}

interface ChatInterfaceProps {
  peerId: string
  targetId: string
}

export function ChatInterface({ peerId, targetId }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState("")
  const [isTTSEnabled, setIsTTSEnabled] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const synthRef = useRef<SpeechSynthesis | null>(null)
  const { toast } = useToast()
  const { callState } = useCall()
  const { sendMessage, connectionState, registerMessageHandler } = useWebSocket()

  useEffect(() => {
    // Initialize speech synthesis
    synthRef.current = window.speechSynthesis
  }, [])

  // Register message handler for chat messages
  useEffect(() => {
    const unregister = registerMessageHandler((data: any) => {
      if (data.type === "chat-message") {
        console.log("Chat received message:", data)
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

    // Send message via WebSocket
    console.log("Sending chat message:", inputMessage)
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

  return (
    <div className="pb-20">
      {/* Call status indicator */}
      {callState !== "idle" && (
        <div className="mb-4 p-2 bg-blue-900/50 rounded-lg text-center text-sm">
          📞 Call {callState} - Chat remains active during call
        </div>
      )}

      <Card className="bg-gray-900 border-gray-800 h-[70vh] flex flex-col">
        <CardHeader className="flex-shrink-0">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              Chat
            </div>
            <div className="flex items-center gap-2">
              <div className="text-xs text-gray-400">
                {connectionState === "connected" ? "🟢 Connected" : "🔴 Disconnected"}
              </div>
              <Button onClick={toggleTTS} variant={isTTSEnabled ? "default" : "secondary"} size="sm">
                {isTTSEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-0">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-gray-400 py-8">No messages yet. Start the conversation!</div>
            ) : (
              messages.map((message) => (
                <div key={message.id} className={`flex ${message.isOwn ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[70%] rounded-lg p-3 ${
                      message.isOwn ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-100"
                    }`}
                  >
                    <p className="text-sm">{message.text}</p>
                    <p className="text-xs opacity-70 mt-1">{formatTime(message.timestamp)}</p>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-gray-800 p-4">
            <div className="flex gap-2">
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                className="bg-gray-800 border-gray-700 text-white flex-1"
              />
              <Button
                onClick={sendChatMessage}
                disabled={!inputMessage.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
