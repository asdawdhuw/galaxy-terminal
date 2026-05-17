import { useEffect, useRef, useCallback, useState } from 'react'

/* ================================================================== */
/*  Constants                                                          */
/* ================================================================== */

const POLL_MS        = 100      // state-check tick
const FADE_OUT_S     = 0.8      // old-track exponential fade-out
const FADE_IN_S      = 1.0      // new-track exponential fade-in
const FADE_MUTE_S    = 0.5
const EPS            = 0.001
const MIN_STATE_MS   = 1200     // minimum time before allowing another auto-switch

// IKD noise gate — delta below this is key-repeat / sticky-key junk
const NOISE_DELTA_MS = 150

// Fast-typing threshold for streak counting (delta < 600ms ≈ WPM > 100)
const FAST_DELTA_MS  = 600
const FAST_STREAK_N  = 5        // consecutive fast strikes required for Climax

// Asymmetric EMA — slow climb, inertial decay
const EMA_RISE       = 0.2
const EMA_FALL       = 0.1
const EMA_DECAY      = 0.04     // per-tick decay when idle > 600ms

// 3 tiers with high-entry low-exit hysteresis
const TIER_IDLE      = 0
const TIER_ACTIVE    = 1
const TIER_CLIMAX    = 2

const CLIMAX_ENTER   = 90       // smoothed WPM must exceed this to enter Climax
const CLIMAX_EXIT    = 70       // smoothed WPM must drop below this to leave Climax
const IDLE_ENTER     = 2        // smoothed WPM ≤ this → Idle

const GAIN_BASE = [0.55, 0.75, 1.0]

/* ================================================================== */
/*  Singleton AudioContext                                             */
/* ================================================================== */

let _ctx = null
function getCtx() {
  if (!_ctx) _ctx = new AudioContext()
  if (_ctx.state === 'suspended') _ctx.resume()
  return _ctx
}

/* ================================================================== */
/*  Exponential ramp helper                                            */
/* ================================================================== */

function expRampTo(gain, target, dur) {
  const ctx = _ctx
  if (!ctx) return
  const now = ctx.currentTime
  gain.gain.cancelScheduledValues(now)
  gain.gain.setValueAtTime(gain.gain.value, now)
  gain.gain.exponentialRampToValueAtTime(Math.max(EPS, target), now + dur)
}

/* ================================================================== */
/*  Tier decision                                                      */
/* ================================================================== */

function decideTier(smoothed, prevTier, fastStreak) {
  if (smoothed <= IDLE_ENTER) return TIER_IDLE

  // Enter Climax: must exceed 90 AND have 5+ consecutive fast strikes
  if (smoothed > CLIMAX_ENTER && fastStreak >= FAST_STREAK_N) return TIER_CLIMAX

  // Stay in Climax (hysteresis): exit only below 70
  if (prevTier === TIER_CLIMAX && smoothed >= CLIMAX_EXIT) return TIER_CLIMAX

  return TIER_ACTIVE
}

/* ================================================================== */
/*  Hook                                                               */
/* ================================================================== */

export default function useAudioEngine(audioMap, {
  enabled = true,
  masterVolume = 0.75,
  mode = 'dynamic',
  staticTier = 0
} = {}) {
  /* ---- IKD state ---- */
  const lastStrikeRef   = useRef(0)       // ms timestamp of previous valid keystroke
  const fastStreakRef   = useRef(0)       // consecutive strikes with delta < FAST_DELTA_MS
  const smoothedRef     = useRef(0)       // EMA-smoothed WPM

  /* ---- audio state ---- */
  const gainsRef        = useRef(null)
  const elemsRef        = useRef(null)
  const tierRef         = useRef(TIER_IDLE)
  const lastSwitchRef   = useRef(0)
  const intervalRef     = useRef(null)
  const enabledRef      = useRef(enabled)
  const masterRef       = useRef(masterVolume)
  const modeRef         = useRef(mode)
  const audioMapRef     = useRef(audioMap)
  const xfadeIdRef      = useRef(0)
  enabledRef.current    = enabled
  masterRef.current     = masterVolume
  modeRef.current       = mode
  audioMapRef.current   = audioMap

  const [currentTier, setCurrentTier] = useState(TIER_IDLE)

  function targetGain(tier) { return GAIN_BASE[tier] * masterRef.current }

  /* ----- crossfade ----- */
  function crossfadeTo(from, to) {
    const ctx = _ctx
    if (!ctx) return
    const gains = gainsRef.current
    const elems = elemsRef.current
    if (!gains || !elems) return
    if (from === to) return

    const xid = ++xfadeIdRef.current

    if (from >= 0) {
      expRampTo(gains[from], 0, FADE_OUT_S)
      setTimeout(() => {
        if (xfadeIdRef.current !== xid) return
        try {
          gains[from].gain.setValueAtTime(0, _ctx?.currentTime ?? 0)
          elems[from].pause()
        } catch (_) {}
      }, FADE_OUT_S * 1000 + 60)
    }

    elems[to].currentTime = 0
    elems[to].play().catch(() => {})
    expRampTo(gains[to], targetGain(to), FADE_IN_S)
  }

  function applyMasterVolume() {
    const gains = gainsRef.current
    if (!gains) return
    expRampTo(gains[tierRef.current], targetGain(tierRef.current), 0.3)
  }

  /* ----- mute / unmute ----- */
  const muteAll = useCallback(() => {
    const gains = gainsRef.current
    const elems = elemsRef.current
    if (!gains || !elems) return
    for (let i = 0; i < 3; i++) expRampTo(gains[i], 0, FADE_MUTE_S)
    setTimeout(() => {
      elems.forEach((el) => { try { el.pause() } catch (_) {} })
    }, FADE_MUTE_S * 1000 + 80)
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
  }, [])

  const unmuteAll = useCallback(() => {
    const gains = gainsRef.current
    const elems = elemsRef.current
    if (!gains || !elems) return
    const tier = tierRef.current
    elems[tier].currentTime = 0
    elems[tier].play().catch(() => {})
    expRampTo(gains[tier], targetGain(tier), FADE_MUTE_S)
    if (modeRef.current === 'dynamic' && !intervalRef.current) startPoll()
  }, [])

  /* ================================================================== */
  /*  IKD Engine — poll loop                                            */
  /* ================================================================== */

  function startPoll() {
    if (!_ctx || !gainsRef.current) return
    intervalRef.current = setInterval(() => {
      if (!enabledRef.current || modeRef.current !== 'dynamic') return

      const nowTs = Date.now()
      let smoothed = smoothedRef.current

      // --- decay: if no strike for >600ms, slowly bleed WPM toward 0 ---
      const idleMs = nowTs - lastStrikeRef.current
      if (idleMs > 600 && smoothed > 0) {
        smoothed = smoothed * (1 - EMA_DECAY)
        if (smoothed < 0.5) { smoothed = 0; fastStreakRef.current = 0 }
        smoothedRef.current = smoothed
      }

      // --- tier decision ---
      const prevTier = tierRef.current
      const nextTier = decideTier(smoothed, prevTier, fastStreakRef.current)

      if (nextTier !== prevTier && nowTs - lastSwitchRef.current >= MIN_STATE_MS) {
        lastSwitchRef.current = nowTs
        tierRef.current = nextTier
        setCurrentTier(nextTier)
        crossfadeTo(prevTier, nextTier)
      }
    }, POLL_MS)
  }

  /* ================================================================== */
  /*  IKD Engine — keystroke handler (called from term.onData)          */
  /* ================================================================== */

  const updateTypingStrike = useCallback(() => {
    if (!enabledRef.current || modeRef.current !== 'dynamic') return

    const now = Date.now()
    const prev = lastStrikeRef.current
    lastStrikeRef.current = now

    if (prev === 0) return  // first strike — no delta yet

    const delta = now - prev
    const prevSmooth = smoothedRef.current

    let instantWpm

    if (delta < NOISE_DELTA_MS) {
      // Key-repeat / sticky-key noise — clamp to current smoothed value
      // so this event cannot pull the curve upward
      instantWpm = prevSmooth
      // Noise breaks the fast streak
      fastStreakRef.current = 0
    } else {
      // IKD → instantaneous WPM  (e.g. delta=500ms → 120 WPM)
      instantWpm = 60000 / delta

      // Fast streak tracking
      if (delta < FAST_DELTA_MS) {
        fastStreakRef.current++
      } else {
        fastStreakRef.current = 0
      }
    }

    // Asymmetric EMA — slow climb, inertial decay
    const alpha = instantWpm >= prevSmooth ? EMA_RISE : EMA_FALL
    const nextSmooth = instantWpm * alpha + prevSmooth * (1 - alpha)
    smoothedRef.current = nextSmooth
  }, [])

  /* ================================================================== */
  /*  Init / destroy / react effects (unchanged)                         */
  /* ================================================================== */

  useEffect(() => {
    const ctx = getCtx()
    const map = audioMapRef.current

    const elems = [0, 1, 2].map((i) => {
      const a = new Audio(map[i])
      a.loop = true; a.preload = 'auto'
      return a
    })
    elemsRef.current = elems

    const gains = elems.map((el) => {
      const src = ctx.createMediaElementSource(el)
      const g = ctx.createGain()
      g.gain.value = 0
      src.connect(g); g.connect(ctx.destination)
      return g
    })
    gainsRef.current = gains

    if (enabledRef.current) {
      elems[TIER_IDLE].play().catch(() => {})
      expRampTo(gains[TIER_IDLE], targetGain(TIER_IDLE), FADE_IN_S)
      tierRef.current = TIER_IDLE
      smoothedRef.current = 0
      if (modeRef.current === 'dynamic') startPoll()
    }

    return () => {
      clearInterval(intervalRef.current); intervalRef.current = null
      if (!ctx) return
      const now = ctx.currentTime
      gains.forEach((g) => {
        g.gain.cancelScheduledValues(now)
        g.gain.setValueAtTime(g.gain.value, now)
        g.gain.exponentialRampToValueAtTime(EPS, now + 0.15)
      })
      setTimeout(() => {
        elems.forEach((el) => { el.pause(); el.src = '' })
        gains.forEach((g) => g.disconnect())
      }, 200)
      ctx.close().catch(() => {})
      _ctx = null; gainsRef.current = null; elemsRef.current = null
    }
  }, [])

  useEffect(() => {
    const elems = elemsRef.current, gains = gainsRef.current
    if (!elems || !gains) return
    for (let i = 0; i < 3; i++) {
      if (audioMap[i] && audioMap[i] !== elems[i].src) {
        const isActive = tierRef.current === i
        if (isActive) {
          expRampTo(gains[i], 0, FADE_OUT_S)
          setTimeout(() => {
            try { gains[i].gain.setValueAtTime(0, _ctx?.currentTime ?? 0) } catch (_) {}
            elems[i].src = audioMap[i]; elems[i].load()
            elems[i].currentTime = 0; elems[i].play().catch(() => {})
            expRampTo(gains[i], targetGain(i), FADE_IN_S)
          }, FADE_OUT_S * 1000 + 50)
        } else {
          elems[i].src = audioMap[i]; elems[i].load()
          if (!elems[i].paused) { elems[i].currentTime = 0; elems[i].play().catch(() => {}) }
        }
      }
    }
  }, [audioMap[0], audioMap[1], audioMap[2]])

  useEffect(() => {
    if (!gainsRef.current || !elemsRef.current) return
    if (enabled) unmuteAll(); else muteAll()
  }, [enabled, muteAll, unmuteAll])

  useEffect(() => {
    if (!gainsRef.current || !elemsRef.current) return
    applyMasterVolume()
  }, [masterVolume])

  useEffect(() => {
    if (!gainsRef.current || !elemsRef.current) return
    if (mode === 'static') {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
      const prev = tierRef.current
      if (staticTier !== prev) {
        tierRef.current = staticTier; setCurrentTier(staticTier)
        crossfadeTo(prev, staticTier)
      }
    } else {
      if (!intervalRef.current && enabledRef.current) startPoll()
    }
  }, [mode, staticTier])

  return { updateTypingStrike, currentTier }
}
