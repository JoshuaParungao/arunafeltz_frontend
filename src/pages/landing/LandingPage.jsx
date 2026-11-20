import { useEffect, useRef, useState } from "react"
import landingBanner from "../../assets/landing-banner.jpg"

export default function LandingPage({ onOpenLogin }) {
  const [tapProgress, setTapProgress] = useState(0)
  const tapCountRef = useRef(0)
  const lastTapTimeRef = useRef(0)
  const longPressTimerRef = useRef(null)

  // Desktop shortcut: Alt + O / Alt + o
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.altKey && (e.key === "o" || e.key === "O" || e.code === "KeyO")) {
        e.preventDefault()
        if (typeof onOpenLogin === "function") {
          onOpenLogin()
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onOpenLogin])

  // Mobile / Tablet touch gesture: 3 taps then long press
  const handleTouchStart = () => {
    const now = Date.now()
    const timeSinceLastTap = now - lastTapTimeRef.current

    // Reset tap count if more than 1.5s passed since previous tap
    if (timeSinceLastTap > 1500) {
      tapCountRef.current = 0
      setTapProgress(0)
    }

    // If user already tapped 3 times (or 2 times) and is now holding
    if (tapCountRef.current >= 3 || tapCountRef.current === 2) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current)
      }

      longPressTimerRef.current = setTimeout(() => {
        try {
          if (navigator?.vibrate) {
            navigator.vibrate([40, 60, 40])
          }
        } catch {
          // Ignore vibration error
        }
        if (typeof onOpenLogin === "function") {
          onOpenLogin()
        }
      }, 650)
    }
  }

  const handleTouchEnd = () => {
    const now = Date.now()

    // If a long press was running but finger was released before completing
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }

    // Register a tap if previous tap was within acceptable threshold
    if (now - lastTapTimeRef.current < 1500 || tapCountRef.current === 0) {
      tapCountRef.current += 1
      lastTapTimeRef.current = now
      setTapProgress(tapCountRef.current)

      // Auto-reset progress indicator after 2.5s of inactivity
      setTimeout(() => {
        if (Date.now() - lastTapTimeRef.current >= 2400) {
          tapCountRef.current = 0
          setTapProgress(0)
        }
      }, 2500)
    } else {
      tapCountRef.current = 1
      lastTapTimeRef.current = now
      setTapProgress(1)
    }
  }

  const handleTouchCancel = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  return (
    <main
      className="relative flex min-h-svh w-full flex-col items-center justify-center overflow-x-hidden bg-gradient-to-b from-slate-950 via-[#0d0406] to-slate-950 p-2 sm:p-4 select-none touch-manipulation"
      onTouchCancel={handleTouchCancel}
      onTouchEnd={handleTouchEnd}
      onTouchStart={handleTouchStart}
    >
      {/* Background Atmosphere */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(139,26,42,0.18),transparent_70%)]" />

      {/* Main Banner Container */}
      <div className="relative z-10 w-full max-w-6xl overflow-hidden rounded-2xl sm:rounded-3xl border border-red-950/40 bg-slate-900/60 shadow-2xl backdrop-blur-xs transition hover:border-red-900/60">
        <img
          alt="Arunafeltz Computer Parts and Accessories Shop - San Fernando & Mabalacat Branches"
          className="h-auto w-full object-contain shadow-inner"
          draggable={false}
          src={landingBanner}
        />
      </div>

      {/* Discreet Touch Cue on Mobile / Tablet (Only faintly visible when tapped) */}
      {tapProgress > 0 && tapProgress < 4 ? (
        <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 opacity-30 transition-opacity">
          {[1, 2, 3].map((step) => (
            <span
              key={step}
              className={`size-1.5 rounded-full transition-all ${
                tapProgress >= step ? "bg-red-500 scale-125" : "bg-slate-600"
              }`}
            />
          ))}
        </div>
      ) : null}
    </main>
  )
}
