"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect, useRef } from "react"
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

  // Something worth saying in place (call failed, declined, no camera...). Shown by the call panel.
  callNotice: string | null
  clearCallNotice: () => void

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
  localVideoRef: React.RefObject<HTMLVideoElement | null>
  remoteVideoRef: React.RefObject<HTMLVideoElement | null>
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
  const [callNotice, setCallNotice] = useState<string | null>(null)

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const speechRecognitionRef = useRef<SpeechRecognitionService | null>(null)
  const translationServiceRef = useRef<FreeTranslationService | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)

  const { sendMessage, connectionState, registerMessageHandler } = useWebSocket()

  // Latest values for callbacks that outlive the render they were created in (the peer connection's
  // onconnectionstatechange, and the unmount cleanup). Reading the state variables there sees the first render's values.
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  peerConnectionRef.current = peerConnection
  const callStateRef = useRef(callState)
  callStateRef.current = callState
  const localStreamRef = useRef<MediaStream | null>(null)
  localStreamRef.current = localStream

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
        } else {
          setTranslationService("Offline phrases only")
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
      localStreamRef.current?.getTracks().forEach((track) => track.stop())
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
      setCallNotice("Camera or microphone is blocked. Allow access in your browser's site settings, then try again.")
    }
  }

  const setupAudioAnalysis = (stream: MediaStream) => {
    try {
      const audioContext: AudioContext = new (window.AudioContext || window.webkitAudioContext)()
      audioContextRef.current = audioContext
      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyserRef.current = analyser

      analyser.fftSize = 256
      source.connect(analyser)

      console.log("Audio analysis setup complete")
    } catch (error) {
      console.error("Error setting up audio analysis:", error)
    }
  }

  const startTranscription = () => {
    if (!speechRecognitionRef.current) {
      setCallNotice("Speech recognition is not available.")
      return
    }

    if (!speechRecognitionRef.current.isRecognitionSupported()) {
      setCallNotice("This browser cannot turn speech into text. Try Chrome or Edge.")
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
            transcribed: true, // extra field; older clients ignore it and still get the marked text
            targetId,
            senderId: peerId,
          })
        }
      },
      (error: string) => {
        console.error("Speech recognition error:", error)
        setIsTranscribing(false)
        setCallNotice(`Speech to text stopped: ${error}`)
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
    }
  }

  const stopTranscription = () => {
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.stop()
      setIsTranscribing(false)
      setTranscriptionConfidence(0)
      console.log("Speech transcription stopped")
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
        case "call-failed":
          setCallState("idle")
          setCallNotice(data.reason === "User not found" ? "Your friend is not at the table right now, so the call could not ring." : `The call failed: ${data.reason ?? "unknown reason"}`)
          break
        default:
          // Ignore other message types
          break
      }
    })

    return unregister
    // No dependency list on purpose: the handlers read peerConnection / localStream / ICE queue state, so they must be
    // re-registered after every render. With the old deps they stayed frozen on the first render, which made the
    // answerer build a second, track-less peer connection and the caller drop the answer.
  })

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
      } else if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        console.log("Call disconnected or failed")
        if (pc.connectionState === "failed") setCallNotice("The call dropped because the two of you could not stay connected.")
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
    setCallNotice(null)

    if (connectionState !== "connected") {
      setCallNotice("Not connected to the server, so the call cannot ring yet.")
      return
    }

    if (!localStream) {
      console.log("No local stream, initializing...")
      await initializeLocalMedia()
      // Wait a bit for stream to be set
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    if (!localStream) {
      setCallNotice("Your camera and microphone are not available, so the call cannot start.")
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
    setCallNotice(null)
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
      setCallNotice("Could not pick up the call: " + (error as Error).message)
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
      setCallNotice("Could not set up the call.")
    }
  }

  const handleCallRejected = () => {
    console.log("Call was rejected")
    setCallState("idle")
    setCallNotice("They declined the call.")
  }

  const endCall = () => {
    console.log("Ending call")
    if (callStateRef.current !== "idle") {
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
    const pc = peerConnectionRef.current
    if (pc) {
      pc.close()
      peerConnectionRef.current = null
      setPeerConnection(null)
    }

    // Stop transcription
    stopTranscription()

    setCallState("idle")
    setRemoteStream(null)
    setIceCandidatesQueue([])
    setIsInitiator(false)
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
      setCallNotice("Could not set up the call.")
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
    callNotice,
    clearCallNotice: () => setCallNotice(null),
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
