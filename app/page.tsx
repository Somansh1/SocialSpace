"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MessageCircle, Upload, Video, Users, Edit } from "lucide-react"
import { WebSocketProvider } from "@/components/websocket-provider"
import { CallProvider } from "@/components/call-provider"
import { FloatingVideoInterface } from "@/components/floating-video-interface"
import { ChatInterface } from "@/components/chat-interface"
import { MediaInterface } from "@/components/media-interface"
import { StreamingInterface } from "@/components/streaming-interface"
import { useToast } from "@/hooks/use-toast"

export default function Home() {
  const [peerId, setPeerId] = useState("")
  const [customPeerId, setCustomPeerId] = useState("")
  const [targetId, setTargetId] = useState("")
  const [isConnected, setIsConnected] = useState(false)
  const [activeTab, setActiveTab] = useState("chat")
  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected")
  const { toast } = useToast()

  useEffect(() => {
    // Generate a default unique peer ID
    const id = `user_${Math.random().toString(36).substr(2, 9)}`
    setPeerId(id)
    setCustomPeerId(id)
  }, [])

  const handleConnect = () => {
    if (!targetId.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid friend's ID",
        variant: "destructive",
      })
      return
    }

    if (!customPeerId.trim()) {
      toast({
        title: "Error",
        description: "Please enter your ID",
        variant: "destructive",
      })
      return
    }

    if (customPeerId === targetId) {
      toast({
        title: "Error",
        description: "Your ID cannot be the same as your friend's ID",
        variant: "destructive",
      })
      return
    }

    setConnectionStatus("connecting")
    setPeerId(customPeerId)

    // Simulate connection delay
    setTimeout(() => {
      setIsConnected(true)
      setConnectionStatus("connected")
      toast({
        title: "Connected",
        description: `Connected as ${customPeerId} to ${targetId}`,
      })
    }, 1000)
  }

  const handleDisconnect = () => {
    setIsConnected(false)
    setConnectionStatus("disconnected")
    toast({
      title: "Disconnected",
      description: "Connection closed",
    })
  }

  const updatePeerId = () => {
    if (!customPeerId.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid ID",
        variant: "destructive",
      })
      return
    }
    setPeerId(customPeerId)
    toast({
      title: "ID Updated",
      description: `Your ID is now: ${customPeerId}`,
    })
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-black/50 backdrop-blur-lg border-gray-800">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-white">SocialSpace</CardTitle>
            <p className="text-gray-300">Connect with friends in real-time</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-300">Your ID</label>
              <div className="flex gap-2">
                <Input
                  value={customPeerId}
                  onChange={(e) => setCustomPeerId(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white flex-1"
                  placeholder="Enter your custom ID"
                />
                <Button onClick={updatePeerId} size="sm" variant="outline">
                  <Edit className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-gray-400 mt-1">Choose a unique ID for yourself</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-300">Friend's ID</label>
              <Input
                placeholder="Enter friend's ID"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <Button
              onClick={handleConnect}
              className="w-full bg-blue-600 hover:bg-blue-700"
              disabled={!targetId.trim() || !customPeerId.trim() || connectionStatus === "connecting"}
            >
              <Users className="w-4 h-4 mr-2" />
              {connectionStatus === "connecting" ? "Connecting..." : "Connect"}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <WebSocketProvider peerId={peerId}>
      <CallProvider peerId={peerId} targetId={targetId}>
        <div className="min-h-screen bg-black text-white">
          {/* Floating Video Interface - Always Visible */}
          <FloatingVideoInterface />

          <div className="container mx-auto p-4 max-w-6xl">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold">SocialSpace</h1>
              <div className="flex items-center gap-2">
                <div className="text-sm text-gray-400">
                  <div>You: {peerId}</div>
                  <div>Friend: {targetId}</div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnect}
                  className="border-red-600 text-red-400 hover:bg-red-600 hover:text-white bg-transparent"
                >
                  Disconnect
                </Button>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-gray-900">
                <TabsTrigger value="chat" className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4" />
                  Chat
                </TabsTrigger>
                <TabsTrigger value="media" className="flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Media
                </TabsTrigger>
                <TabsTrigger value="streaming" className="flex items-center gap-2">
                  <Video className="w-4 h-4" />
                  Watch
                </TabsTrigger>
              </TabsList>

              <TabsContent value="chat" className="mt-6">
                <ChatInterface peerId={peerId} targetId={targetId} />
              </TabsContent>

              <TabsContent value="media" className="mt-6">
                <MediaInterface peerId={peerId} targetId={targetId} />
              </TabsContent>

              <TabsContent value="streaming" className="mt-6">
                <StreamingInterface peerId={peerId} targetId={targetId} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </CallProvider>
    </WebSocketProvider>
  )
}
