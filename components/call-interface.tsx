"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, Languages, Video, VideoOff } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface CallInterfaceProps {
  peerId: string
  targetId: string
}

type CallState = "idle" | "calling" | "ringing" | "active" | "ended"

export function CallInterface({ peerId, targetId }: CallInterfaceProps) {
  const [callState, setCallState] = useState<CallState>("idle")
  const [isVideoCall, setIsVideoCall] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoMuted, setIsVideoMuted] = useState(false)
  const [isDeafened, setIsDeafened] = useState(false)
  const [isTranslationEnabled, setIsTranslationEnabled] = useState(false)
  const [sourceLanguage, setSourceLanguage] = useState("en-US")
  const [targetLanguage, setTargetLanguage] = useState("es-ES")
  const [ws, setWs] = useState<WebSocket | null>(null)
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [connectionState, setConnectionState] = useState<"disconnected" | "connecting" | "connected">("disconnected")
  const [iceCandidatesQueue, setIceCandidatesQueue] = useState<RTCIceCandidateInit[]>([])

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const recognitionRef = useRef<any>(null)
  const synthRef = useRef<SpeechSynthesis | null>(null)
  const ringtonRef = useRef<HTMLAudioElement>(null)

  const { toast } = useToast()

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

  // Initialize local media stream on component mount
  useEffect(() => {
    initializeLocalMedia()
    return () => {
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  const initializeLocalMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      })
      setLocalStream(stream)

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }

      console.log("Local media initialized:", stream)
    } catch (error) {
      console.error("Error accessing media devices:", error)
      toast({
        title: "Media Access Error",
        description: "Please allow camera and microphone access",
        variant: "destructive",
      })
    }
  }

  useEffect(() => {
    // Initialize WebSocket connection
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "wss://socialspace-bakend.onrender.com"
    console.log("Connecting to:", backendUrl)

    const websocket = new WebSocket(backendUrl)

    websocket.onopen = () => {
      console.log("WebSocket connected")
      websocket.send(JSON.stringify({ type: "register", id: peerId }))
      setWs(websocket)
      setConnectionState("connected")
      toast({
        title: "Connected",
        description: "Connected to signaling server",
      })
    }

    websocket.onmessage = async (event) => {
      console.log("Received message:", event.data)
      const data = JSON.parse(event.data)

      try {
        if (data.type === "call-request") {
          await handleIncomingCall(data)
        } else if (data.type === "call-accepted") {
          await handleCallAccepted(data)
        } else if (data.type === "call-rejected") {
          handleCallRejected()
        } else if (data.type === "call-ended") {
          handleCallEnded()
        } else if (data.type === "offer") {
          await handleOffer(data.offer)
        } else if (data.type === "answer") {
          await handleAnswer(data.answer)
        } else if (data.type === "ice-candidate") {
          await handleIceCandidate(data.candidate)
        }
      } catch (error) {
        console.error("Error handling message:", error)
      }
    }

    websocket.onclose = () => {
      console.log("WebSocket disconnected")
      setConnectionState("disconnected")
    }

    websocket.onerror = (error) => {
      console.error("WebSocket error:", error)
      setConnectionState("disconnected")
    }

    // Initialize speech synthesis
    synthRef.current = window.speechSynthesis

    // Create ringtone audio
    ringtonRef.current = new Audio(
      "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT",
    )
    ringtonRef.current.loop = true

    return () => {
      websocket.close()
      if (peerConnection) {
        peerConnection.close()
      }
      if (ringtonRef.current) {
        ringtonRef.current.pause()
      }
    }
  }, [peerId])

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
      ],
    })

    pc.onicecandidate = (event) => {
      console.log("ICE candidate generated:", event.candidate)
      if (event.candidate && ws) {
        ws.send(
          JSON.stringify({
            type: "ice-candidate",
            candidate: event.candidate,
            targetId,
            senderId: peerId,
          }),
        )
      }
    }

    pc.ontrack = (event) => {
      console.log("Received remote stream:", event.streams[0])
      setRemoteStream(event.streams[0])

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0]
      }
    }

    pc.onconnectionstatechange = () => {
      console.log("Connection state changed:", pc.connectionState)
      if (pc.connectionState === "connected") {
        setCallState("active")
        if (ringtonRef.current) {
          ringtonRef.current.pause()
        }
        toast({
          title: "Call Connected",
          description: "Voice/video call is now active",
        })
      } else if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        console.log("Call disconnected or failed")
        endCall()
      }
    }

    pc.oniceconnectionstatechange = () => {
      console.log("ICE connection state:", pc.iceConnectionState)
    }

    // Add local stream to peer connection
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        console.log("Adding track to peer connection:", track.kind)
        pc.addTrack(track, localStream)
      })
    }

    setPeerConnection(pc)
    return pc
  }

  const startCall = async (videoCall = false) => {
    if (connectionState !== "connected") {
      toast({
        title: "Error",
        description: "Not connected to signaling server",
        variant: "destructive",
      })
      return
    }

    if (!localStream) {
      toast({
        title: "Error",
        description: "Local media not available",
        variant: "destructive",
      })
      return
    }

    try {
      setIsVideoCall(videoCall)
      setCallState("calling")

      // Send call request
      if (ws) {
        ws.send(
          JSON.stringify({
            type: "call-request",
            isVideo: videoCall,
            targetId,
            senderId: peerId,
          }),
        )
      }

      toast({
        title: "Calling...",
        description: `${videoCall ? "Video" : "Voice"} call initiated`,
      })

      // Start ringtone
      if (ringtonRef.current) {
        ringtonRef.current.play().catch(console.error)
      }
    } catch (error) {
      console.error("Error starting call:", error)
      setCallState("idle")
    }
  }

  const handleIncomingCall = async (data: any) => {
    console.log("Handling incoming call:", data)
    setCallState("ringing")
    setIsVideoCall(data.isVideo)

    toast({
      title: "Incoming Call",
      description: `${data.isVideo ? "Video" : "Voice"} call from ${data.senderId}`,
      duration: 10000,
    })

    // Start ringtone
    if (ringtonRef.current) {
      ringtonRef.current.play().catch(console.error)
    }
  }

  const acceptCall = async () => {
    try {
      console.log("Accepting call...")

      if (!localStream) {
        await initializeLocalMedia()
      }

      const pc = createPeerConnection()

      if (ws) {
        ws.send(
          JSON.stringify({
            type: "call-accepted",
            targetId,
            senderId: peerId,
          }),
        )
      }

      if (ringtonRef.current) {
        ringtonRef.current.pause()
      }

      if (isTranslationEnabled) {
        startVoiceTranslation()
      }

      console.log("Call accepted, waiting for offer...")
    } catch (error) {
      console.error("Error accepting call:", error)
      toast({
        title: "Error",
        description: "Failed to accept call",
        variant: "destructive",
      })
      rejectCall()
    }
  }

  const rejectCall = () => {
    if (ws) {
      ws.send(
        JSON.stringify({
          type: "call-rejected",
          targetId,
          senderId: peerId,
        }),
      )
    }

    setCallState("idle")

    if (ringtonRef.current) {
      ringtonRef.current.pause()
    }

    toast({
      title: "Call Rejected",
      description: "Call was rejected",
    })
  }

  const handleCallAccepted = async (data: any) => {
    console.log("Call accepted by peer")

    if (ringtonRef.current) {
      ringtonRef.current.pause()
    }

    try {
      const pc = createPeerConnection()

      // Create and send offer
      console.log("Creating offer...")
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      })

      await pc.setLocalDescription(offer)
      console.log("Local description set, sending offer")

      if (ws) {
        ws.send(
          JSON.stringify({
            type: "offer",
            offer,
            targetId,
            senderId: peerId,
          }),
        )
      }

      if (isTranslationEnabled) {
        startVoiceTranslation()
      }
    } catch (error) {
      console.error("Error handling call accepted:", error)
    }
  }

  const handleCallRejected = () => {
    setCallState("idle")

    if (ringtonRef.current) {
      ringtonRef.current.pause()
    }

    toast({
      title: "Call Rejected",
      description: "Your call was rejected",
      variant: "destructive",
    })
  }

  const endCall = () => {
    if (ws && callState !== "idle") {
      ws.send(
        JSON.stringify({
          type: "call-ended",
          targetId,
          senderId: peerId,
        }),
      )
    }

    handleCallEnded()
  }

  const handleCallEnded = () => {
    if (peerConnection) {
      peerConnection.close()
      setPeerConnection(null)
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }

    if (ringtonRef.current) {
      ringtonRef.current.pause()
    }

    setCallState("idle")
    setRemoteStream(null)
    setIceCandidatesQueue([])

    toast({
      title: "Call Ended",
      description: "Call terminated",
    })
  }

  const handleOffer = async (offer: RTCSessionDescriptionInit) => {
    console.log("Handling offer:", offer)

    try {
      if (!peerConnection) {
        console.log("No peer connection, creating one...")
        const pc = createPeerConnection()

        await pc.setRemoteDescription(offer)
        console.log("Remote description set")

        // Create and send answer
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        console.log("Local description set, sending answer")

        if (ws) {
          ws.send(
            JSON.stringify({
              type: "answer",
              answer,
              targetId,
              senderId: peerId,
            }),
          )
        }

        // Process queued ICE candidates
        for (const candidate of iceCandidatesQueue) {
          await pc.addIceCandidate(candidate)
        }
        setIceCandidatesQueue([])
      }
    } catch (error) {
      console.error("Error handling offer:", error)
    }
  }

  const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
    console.log("Handling answer:", answer)

    try {
      if (peerConnection) {
        await peerConnection.setRemoteDescription(answer)
        console.log("Remote description set from answer")

        // Process queued ICE candidates
        for (const candidate of iceCandidatesQueue) {
          await peerConnection.addIceCandidate(candidate)
        }
        setIceCandidatesQueue([])
      }
    } catch (error) {
      console.error("Error handling answer:", error)
    }
  }

  const handleIceCandidate = async (candidate: RTCIceCandidateInit) => {
    console.log("Handling ICE candidate:", candidate)

    try {
      if (peerConnection && peerConnection.remoteDescription) {
        await peerConnection.addIceCandidate(candidate)
        console.log("ICE candidate added")
      } else {
        console.log("Queueing ICE candidate")
        setIceCandidatesQueue((prev) => [...prev, candidate])
      }
    } catch (error) {
      console.error("Error handling ICE candidate:", error)
    }
  }

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = isMuted
      })
      setIsMuted(!isMuted)
    }
  }

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = isVideoMuted
      })
      setIsVideoMuted(!isVideoMuted)
    }
  }

  const toggleDeafen = () => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = !isDeafened
      setIsDeafened(!isDeafened)
    }
  }

  const startVoiceTranslation = () => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      toast({
        title: "Not Supported",
        description: "Speech recognition is not supported in this browser",
        variant: "destructive",
      })
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

  return (
    <div className="space-y-6">
      {/* Always visible video interface */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Video className="w-5 h-5" />
              Video Interface
            </div>
            <div className="text-sm text-gray-400">
              {connectionState === "connected" ? "🟢 Connected" : "🔴 Disconnected"}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-48 bg-gray-800 rounded-lg object-cover"
              />
              <div className="absolute bottom-2 left-2 text-xs bg-black/50 px-2 py-1 rounded">You ({peerId})</div>
              {localStream && (
                <div className="absolute top-2 right-2 flex gap-1">
                  <Button onClick={toggleVideo} size="sm" variant={isVideoMuted ? "destructive" : "secondary"}>
                    {isVideoMuted ? <VideoOff className="w-3 h-3" /> : <Video className="w-3 h-3" />}
                  </Button>
                  <Button onClick={toggleMute} size="sm" variant={isMuted ? "destructive" : "secondary"}>
                    {isMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                  </Button>
                </div>
              )}
            </div>
            <div className="relative">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-48 bg-gray-800 rounded-lg object-cover"
              />
              <div className="absolute bottom-2 left-2 text-xs bg-black/50 px-2 py-1 rounded">
                {remoteStream ? `Friend (${targetId})` : "Waiting for friend..."}
              </div>
              {remoteStream && (
                <div className="absolute top-2 right-2">
                  <Button onClick={toggleDeafen} size="sm" variant={isDeafened ? "destructive" : "secondary"}>
                    {isDeafened ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Call controls */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5" />
            Call Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <p className="text-lg font-medium mb-4">{getCallStateDisplay()}</p>

            {callState === "idle" && (
              <div className="flex justify-center gap-4">
                <Button
                  onClick={() => startCall(false)}
                  size="lg"
                  className="bg-green-600 hover:bg-green-700 rounded-full w-16 h-16"
                  disabled={connectionState !== "connected"}
                >
                  <Phone className="w-6 h-6" />
                </Button>
                <Button
                  onClick={() => startCall(true)}
                  size="lg"
                  className="bg-blue-600 hover:bg-blue-700 rounded-full w-16 h-16"
                  disabled={connectionState !== "connected"}
                >
                  <Video className="w-6 h-6" />
                </Button>
              </div>
            )}

            {callState === "calling" && (
              <Button onClick={endCall} size="lg" className="bg-red-600 hover:bg-red-700 rounded-full w-16 h-16">
                <PhoneOff className="w-6 h-6" />
              </Button>
            )}

            {callState === "ringing" && (
              <div className="flex justify-center gap-4">
                <Button
                  onClick={acceptCall}
                  size="lg"
                  className="bg-green-600 hover:bg-green-700 rounded-full w-16 h-16"
                >
                  <Phone className="w-6 h-6" />
                </Button>
                <Button onClick={rejectCall} size="lg" className="bg-red-600 hover:bg-red-700 rounded-full w-16 h-16">
                  <PhoneOff className="w-6 h-6" />
                </Button>
              </div>
            )}

            {callState === "active" && (
              <div className="space-y-4">
                <Button onClick={endCall} size="lg" className="bg-red-600 hover:bg-red-700 rounded-full w-16 h-16">
                  <PhoneOff className="w-6 h-6" />
                </Button>

                <div className="flex justify-center gap-4">
                  <Button
                    onClick={() => setIsTranslationEnabled(!isTranslationEnabled)}
                    variant={isTranslationEnabled ? "default" : "secondary"}
                    size="sm"
                  >
                    <Languages className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {isTranslationEnabled && callState === "active" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-300">Your Language</label>
                <Select value={sourceLanguage} onValueChange={setSourceLanguage}>
                  <SelectTrigger className="bg-gray-800 border-gray-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {languages.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300">Translate To</label>
                <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                  <SelectTrigger className="bg-gray-800 border-gray-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {languages.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
