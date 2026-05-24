import { useEffect, useRef } from 'react'

const STAR_COUNT = 220
const BREATHE_RATIO = 0.15
const METEOR_CHANCE = 0.01
const METEOR_LENGTH_MIN = 60
const METEOR_LENGTH_MAX = 120

export default function Starfield() {
  const canvasRef = useRef(null)
  const starsRef = useRef([])
  const meteorsRef = useRef([])
  const animRef = useRef(0)
  const timeRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    const init = () => {
      resize()

      // 220 stars with random params
      starsRef.current = Array.from({ length: STAR_COUNT }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: 0.3 + Math.random() * 1.5,
        opacity: 0.2 + Math.random() * 0.8,
        speed: 0.05 + Math.random() * 0.25,
        breathe: Math.random() < BREATHE_RATIO,
        breathePhase: Math.random() * Math.PI * 2,
        breatheSpeed: 0.02 + Math.random() * 0.04,
      }))

      meteorsRef.current = []
    }

    const spawnMeteor = () => {
      if (Math.random() < METEOR_CHANCE) {
        const angle = Math.PI / 4 + (Math.random() - 0.5) * 0.5
        meteorsRef.current.push({
          x: Math.random() * canvas.width * 0.8,
          y: Math.random() * canvas.height * 0.3,
          length: METEOR_LENGTH_MIN + Math.random() * (METEOR_LENGTH_MAX - METEOR_LENGTH_MIN),
          angle,
          speed: 8 + Math.random() * 12,
          opacity: 0.6 + Math.random() * 0.4,
        })
      }
    }

    const animate = (timestamp) => {
      timeRef.current = timestamp * 0.001
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Draw stars
      for (const star of starsRef.current) {
        let opacity = star.opacity

        if (star.breathe) {
          const phase = Math.sin(timeRef.current * star.breatheSpeed + star.breathePhase)
          opacity = star.opacity * (0.4 + 0.6 * ((phase + 1) / 2))
        }

        ctx.beginPath()
        ctx.arc(star.x, star.y, Math.max(0.1, star.radius), 0, Math.PI * 2)
        ctx.fillStyle = `rgba(200, 216, 240, ${Math.max(0, Math.min(1, opacity))})`
        ctx.fill()

        // Glow for larger stars
        if (star.radius > 1.0) {
          const g = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, star.radius * 3)
          g.addColorStop(0, `rgba(61, 127, 255, ${opacity * 0.25})`)
          g.addColorStop(1, 'rgba(61, 127, 255, 0)')
          ctx.beginPath()
          ctx.arc(star.x, star.y, star.radius * 3, 0, Math.PI * 2)
          ctx.fillStyle = g
          ctx.fill()
        }

        // Drift downward
        star.y += star.speed
        if (star.y > canvas.height + 5) {
          star.y = -5
          star.x = Math.random() * canvas.width
        }
      }

      // Spawn and draw meteors
      spawnMeteor()

      for (let i = meteorsRef.current.length - 1; i >= 0; i--) {
        const m = meteorsRef.current[i]

        const startX = m.x
        const startY = m.y
        const endX = startX + Math.cos(m.angle) * m.length
        const endY = startY + Math.sin(m.angle) * m.length

        const grad = ctx.createLinearGradient(startX, startY, endX, endY)
        grad.addColorStop(0, `rgba(200, 216, 240, ${m.opacity})`)
        grad.addColorStop(0.2, `rgba(200, 216, 240, ${m.opacity * 0.5})`)
        grad.addColorStop(1, 'rgba(200, 216, 240, 0)')

        ctx.beginPath()
        ctx.moveTo(startX, startY)
        ctx.lineTo(endX, endY)
        ctx.strokeStyle = grad
        ctx.lineWidth = 1.5
        ctx.stroke()

        // Head dot
        ctx.beginPath()
        ctx.arc(startX, startY, 1.5, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255, 255, 255, ${m.opacity})`
        ctx.fill()

        // Move and fade
        m.x += Math.cos(m.angle) * m.speed
        m.y += Math.sin(m.angle) * m.speed
        m.opacity -= 0.012

        if (m.opacity <= 0 || m.x > canvas.width || m.y > canvas.height) {
          meteorsRef.current.splice(i, 1)
        }
      }

      animRef.current = requestAnimationFrame(animate)
    }

    init()
    window.addEventListener('resize', init)
    animRef.current = requestAnimationFrame(animate)

    return () => {
      window.removeEventListener('resize', init)
      cancelAnimationFrame(animRef.current)
    }
  }, [])

  return (
    <canvas
      id="starfield"
      ref={canvasRef}
      aria-hidden
    />
  )
}
