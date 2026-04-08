import { useEffect, useCallback, useRef } from "react"
import { useAuthStore } from "@/store/auth-store"
import {
  GOOGLE_GSI_SCRIPT_URL,
  GOOGLE_BUTTON_WIDTH,
  IDLE_CALLBACK_TIMEOUT_MS,
  SCRIPT_LOAD_FALLBACK_DELAY_MS,
} from "@/lib/constants"
import type { GoogleCredentialResponse } from "@/types"

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ""

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void
          renderButton: (element: HTMLElement, config: Record<string, unknown>) => void
          prompt: () => void
          revoke: (email: string, callback: () => void) => void
          cancel: () => void
        }
      }
    }
  }
}

let scriptLoaded = false

export function useGoogleAuth(buttonRef: React.RefObject<HTMLDivElement | null>) {
  const setUser = useAuthStore((s) => s.setUser)
  const user = useAuthStore((s) => s.user)
  const initializedRef = useRef(false)

  const handleCredentialResponse = useCallback(
    async (response: GoogleCredentialResponse) => {
      try {
        const res = await fetch("/api/auth/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ credential: response.credential }),
        })
        if (res.ok) setUser(await res.json())
      } catch { /* silently handle */ }
    },
    [setUser]
  )

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || user) return

    function initGoogle() {
      if (initializedRef.current) return
      initializedRef.current = true

      window.google?.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
      })

      if (buttonRef.current) {
        buttonRef.current.innerHTML = ""
        window.google?.accounts.id.renderButton(buttonRef.current, {
          theme: "filled_black",
          size: "large",
          width: GOOGLE_BUTTON_WIDTH,
          shape: "pill",
          text: "signin_with",
        })
      }
    }

    if (scriptLoaded && window.google) {
      initGoogle()
      return
    }

    const existing = document.querySelector(`script[src*="accounts.google.com/gsi/client"]`)
    if (existing) {
      if (window.google) initGoogle()
      else existing.addEventListener("load", initGoogle)
      return
    }

    const loadScript = () => {
      const script = document.createElement("script")
      script.src = GOOGLE_GSI_SCRIPT_URL
      script.async = true
      script.defer = true
      script.onload = () => {
        scriptLoaded = true
        initGoogle()
      }
      document.head.appendChild(script)
    }

    if ("requestIdleCallback" in window) {
      requestIdleCallback(loadScript, { timeout: IDLE_CALLBACK_TIMEOUT_MS })
    } else {
      setTimeout(loadScript, SCRIPT_LOAD_FALLBACK_DELAY_MS)
    }
  }, [handleCredentialResponse, buttonRef, user])

  useEffect(() => {
    if (user) {
      initializedRef.current = false
      if (buttonRef.current) buttonRef.current.innerHTML = ""
    }
  }, [user, buttonRef])
}
