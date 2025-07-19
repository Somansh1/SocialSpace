// Enhanced Speech Recognition with language support
export class SpeechRecognitionService {
  private recognition: any = null
  private isSupported = false
  private currentLanguage = "en-US"

  constructor() {
    this.initializeRecognition()
  }

  private initializeRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition()
      this.isSupported = true
      this.setupRecognition()
    } else {
      console.warn("Speech Recognition not supported in this browser")
      this.isSupported = false
    }
  }

  private setupRecognition() {
    if (!this.recognition) return

    this.recognition.continuous = true
    this.recognition.interimResults = true
    this.recognition.maxAlternatives = 3
    this.recognition.lang = this.currentLanguage
  }

  setLanguage(languageCode: string) {
    this.currentLanguage = languageCode
    if (this.recognition) {
      this.recognition.lang = languageCode
    }
  }

  start(
    onResult: (transcript: string, isFinal: boolean, confidence: number) => void,
    onError: (error: string) => void,
    onEnd: () => void,
  ): boolean {
    if (!this.isSupported || !this.recognition) {
      onError("Speech recognition not supported")
      return false
    }

    try {
      this.recognition.onresult = (event: any) => {
        let finalTranscript = ""
        let interimTranscript = ""

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          const transcript = result[0].transcript
          const confidence = result[0].confidence || 0

          if (result.isFinal) {
            finalTranscript += transcript
            onResult(transcript.trim(), true, confidence)
          } else {
            interimTranscript += transcript
            onResult(transcript.trim(), false, confidence)
          }
        }
      }

      this.recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error)
        onError(event.error)
      }

      this.recognition.onend = () => {
        onEnd()
      }

      this.recognition.start()
      return true
    } catch (error) {
      console.error("Failed to start speech recognition:", error)
      onError("Failed to start speech recognition")
      return false
    }
  }

  stop() {
    if (this.recognition) {
      this.recognition.stop()
    }
  }

  isRecognitionSupported(): boolean {
    return this.isSupported
  }

  // Language-specific recognition
  startChineseRecognition(
    onResult: (transcript: string, isFinal: boolean, confidence: number) => void,
    onError: (error: string) => void,
    onEnd: () => void,
  ): boolean {
    this.setLanguage("zh-CN")
    return this.start(onResult, onError, onEnd)
  }

  startHindiRecognition(
    onResult: (transcript: string, isFinal: boolean, confidence: number) => void,
    onError: (error: string) => void,
    onEnd: () => void,
  ): boolean {
    this.setLanguage("hi-IN")
    return this.start(onResult, onError, onEnd)
  }

  startEnglishRecognition(
    onResult: (transcript: string, isFinal: boolean, confidence: number) => void,
    onError: (error: string) => void,
    onEnd: () => void,
  ): boolean {
    this.setLanguage("en-US")
    return this.start(onResult, onError, onEnd)
  }
}

// Language codes for speech recognition
export const SPEECH_RECOGNITION_LANGUAGES = {
  "en-US": "English (US)",
  "en-GB": "English (UK)",
  "zh-CN": "Chinese (Mandarin)",
  "zh-TW": "Chinese (Traditional)",
  "hi-IN": "Hindi (India)",
  "es-ES": "Spanish (Spain)",
  "es-MX": "Spanish (Mexico)",
  "fr-FR": "French (France)",
  "de-DE": "German (Germany)",
  "ja-JP": "Japanese (Japan)",
  "ko-KR": "Korean (South Korea)",
  "ar-SA": "Arabic (Saudi Arabia)",
  "ru-RU": "Russian (Russia)",
  "pt-BR": "Portuguese (Brazil)",
  "it-IT": "Italian (Italy)",
} as const

export type SpeechLanguageCode = keyof typeof SPEECH_RECOGNITION_LANGUAGES
