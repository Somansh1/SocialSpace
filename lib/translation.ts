// Simplified Google Translate to English Only
interface TranslationResult {
  translatedText: string
  detectedLanguage?: string
  confidence?: number
  service?: string
}

export class FreeTranslationService {
  private primaryEndpoint = "https://clients5.google.com/translate_a/t"
  private fallbackEndpoint = "https://translate.googleapis.com/translate_a/single"

  constructor() {
    console.log("Initialized Google Translate to English Service")
  }

  // Main translation method - Always translates to English
  async translateToEnglish(text: string): Promise<TranslationResult | null> {
    // Try primary Google endpoint first
    console.log("Translating to English:", text)
    let result = await this.translateWithGooglePrimary(text)

    if (result && result.translatedText && result.translatedText !== text) {
      console.log(`Translation successful with ${result.service}`)
      return result
    }

    // Try fallback Google endpoint
    console.log("Trying Google Translate Fallback endpoint...")
    result = await this.translateWithGoogleFallback(text)

    if (result && result.translatedText && result.translatedText !== text) {
      console.log(`Translation successful with ${result.service}`)
      return result
    }

    // Final fallback - check if it's already English
    if (this.isEnglishText(text)) {
      return {
        translatedText: text,
        detectedLanguage: "en",
        confidence: 0.9,
        service: "Already English",
      }
    }

    console.error("All Google Translate endpoints failed")
    return null
  }

  // Primary Google Translate API (clients5.google.com) - Always to English
  private async translateWithGooglePrimary(text: string): Promise<TranslationResult | null> {
    try {
      const q = encodeURIComponent(text)
      const url = `${this.primaryEndpoint}?client=dict-chrome-ex&sl=auto&tl=en&q=${q}`

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          Referer: "https://translate.google.com/",
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "en-US,en;q=0.9",
        },
      })

      if (!response.ok) {
        throw new Error(`Google Translate Primary API error: ${response.status} - ${response.statusText}`)
      }

      const data = await response.json()

      // Parse response format for clients5 endpoint
      if (data && data.sentences && data.sentences.length > 0) {
        // Extract translation from sentences array
        const translatedText = data.sentences
          .map((sentence: any) => sentence.trans)
          .join("")
          .trim()

        // Get detected source language
        const detectedLanguage = data.src || "unknown"

        // Get confidence score
        const confidence = data.confidence || data.ld_result?.srclangs_confidences?.[0] || 0.9

        return {
          translatedText,
          detectedLanguage,
          confidence,
          service: "Google Translate (Primary)",
        }
      } else {
        throw new Error("Invalid response format from Google Translate Primary")
      }
    } catch (error) {
      console.error("Google Translate Primary API failed:", error)
      return null
    }
  }

  // Fallback Google Translate API (translate.googleapis.com) - Always to English
  private async translateWithGoogleFallback(text: string): Promise<TranslationResult | null> {
    try {
      const q = encodeURIComponent(text)
      const url = `${this.fallbackEndpoint}?client=gtx&dt=t&sl=auto&tl=en&q=${q}`

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          Referer: "https://translate.google.com/",
          Accept: "application/json, text/plain, */*",
        },
      })

      if (!response.ok) {
        throw new Error(`Google Translate Fallback API error: ${response.status} - ${response.statusText}`)
      }

      const data = await response.json()

      // Parse Google Translate response format
      if (data && data[0] && data[0][0] && data[0][0][0]) {
        const translatedText = data[0]
          .map((item: any) => item[0])
          .join("")
          .trim()
        const detectedLanguage = data[2] || "unknown"

        return {
          translatedText,
          detectedLanguage,
          confidence: 0.9,
          service: "Google Translate (Fallback)",
        }
      } else {
        throw new Error("Invalid response format from Google Translate Fallback")
      }
    } catch (error) {
      console.error("Google Translate Fallback API failed:", error)
      return null
    }
  }

  // Simple check if text is already in English
  private isEnglishText(text: string): boolean {
    // Check for non-Latin scripts
    const nonLatinRegex =
      /[\u4e00-\u9fff\u0900-\u097f\u0600-\u06ff\u0400-\u04ff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/
    return !nonLatinRegex.test(text)
  }

  // Check Google Translate service availability
  async checkServiceHealth(): Promise<Record<string, boolean>> {
    const health: Record<string, boolean> = {}

    // Test primary Google endpoint
    try {
      const response = await fetch(`${this.primaryEndpoint}?client=dict-chrome-ex&sl=auto&tl=en&q=hello`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Referer: "https://translate.google.com/",
        },
      })
      health["google-primary"] = response.ok
    } catch {
      health["google-primary"] = false
    }

    // Test fallback Google endpoint
    try {
      const response = await fetch(`${this.fallbackEndpoint}?client=gtx&dt=t&sl=auto&tl=en&q=hello`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Referer: "https://translate.google.com/",
        },
      })
      health["google-fallback"] = response.ok
    } catch {
      health["google-fallback"] = false
    }

    return health
  }

  // Legacy method names for compatibility
  async translateTextUsingFreeServices(text: string): Promise<TranslationResult | null> {
    return this.translateToEnglish(text)
  }

  async translateChineseToEnglish(text: string): Promise<string | null> {
    const result = await this.translateToEnglish(text)
    return result?.translatedText || null
  }

  async translateHindiToEnglish(text: string): Promise<string | null> {
    const result = await this.translateToEnglish(text)
    return result?.translatedText || null
  }

  async autoTranslateToEnglish(text: string): Promise<{
    translatedText: string
    sourceLanguage: string
    confidence?: number
    service?: string
  } | null> {
    const result = await this.translateToEnglish(text)
    if (result) {
      return {
        translatedText: result.translatedText,
        sourceLanguage: result.detectedLanguage || "unknown",
        confidence: result.confidence,
        service: result.service,
      }
    }
    return null
  }
}

// Language codes and names for display
export const SUPPORTED_LANGUAGES = {
  zh: "Chinese",
  hi: "Hindi",
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  ja: "Japanese",
  ko: "Korean",
  ar: "Arabic",
  ru: "Russian",
  pt: "Portuguese",
  it: "Italian",
  nl: "Dutch",
  sv: "Swedish",
  da: "Danish",
  no: "Norwegian",
  fi: "Finnish",
  pl: "Polish",
  tr: "Turkish",
  th: "Thai",
  vi: "Vietnamese",
} as const

export type LanguageCode = keyof typeof SUPPORTED_LANGUAGES

export function getLanguageName(code: string): string {
  return SUPPORTED_LANGUAGES[code as LanguageCode] || code.toUpperCase()
}

// Offline translation for common phrases (as final fallback)
export const OFFLINE_TRANSLATIONS: Record<string, string> = {
  你好: "Hello",
  再见: "Goodbye",
  谢谢: "Thank you",
  是: "Yes",
  不: "No",
  नमस्ते: "Hello",
  अलविदा: "Goodbye",
  धन्यवाद: "Thank you",
  हाँ: "Yes",
  नहीं: "No",
  bonjour: "Hello",
  "au revoir": "Goodbye",
  merci: "Thank you",
  oui: "Yes",
  non: "No",
  hola: "Hello",
  adiós: "Goodbye",
  gracias: "Thank you",
  sí: "Yes",
  no: "No",
}

export function getOfflineTranslation(text: string): string | null {
  const cleanText = text.toLowerCase().trim()
  return OFFLINE_TRANSLATIONS[cleanText] || OFFLINE_TRANSLATIONS[text] || null
}
