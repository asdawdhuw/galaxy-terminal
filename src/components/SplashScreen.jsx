import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import startSound from '../../startSound3.mp3'

// Preload at module level — loads while JS bundle parses, not when splash mounts
const audio = new Audio(startSound)
audio.preload = 'auto'
audio.volume = 0.75

const SUBTITLE = 'A COSMIC COMMAND CENTRE'

function genStars(count) {
  const tiers = [
    { min: 0.6, max: 1.2, opacity: [0.08, 0.25], dur: [2.5, 4.5], pct: 0.5  }, // dust
    { min: 1.2, max: 2.2, opacity: [0.2,  0.5],  dur: [1.8, 3.2], pct: 0.3  }, // mid
    { min: 2.2, max: 3.2, opacity: [0.35, 0.7], dur: [1.2, 2.2], pct: 0.2  }, // bright
  ]
  const stars = []
  for (let i = 0; i < count; i++) {
    const r = Math.random()
    let tier
    if (r < 0.5) tier = tiers[0]
    else if (r < 0.8) tier = tiers[1]
    else tier = tiers[2]

    stars.push({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: tier.min + Math.random() * (tier.max - tier.min),
      delay: Math.random() * 3,
      duration: tier.dur[0] + Math.random() * (tier.dur[1] - tier.dur[0]),
      baseOpacity: tier.opacity[0] + Math.random() * (tier.opacity[1] - tier.opacity[0]),
    })
  }
  return stars
}

export default function SplashScreen({ onDone }) {
  const stars = useMemo(() => genStars(72), [])
  const [typed, setTyped] = useState('')
  const [cursorOn, setCursorOn] = useState(true)
  const [typing, setTyping] = useState(true)

  // Typewriter
  useEffect(() => {
    let i = 0
    const iv = setInterval(() => {
      if (i < SUBTITLE.length) {
        setTyped(SUBTITLE.slice(0, i + 1))
        i++
      } else {
        setTyping(false)
        clearInterval(iv)
      }
    }, 55)
    return () => clearInterval(iv)
  }, [])

  // Cursor blink cycle (starts after typing finishes)
  useEffect(() => {
    if (typing) return
    let count = 0
    const iv = setInterval(() => {
      setCursorOn((v) => !v)
      count++
      if (count >= 8) clearInterval(iv) // 4 full blinks, then stays off
    }, 250)
    return () => clearInterval(iv)
  }, [typing])

  // Startup sound — useLayoutEffect fires before paint, earlier than useEffect
  useLayoutEffect(() => {
    audio.currentTime = 0
    audio.play().catch(() => {})
    return () => {
      // Quick fade-out on unmount
      if (audio.paused) return
      const step = () => {
        if (audio.volume > 0.03) {
          audio.volume = Math.max(0, audio.volume - 0.06)
          requestAnimationFrame(step)
        } else {
          audio.pause()
          audio.currentTime = 0
        }
      }
      step()
    }
  }, [])

  // Dismiss
  useEffect(() => {
    const t = setTimeout(onDone, 4000)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className="splash-overlay">
      {/* Nebula glow layers — deep-space depth */}
      <div className="nebula nebula-a" />
      <div className="nebula nebula-b" />
      <div className="nebula nebula-c" />

      {/* Starfield */}
      {stars.map((s, i) => (
        <span
          key={i}
          className="splash-star"
          style={{
            left: `${s.x}vw`,
            top: `${s.y}vh`,
            width: s.size,
            height: s.size,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
            opacity: s.baseOpacity,
          }}
        />
      ))}

      {/* Galaxy centrepiece */}
      <div className="galaxy-container">
        {/* Orbital particle dots — small luminous bodies racing along the rings */}
        <div className="orbit-ring ring-r1">
          <span className="orbit-dot" />
        </div>
        <div className="orbit-ring ring-r2">
          <span className="orbit-dot" />
        </div>
        <div className="orbit-ring ring-r3">
          <span className="orbit-dot" />
        </div>

        {/* Spiral arms */}
        <div className="galaxy-arm arm-1" />
        <div className="galaxy-arm arm-2" />
        <div className="galaxy-arm arm-3" />
        <div className="galaxy-arm arm-4" />

        {/* Core */}
        <div className="galaxy-core">
          <div className="core-mid" />
          <div className="core-hot" />
        </div>
      </div>

      {/* Titles */}
      <div className="splash-title-wrap">
        <h1 className="splash-title">GALAXY TERMINAL</h1>
        <p className="splash-sub">
          {typed}
          {cursorOn && <span className="splash-cursor">|</span>}
        </p>
      </div>
    </div>
  )
}
