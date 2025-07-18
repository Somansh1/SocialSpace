"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect, useRef } from "react"
import { useToast } from "@/hooks/use-toast"
import { useWebSocket } from "@/components/websocket-provider"

interface CallContextType {
  // Call state
  callState: "idle" | "calling" | "ringing" | "active" | "ended"
  isVideoCall: boolean
  isMuted: boolean
  isVideoMuted: boolean
  isDeafened: boolean

  // Streams
  localStream: MediaStream | null
  remoteStream: MediaStream | null

  // Connection
  connectionState: "disconnected" | "connecting" | "connected"

  // Actions
  startCall: (videoCall?: boolean) => void
  endCall: () => void
  acceptCall: () => void
  rejectCall: () => void
  toggleMute: () => void
  toggleVideo: () => void
  toggleDeafen: () => void

  // Refs for video elements
  localVideoRef: React.RefObject<HTMLVideoElement>
  remoteVideoRef: React.RefObject<HTMLVideoElement>
}

const CallContext = createContext<CallContextType | undefined>(undefined)

export function useCall() {
  const context = useContext(CallContext)
  if (context === undefined) {
    throw new Error("useCall must be used within a CallProvider")
  }
  return context
}

interface CallProviderProps {
  children: React.ReactNode
  peerId: string
  targetId: string
}

export function CallProvider({ children, peerId, targetId }: CallProviderProps) {
  const [callState, setCallState] = useState<"idle" | "calling" | "ringing" | "active" | "ended">("idle")
  const [isVideoCall, setIsVideoCall] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoMuted, setIsVideoMuted] = useState(false)
  const [isDeafened, setIsDeafened] = useState(false)
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [iceCandidatesQueue, setIceCandidatesQueue] = useState<RTCIceCandidateInit[]>([])

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const ringtonRef = useRef<HTMLAudioElement>(null)

  const { toast } = useToast()
  const { sendMessage, connectionState, registerMessageHandler } = useWebSocket()

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
    // Create ringtone audio
    ringtonRef.current = new Audio(
      "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT",
    )
    ringtonRef.current.loop = true

    return () => {
      if (peerConnection) {
        peerConnection.close()
      }
      if (ringtonRef.current) {
        ringtonRef.current.pause()
      }
    }
  }, [])

  // Register message handler for call-related messages
  useEffect(() => {
    const unregister = registerMessageHandler((data: any) => {
      console.log("Call provider received message:", data.type)

      if (data.type === "call-request") {
        handleIncomingCall(data)
      } else if (data.type === "call-accepted") {
        handleCallAccepted(data)
      } else if (data.type === "call-rejected") {
        handleCallRejected()
      } else if (data.type === "call-ended") {
        handleCallEnded()
      } else if (data.type === "offer") {
        handleOffer(data.offer)
      } else if (data.type === "answer") {
        handleAnswer(data.answer)
      } else if (data.type === "ice-candidate") {
        handleIceCandidate(data.candidate)
      }
    })

    return unregister
  }, [registerMessageHandler])

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
      if (event.candidate) {
        sendMessage({
          type: "ice-candidate",
          candidate: event.candidate,
          targetId,
          senderId: peerId,
        })
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
      sendMessage({
        type: "call-request",
        isVideo: videoCall,
        targetId,
        senderId: peerId,
      })

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

      sendMessage({
        type: "call-accepted",
        targetId,
        senderId: peerId,
      })

      if (ringtonRef.current) {
        ringtonRef.current.pause()
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
    sendMessage({
      type: "call-rejected",
      targetId,
      senderId: peerId,
    })

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

      sendMessage({
        type: "offer",
        offer,
        targetId,
        senderId: peerId,
      })
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
    if (callState !== "idle") {
      sendMessage({
        type: "call-ended",
        targetId,
        senderId: peerId,
      })
    }

    handleCallEnded()
  }

  const handleCallEnded = () => {
    if (peerConnection) {
      peerConnection.close()
      setPeerConnection(null)
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

        sendMessage({
          type: "answer",
          answer,
          targetId,
          senderId: peerId,
        })

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

  const value: CallContextType = {
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
  }

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>
}
