"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MessageCircle, Send, Volume2, VolumeX, Languages } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useCall } from "@/components/call-provider"
import { useWebSocket } from "@/components/websocket-provider"

interface Message {
  id: string
  text: string
  sender: string
  timestamp: Date
  isOwn: boolean
  isTranscribed?: boolean
}

interface ChatInterfaceProps {
  peerId: string
  targetId: string
}

export function ChatInterface({ peerId, targetId }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState("")
  const [isTTSEnabled, setIsTTSEnabled] = useState(true)
  const [translationLanguage, setTranslationLanguage] = useState("zh") // Default to Chinese
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const synthRef = useRef<SpeechSynthesis | null>(null)
  const { toast } = useToast()
  const { callState } = useCall()
  const { sendMessage, connectionState, registerMessageHandler } = useWebSocket()

  const languages = [
    { code: "zh", name: "Chinese" },
    { code: "hi", name: "Hindi" },
    { code: "es", name: "Spanish" },
    { code: "fr", name: "French" },
    { code: "de", name: "German" },
    { code: "ja", name: "Japanese" },
    { code: "ko", name: "Korean" },
    { code: "ar", name: "Arabic" },
  ]

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
          isTranscribed: data.message.includes("🎤 [Transcribed]"),
        }

        setMessages((prev) => [...prev, newMessage])

        // Text-to-speech for incoming messages (but not transcribed ones)
        if (isTTSEnabled && synthRef.current && !newMessage.isTranscribed) {
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

  const translateMessage = async (message: Message) => {
    try {
      const translatedText = await mockTranslate(message.text, translationLanguage)

      // Add translated message to chat
      const translatedMessage: Message = {
        id: Date.now().toString() + Math.random(),
        text: `🌐 [Translated to ${languages.find((l) => l.code === translationLanguage)?.name}]: ${translatedText}`,
        sender: peerId,
        timestamp: new Date(),
        isOwn: true,
      }

      setMessages((prev) => [...prev, translatedMessage])

      toast({
        title: "Translation Complete",
        description: `Translated to ${languages.find((l) => l.code === translationLanguage)?.name}`,
      })
    } catch (error) {
      toast({
        title: "Translation Error",
        description: "Failed to translate message",
        variant: "destructive",
      })
    }
  }

  const mockTranslate = async (text: string, targetLang: string): Promise<string> => {
    // Remove transcription prefix if present
    const cleanText = text.replace(/🎤 \[Transcribed\]: /, "")

    // Simple mock translation - in production, use a real translation service
    const translations: Record<string, Record<string, string>> = {
      hello: {
        zh: "你好",
        hi: "नमस्ते",
        es: "hola",
        fr: "bonjour",
        de: "hallo",
        ja: "こんにちは",
        ko: "안녕하세요",
        ar: "مرحبا",
      },
      goodbye: {
        zh: "再见",
        hi: "अलविदा",
        es: "adiós",
        fr: "au revoir",
        de: "auf wiedersehen",
        ja: "さようなら",
        ko: "안녕히 가세요",
        ar: "وداعا",
      },
      "thank you": {
        zh: "谢谢",
        hi: "धन्यवाद",
        es: "gracias",
        fr: "merci",
        de: "danke",
        ja: "ありがとう",
        ko: "감사합니다",
        ar: "شكرا",
      },
      yes: { zh: "是", hi: "हाँ", es: "sí", fr: "oui", de: "ja", ja: "はい", ko: "네", ar: "نعم" },
      no: { zh: "不", hi: "नहीं", es: "no", fr: "non", de: "nein", ja: "いいえ", ko: "아니요", ar: "لا" },
      "how are you": {
        zh: "你好吗",
        hi: "आप कैसे हैं",
        es: "¿cómo estás?",
        fr: "comment allez-vous",
        de: "wie geht es dir",
        ja: "元気ですか",
        ko: "어떻게 지내세요",
        ar: "كيف حالك",
      },
    }

    const lowerText = cleanText.toLowerCase()
    for (const [english, translationMap] of Object.entries(translations)) {
      if (lowerText.includes(english)) {
        return translationMap[targetLang] || cleanText
      }
    }

    // For demo purposes, add a language prefix
    const prefixes: Record<string, string> = {
      zh: "[中文] ",
      hi: "[हिंदी] ",
      es: "[ES] ",
      fr: "[FR] ",
      de: "[DE] ",
      ja: "[日本語] ",
      ko: "[한국어] ",
      ar: "[العربية] ",
    }

    return (prefixes[targetLang] || "[TRANSLATED] ") + cleanText
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
              <Select value={translationLanguage} onValueChange={setTranslationLanguage}>
                <SelectTrigger className="w-24 h-8 text-xs bg-gray-800 border-gray-600">
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
                    } ${message.isTranscribed ? "border-l-4 border-green-500" : ""}`}
                  >
                    <p className="text-sm">{message.text}</p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs opacity-70">{formatTime(message.timestamp)}</p>
                      {!message.isOwn &&
                        !message.text.includes("[Translated") &&
                        !message.text.includes("🎤 [Transcribed]") &&
                        !message.text.includes("🌐 [Translated") && (
                          <Button
                            onClick={() => translateMessage(message)}
                            size="sm"
                            variant="ghost"
                            className="h-5 px-1 text-xs opacity-90 hover:opacity-100 hover:bg-gray-600"
                          >
                            <Languages className="w-3 h-3" />
                          </Button>
                        )}
                    </div>
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
