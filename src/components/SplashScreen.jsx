import { useEffect, useMemo } from 'react'

// Pre-generate starfield: each star has stable random position / size / timing
function genStars(count) {
  const stars = []
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * 360
    const dist = 20 + Math.random() * 42  // vw
    stars.push({
      x: 50 + Math.cos((angle * Math.PI) / 180) * dist, // vw
      y: 50 + Math.sin((angle * Math.PI) / 180) * dist, // vh
      size: Math.random() * 2.5 + 0.8,                   // px
      delay: Math.random() * 2.2,                         // s
      duration: 1.5 + Math.random() * 2.5,                // s
      opacity: 0.15 + Math.random() * 0.5
    })
  }
  return stars
}

export default function SplashScreen({ onDone }) {
  const stars = useMemo(() => genStars(55), [])

  useEffect(() => {
    const t = setTimeout(onDone, 2800)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className="splash-overlay">
      {/* Galaxy spiral arms */}
      <div className="galaxy-container">
        <div className="galaxy-arm arm-1" />
        <div className="galaxy-arm arm-2" />
        <div className="galaxy-arm arm-3" />
        <div className="galaxy-arm arm-4" />
        {/* Core */}
        <div className="galaxy-core">
          <div className="core-inner" />
        </div>
      </div>

      {/* Starfield particles */}
      {stars.map((s, i) => (
        <span
          key={i}
          className="star-dot"
          style={{
            left: `${s.x}vw`,
            top: `${s.y}vh`,
            width: s.size,
            height: s.size,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
            opacity: s.opacity
          }}
        />
      ))}

      {/* Title */}
      <div className="splash-title-wrap">
        <h1 className="splash-title">GALAXY TERMINAL</h1>
        <p className="splash-sub">a cosmic command centre</p>
      </div>
    </div>
  )
}
