import { useEffect, useRef, useCallback, useState } from 'react'

/* ================================================================== */
/*  Constants                                                          */
/* ================================================================== */

const WINDOW_MS   = 1500
const POLL_MS     = 100
const FADE_S      = 0.5    // single crossfade duration (exponential)
const FADE_MUTE_S = 0.5
const EMA_ALPHA   = 0.3
const EPS         = 0.001

const TIER_IDLE   = 0      // WPM = 0
const TIER_ACTIVE = 1      // WPM 1 – 50
const TIER_CLIMAX = 2      // WPM > 50

const GAIN_BASE = [0.55, 0.75, 1.0]

function tierForWpm(wpm, prevTier) {
  if (wpm <= 2) return TIER_IDLE
  if (wpm <= 50) return TIER_ACTIVE
  // hysteresis: exit climax only below 42
  if (prevTier === TIER_CLIMAX && wpm > 42) return TIER_CLIMAX
  if (wpm <= 50) return TIER_ACTIVE
  return TIER_CLIMAX
}

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
/*  Hook                                                               */
/* ================================================================== */

/**
 * @param {{ 0:string, 1:string, 2:string }} audioMap
 * @param {{ enabled?:boolean, masterVolume?:number, mode?:'dynamic'|'static', staticTier?:number }} opts
 */
export default function useAudioEngine(audioMap, {
  enabled = true,
  masterVolume = 0.75,
  mode = 'dynamic',
  staticTier = 0
} = {}) {
  const strikesRef    = useRef([])
  const gainsRef      = useRef(null)
  const elemsRef      = useRef(null)
  const tierRef       = useRef(TIER_IDLE)
  const smoothedRef   = useRef(0)
  const intervalRef   = useRef(null)
  const enabledRef    = useRef(enabled)
  const masterRef     = useRef(masterVolume)
  const modeRef       = useRef(mode)
  const audioMapRef   = useRef(audioMap)
  const xfadeIdRef    = useRef(0)   // guards against stale setTimeout
  enabledRef.current  = enabled
  masterRef.current   = masterVolume
  modeRef.current     = mode
  audioMapRef.current = audioMap

  const [currentTier, setCurrentTier] = useState(TIER_IDLE)

  function targetGain(tier) {
    return GAIN_BASE[tier] * masterRef.current
  }

  /* ----- crossfade (500ms exponential, reset to start) ----- */
  function crossfadeTo(from, to) {
    const ctx = _ctx
    if (!ctx) return
    const gains = gainsRef.current
    const elems = elemsRef.current
    if (!gains || !elems) return
    if (from === to) return

    const xid = ++xfadeIdRef.current

    if (from >= 0) {
      expRampTo(gains[from], 0, FADE_S)
      setTimeout(() => {
        if (xfadeIdRef.current !== xid) return // newer crossfade already ran
        try {
          gains[from].gain.setValueAtTime(0, _ctx?.currentTime ?? 0)
          elems[from].pause()
        } catch (_) {}
      }, FADE_S * 1000 + 60)
    }

    elems[to].currentTime = 0
    elems[to].play().catch(() => {})
    expRampTo(gains[to], targetGain(to), FADE_S)
  }

  function applyMasterVolume() {
    const gains = gainsRef.current
    if (!gains) return
    const tier = tierRef.current
    expRampTo(gains[tier], targetGain(tier), 0.3)
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
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
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

  /* ----- poll loop (dynamic mode only) ----- */
  function startPoll() {
    if (!_ctx || !gainsRef.current) return
    intervalRef.current = setInterval(() => {
      if (!enabledRef.current || modeRef.current !== 'dynamic') return

      const nowTs = Date.now()
      const strikes = strikesRef.current
      while (strikes.length && nowTs - strikes[0] > WINDOW_MS) strikes.shift()

      const rawWpm = (strikes.length / (WINDOW_MS / 1000)) * 60
      const prevSmooth = smoothedRef.current
      const nextSmooth = rawWpm * EMA_ALPHA + prevSmooth * (1 - EMA_ALPHA)
      smoothedRef.current = nextSmooth

      const prevTier = tierRef.current
      const nextTier = tierForWpm(nextSmooth, prevTier)
      if (nextTier !== prevTier) {
        tierRef.current = nextTier
        setCurrentTier(nextTier)
        crossfadeTo(prevTier, nextTier)
      }
    }, POLL_MS)
  }

  /* ----- init ----- */
  useEffect(() => {
    const ctx = getCtx()
    const map = audioMapRef.current

    const elems = [0, 1, 2].map((i) => {
      const a = new Audio(map[i])
      a.loop = true
      a.preload = 'auto'
      return a
    })
    elemsRef.current = elems

    const gains = elems.map((el) => {
      const src = ctx.createMediaElementSource(el)
      const g = ctx.createGain()
      g.gain.value = 0
      src.connect(g)
      g.connect(ctx.destination)
      return g
    })
    gainsRef.current = gains

    if (enabledRef.current) {
      elems[TIER_IDLE].play().catch(() => {})
      expRampTo(gains[TIER_IDLE], targetGain(TIER_IDLE), FADE_S)
      tierRef.current = TIER_IDLE
      smoothedRef.current = 0
      if (modeRef.current === 'dynamic') startPoll()
    }

    return () => {
      clearInterval(intervalRef.current)
      intervalRef.current = null
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
      _ctx = null
      gainsRef.current = null
      elemsRef.current = null
    }
  }, [])

  /* ----- react to URL changes per tier ----- */
  useEffect(() => {
    const elems = elemsRef.current
    const gains = gainsRef.current
    if (!elems || !gains) return
    for (let i = 0; i < 3; i++) {
      if (audioMap[i] && audioMap[i] !== elems[i].src) {
        const isActive = tierRef.current === i
        if (isActive) {
          expRampTo(gains[i], 0, FADE_S)
          setTimeout(() => {
            try { gains[i].gain.setValueAtTime(0, _ctx?.currentTime ?? 0) } catch (_) {}
            elems[i].src = audioMap[i]
            elems[i].load()
            elems[i].currentTime = 0
            elems[i].play().catch(() => {})
            expRampTo(gains[i], targetGain(i), FADE_S)
          }, FADE_S * 1000 + 50)
        } else {
          elems[i].src = audioMap[i]
          elems[i].load()
          if (!elems[i].paused) {
            elems[i].currentTime = 0
            elems[i].play().catch(() => {})
          }
        }
      }
    }
  }, [audioMap[0], audioMap[1], audioMap[2]])

  /* ----- react to enabled ----- */
  useEffect(() => {
    if (!gainsRef.current || !elemsRef.current) return
    if (enabled) unmuteAll()
    else muteAll()
  }, [enabled, muteAll, unmuteAll])

  /* ----- react to master volume ----- */
  useEffect(() => {
    if (!gainsRef.current || !elemsRef.current) return
    applyMasterVolume()
  }, [masterVolume])

  /* ----- react to mode or staticTier ----- */
  useEffect(() => {
    if (!gainsRef.current || !elemsRef.current) return
    if (mode === 'static') {
      // Kill poll loop
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      // Switch to static tier
      const prev = tierRef.current
      if (staticTier !== prev) {
        tierRef.current = staticTier
        setCurrentTier(staticTier)
        crossfadeTo(prev, staticTier)
      }
    } else {
      // Resume dynamic
      if (!intervalRef.current && enabledRef.current) startPoll()
    }
  }, [mode, staticTier])

  /* ----- public API ----- */
  const updateTypingStrike = useCallback(() => {
    if (!enabledRef.current) return
    strikesRef.current.push(Date.now())
  }, [])

  return { updateTypingStrike, currentTier }
}
