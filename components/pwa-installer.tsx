"use client"

import { useState, useEffect } from "react"
import { Download, X } from "lucide-react"

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export function PWAInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    // --- START: Added Code for Service Worker Registration ---
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            console.log("Service Worker registered: ", registration)
          })
          .catch((registrationError) => {
            console.log("Service Worker registration failed: ", registrationError)
          })
      })
    }
    // --- END: Added Code for Service Worker Registration ---

    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    setIsIOS(iOS)

    const isStandalone = window.matchMedia("(display-mode: standalone)").matches
    if (isStandalone) return

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShowInstallPrompt(true)
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)

    if (iOS && !isStandalone) {
      setTimeout(() => setShowInstallPrompt(true), 3000)
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === "accepted") {
        setDeferredPrompt(null)
        setShowInstallPrompt(false)
      }
    }
  }

  const handleDismiss = () => {
    setShowInstallPrompt(false)
    setDeferredPrompt(null)
  }

  if (!showInstallPrompt) return null

  return (
    <div className="fixed bottom-24 left-4 right-4 z-50 md:bottom-4 md:left-auto md:right-4 md:w-80" role="region" aria-label="Install SocialSpace">
      <div className="kt-panel p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <h3 className="mb-1 font-display text-lg font-semibold">Keep a seat saved</h3>
            {isIOS ? (
              <p className="mb-1 text-sm text-mute">Tap Share, then Add to Home Screen.</p>
            ) : (
              <p className="mb-3 text-sm text-mute">Install SocialSpace so it opens like any other app.</p>
            )}
            {!isIOS && (
              <button onClick={handleInstallClick} className="kt-btn kt-btn-primary kt-btn-sm">
                <Download className="h-4 w-4" aria-hidden />
                Install
              </button>
            )}
          </div>
          <button onClick={handleDismiss} className="kt-btn kt-btn-sm min-w-[44px] px-2" aria-label="Dismiss install prompt">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  )
}
