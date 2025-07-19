"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect, useRef } from "react"
import { useToast } from "@/hooks/use-toast"
import { useWebSocket } from "@/components/websocket-provider"
import { SpeechRecognitionService } from "@/lib/speech-recognition"
import { FreeTranslationService, getOfflineTranslation } from "@/lib/translation"

// Add type declarations for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any
    webkitSpeechRecognition: any
    AudioContext: any
    webkitAudioContext: any
  }
}

interface CallContextType {
  // Call state
  callState: "idle" | "calling" | "ringing" | "active" | "ended"
  isVideoCall: boolean
  isMuted: boolean
  isVideoMuted: boolean
  isDeafened: boolean

  // Transcription
  isTranscribing: boolean
  transcriptionLanguage: string
  transcriptionConfidence: number
  translationService: string

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
  toggleTranscription: () => void
  setTranscriptionLanguage: (lang: string) => void

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
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcriptionLanguage, setTranscriptionLanguageState] = useState("en-US")
  const [transcriptionConfidence, setTranscriptionConfidence] = useState(0)
  const [translationService, setTranslationService] = useState("LibreTranslate")
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [iceCandidatesQueue, setIceCandidatesQueue] = useState<RTCIceCandidateInit[]>([])
  const [isInitiator, setIsInitiator] = useState(false)

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const speechRecognitionRef = useRef<SpeechRecognitionService | null>(null)
  const translationServiceRef = useRef<FreeTranslationService | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)

  const { toast } = useToast()
  const { sendMessage, connectionState, registerMessageHandler } = useWebSocket()

  // Initialize services
  useEffect(() => {
    speechRecognitionRef.current = new SpeechRecognitionService()
    translationServiceRef.current = new FreeTranslationService()

    // Check service health on startup
    if (translationServiceRef.current) {
      translationServiceRef.current.checkServiceHealth().then((health) => {
        console.log("Translation service health:", health)
        const availableServices = Object.entries(health)
          .filter(([_, isHealthy]) => isHealthy)
          .map(([service]) => service)

        if (availableServices.length > 0) {
          const primaryService =
            availableServices[0] === "google-free" ? "Google Translate (Free)" : availableServices[0]
          setTranslationService(primaryService)
          toast({
            title: "Translation Ready",
            description: `Primary: ${primaryService}, Fallbacks: ${availableServices.slice(1).join(", ")}`,
          })
        } else {
          toast({
            title: "Translation Limited",
            description: "Using offline translation for common phrases",
            variant: "destructive",
          })
        }
      })
    }

    return () => {
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.stop()
      }
    }
  }, [])

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
      console.log("Initializing local media...")
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      })
      setLocalStream(stream)

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }

      // Set up audio analysis for voice detection
      setupAudioAnalysis(stream)

      console.log(
        "Local media initialized successfully:",
        stream.getTracks().map((t) => t.kind),
      )
    } catch (error) {
      console.error("Error accessing media devices:", error)
      toast({
        title: "Media Access Error",
        description: "Please allow camera and microphone access",
        variant: "destructive",
      })
    }
  }

  const setupAudioAnalysis = (stream: MediaStream) => {
    try {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
      const source = audioContextRef.current.createMediaStreamSource(stream)
      analyserRef.current = audioContextRef.current.createAnalyser()

      analyserRef.current.fftSize = 256
      source.connect(analyserRef.current)

      console.log("Audio analysis setup complete")
    } catch (error) {
      console.error("Error setting up audio analysis:", error)
    }
  }

  const startTranscription = () => {
    if (!speechRecognitionRef.current) {
      toast({
        title: "Transcription Error",
        description: "Speech recognition not available",
        variant: "destructive",
      })
      return
    }

    if (!speechRecognitionRef.current.isRecognitionSupported()) {
      toast({
        title: "Not Supported",
        description: "Speech recognition not supported in this browser",
        variant: "destructive",
      })
      return
    }

    const success = speechRecognitionRef.current.start(
      async (transcript: string, isFinal: boolean, confidence: number) => {
        setTranscriptionConfidence(confidence)

        if (isFinal && transcript.trim()) {
          console.log("Final transcript:", transcript, "Confidence:", confidence)

          // Auto-translate if not English
          let finalMessage = `🎤 [${transcriptionLanguage}]: ${transcript}`

          if (translationServiceRef.current && transcriptionLanguage !== "en-US") {
            try {
              const result = await translationServiceRef.current.translateToEnglish(transcript)

              if (result && result.translatedText && result.translatedText !== transcript) {
                finalMessage += ` → [EN]: ${result.translatedText}`
                setTranslationService(result.service || "Online")
              } else {
                // Fallback to offline translation for common phrases
                const offlineTranslation = getOfflineTranslation(transcript)
                if (offlineTranslation) {
                  finalMessage += ` → [EN]: ${offlineTranslation} (offline)`
                  setTranslationService("Offline fallback")
                } else {
                  finalMessage += ` → [EN]: Translation unavailable`
                }
              }
            } catch (error) {
              console.error("Translation error:", error)
              finalMessage += ` → [EN]: Translation failed`
            }
          }

          // Send transcription to chat
          sendMessage({
            type: "chat-message",
            message: finalMessage,
            targetId,
            senderId: peerId,
          })
        }
      },
      (error: string) => {
        console.error("Speech recognition error:", error)
        setIsTranscribing(false)
        toast({
          title: "Transcription Error",
          description: `Speech recognition failed: ${error}`,
          variant: "destructive",
        })
      },
      () => {
        // Restart if still transcribing
        if (isTranscribing && callState === "active") {
          setTimeout(() => {
            startTranscription()
          }, 100)
        }
      },
    )

    if (success) {
      setIsTranscribing(true)
      toast({
        title: "Transcription Started",
        description: `Converting ${transcriptionLanguage} speech to text...`,
      })
    }
  }

  const stopTranscription = () => {
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.stop()
      setIsTranscribing(false)
      setTranscriptionConfidence(0)
      console.log("Speech transcription stopped")
      toast({
        title: "Transcription Stopped",
        description: "Speech to text disabled",
      })
    }
  }

  const toggleTranscription = () => {
    if (isTranscribing) {
      stopTranscription()
    } else {
      startTranscription()
    }
  }

  const setTranscriptionLanguage = (lang: string) => {
    setTranscriptionLanguageState(lang)
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.setLanguage(lang)
    }

    if (isTranscribing) {
      // Restart transcription with new language
      stopTranscription()
      setTimeout(() => {
        startTranscription()
      }, 500)
    }

    toast({
      title: "Language Changed",
      description: `Transcription language set to ${lang}`,
    })
  }

  // Register message handler for call-related messages
  useEffect(() => {
    console.log("Registering call message handler...")
    const unregister = registerMessageHandler((data: any) => {
      console.log("Call provider received message:", data.type, data)

      switch (data.type) {
        case "call-request":
          handleIncomingCall(data)
          break
        case "call-accepted":
          handleCallAccepted(data)
          break
        case "call-rejected":
          handleCallRejected()
          break
        case "call-ended":
          handleCallEnded()
          break
        case "offer":
          handleOffer(data.offer)
          break
        case "answer":
          handleAnswer(data.answer)
          break
        case "ice-candidate":
          handleIceCandidate(data.candidate)
          break
        default:
          // Ignore other message types
          break
      }
    })

    return unregister
  }, [registerMessageHandler, peerId, targetId])

  const createPeerConnection = () => {
    console.log("Creating peer connection...")
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
      ],
    })

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("Sending ICE candidate:", event.candidate)
        sendMessage({
          type: "ice-candidate",
          candidate: event.candidate,
          targetId,
          senderId: peerId,
        })
      } else {
        console.log("ICE gathering complete")
      }
    }

    pc.ontrack = (event) => {
      console.log("Received remote stream:", event.streams[0])
      const stream = event.streams[0]
      setRemoteStream(stream)

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream
      }
    }

    pc.onconnectionstatechange = () => {
      console.log("Peer connection state changed:", pc.connectionState)
      if (pc.connectionState === "connected") {
        setCallState("active")
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
      console.log("Adding local stream tracks to peer connection")
      localStream.getTracks().forEach((track) => {
        console.log("Adding track:", track.kind, track.enabled)
        pc.addTrack(track, localStream)
      })
    } else {
      console.warn("No local stream available when creating peer connection")
    }

    setPeerConnection(pc)
    return pc
  }

  const startCall = async (videoCall = false) => {
    console.log("Starting call, video:", videoCall)

    if (connectionState !== "connected") {
      toast({
        title: "Error",
        description: "Not connected to signaling server",
        variant: "destructive",
      })
      return
    }

    if (!localStream) {
      console.log("No local stream, initializing...")
      await initializeLocalMedia()
      // Wait a bit for stream to be set
      await new Promise((resolve) => setTimeout(resolve, 500))
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
      setIsInitiator(true)

      // Send call request
      console.log("Sending call request to:", targetId)
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
    } catch (error) {
      console.error("Error starting call:", error)
      setCallState("idle")
    }
  }

  const handleIncomingCall = async (data: any) => {
    console.log("Handling incoming call:", data)
    setCallState("ringing")
    setIsVideoCall(data.isVideo)
    setIsInitiator(false)

    toast({
      title: "Incoming Call",
      description: `${data.isVideo ? "Video" : "Voice"} call from ${data.senderId}`,
      duration: 15000,
    })
  }

  const acceptCall = async () => {
    console.log("Accepting call...")

    try {
      if (!localStream) {
        console.log("No local stream, initializing for call accept...")
        await initializeLocalMedia()
        await new Promise((resolve) => setTimeout(resolve, 500))
      }

      if (!localStream) {
        throw new Error("Could not initialize local media")
      }

      // Create peer connection
      const pc = createPeerConnection()

      // Send acceptance
      console.log("Sending call accepted message")
      sendMessage({
        type: "call-accepted",
        targetId,
        senderId: peerId,
      })

      console.log("Call accepted, waiting for offer...")
    } catch (error) {
      console.error("Error accepting call:", error)
      toast({
        title: "Error",
        description: "Failed to accept call: " + error.message,
        variant: "destructive",
      })
      rejectCall()
    }
  }

  const rejectCall = () => {
    console.log("Rejecting call")
    sendMessage({
      type: "call-rejected",
      targetId,
      senderId: peerId,
    })

    setCallState("idle")

    toast({
      title: "Call Rejected",
      description: "Call was rejected",
    })
  }

  const handleCallAccepted = async (data: any) => {
    console.log("Call accepted by peer, creating offer...")

    try {
      // Create peer connection if not exists
      let pc = peerConnection
      if (!pc) {
        pc = createPeerConnection()
      }

      // Create and send offer
      console.log("Creating offer...")
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      })

      console.log("Setting local description...")
      await pc.setLocalDescription(offer)

      console.log("Sending offer to peer")
      sendMessage({
        type: "offer",
        offer,
        targetId,
        senderId: peerId,
      })
    } catch (error) {
      console.error("Error handling call accepted:", error)
      toast({
        title: "Error",
        description: "Failed to create call offer",
        variant: "destructive",
      })
    }
  }

  const handleCallRejected = () => {
    console.log("Call was rejected")
    setCallState("idle")

    toast({
      title: "Call Rejected",
      description: "Your call was rejected",
      variant: "destructive",
    })
  }

  const endCall = () => {
    console.log("Ending call")
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
    console.log("Handling call ended")
    if (peerConnection) {
      peerConnection.close()
      setPeerConnection(null)
    }

    // Stop transcription
    stopTranscription()

    setCallState("idle")
    setRemoteStream(null)
    setIceCandidatesQueue([])
    setIsInitiator(false)

    toast({
      title: "Call Ended",
      description: "Call terminated",
    })
  }

  const handleOffer = async (offer: RTCSessionDescriptionInit) => {
    console.log("Handling offer:", offer)

    try {
      let pc = peerConnection
      if (!pc) {
        console.log("Creating peer connection for offer...")
        pc = createPeerConnection()
      }

      console.log("Setting remote description...")
      await pc.setRemoteDescription(offer)

      // Process queued ICE candidates
      console.log("Processing queued ICE candidates:", iceCandidatesQueue.length)
      for (const candidate of iceCandidatesQueue) {
        try {
          await pc.addIceCandidate(candidate)
          console.log("Added queued ICE candidate")
        } catch (error) {
          console.error("Error adding queued ICE candidate:", error)
        }
      }
      setIceCandidatesQueue([])

      // Create and send answer
      console.log("Creating answer...")
      const answer = await pc.createAnswer()

      console.log("Setting local description...")
      await pc.setLocalDescription(answer)

      console.log("Sending answer")
      sendMessage({
        type: "answer",
        answer,
        targetId,
        senderId: peerId,
      })
    } catch (error) {
      console.error("Error handling offer:", error)
      toast({
        title: "Error",
        description: "Failed to handle call offer",
        variant: "destructive",
      })
    }
  }

  const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
    console.log("Handling answer:", answer)

    try {
      if (peerConnection) {
        console.log("Setting remote description from answer...")
        await peerConnection.setRemoteDescription(answer)

        // Process queued ICE candidates
        console.log("Processing queued ICE candidates:", iceCandidatesQueue.length)
        for (const candidate of iceCandidatesQueue) {
          try {
            await peerConnection.addIceCandidate(candidate)
            console.log("Added queued ICE candidate")
          } catch (error) {
            console.error("Error adding queued ICE candidate:", error)
          }
        }
        setIceCandidatesQueue([])
      } else {
        console.error("No peer connection when handling answer")
      }
    } catch (error) {
      console.error("Error handling answer:", error)
    }
  }

  const handleIceCandidate = async (candidate: RTCIceCandidateInit) => {
    console.log("Handling ICE candidate:", candidate)

    try {
      if (peerConnection && peerConnection.remoteDescription) {
        console.log("Adding ICE candidate immediately")
        await peerConnection.addIceCandidate(candidate)
      } else {
        console.log("Queueing ICE candidate (no remote description yet)")
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
      console.log("Mute toggled:", !isMuted)
    }
  }

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = isVideoMuted
      })
      setIsVideoMuted(!isVideoMuted)
      console.log("Video toggled:", !isVideoMuted)
    }
  }

  const toggleDeafen = () => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = !isDeafened
      setIsDeafened(!isDeafened)
      console.log("Deafen toggled:", !isDeafened)
    }
  }

  const value: CallContextType = {
    callState,
    isVideoCall,
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
  }

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>
}
