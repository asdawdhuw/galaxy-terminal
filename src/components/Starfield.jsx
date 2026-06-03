import { useEffect, useRef } from 'react'

const STAR_COUNT = 120
const BREATHE_RATIO = 0.12
const METEOR_CHANCE = 0.01

export default function Starfield({ chillMode }) {
  const canvasRef = useRef(null)
  const starsRef = useRef([])
  const meteorsRef = useRef([])
  const animRef = useRef(0)
  const timeRef = useRef(0)
  const chillRef = useRef(chillMode)
  const frameRef = useRef(0)
  chillRef.current = chillMode

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
      starsRef.current = Array.from({ length: STAR_COUNT }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: 0.3 + Math.random() * 1.5,
        opacity: 0.2 + Math.random() * 0.8,
        speed: 0.02 + Math.random() * 0.12,
        breathe: Math.random() < BREATHE_RATIO,
        breathePhase: Math.random() * Math.PI * 2,
        breatheSpeed: 0.02 + Math.random() * 0.04,
      }))
      meteorsRef.current = []
    }

    const animate = () => {
      frameRef.current++
      if (!chillRef.current && frameRef.current % 2 !== 0) {
        animRef.current = requestAnimationFrame(animate)
        return
      }

      const speedMul = chillRef.current ? 0.25 : 1
      ctx.clearRect(0, 0, canvas.width, canvas.height)

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

        if (star.radius > 0.7) {
          ctx.beginPath()
          ctx.arc(star.x, star.y, star.radius * 3, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(61, 127, 255, ${opacity * 0.15})`
          ctx.fill()
        }

        star.y += star.speed * speedMul
        if (star.y > canvas.height + 5) {
          star.y = -5
          star.x = Math.random() * canvas.width
        }
      }

      if (Math.random() < METEOR_CHANCE) {
        const angle = Math.PI / 4 + (Math.random() - 0.5) * 0.5
        meteorsRef.current.push({
          x: Math.random() * canvas.width * 0.8,
          y: canvas.height * (0.25 + Math.random() * 0.25),
          length: 100 + Math.random() * 100,
          angle,
          speed: 2 + Math.random() * 3,
          opacity: 0.6 + Math.random() * 0.4,
        })
      }

      for (let i = meteorsRef.current.length - 1; i >= 0; i--) {
        const m = meteorsRef.current[i]
        const endX = m.x + Math.cos(m.angle) * m.length
        const endY = m.y + Math.sin(m.angle) * m.length

        ctx.beginPath()
        ctx.moveTo(m.x, m.y)
        ctx.lineTo(endX, endY)
        ctx.strokeStyle = `rgba(61, 127, 255, ${m.opacity * 0.4})`
        ctx.lineWidth = 3
        ctx.stroke()

        ctx.beginPath()
        ctx.moveTo(m.x, m.y)
        ctx.lineTo(endX, endY)
        ctx.strokeStyle = `rgba(255, 255, 255, ${m.opacity * 0.7})`
        ctx.lineWidth = 1
        ctx.stroke()

        ctx.beginPath()
        ctx.arc(m.x, m.y, 1.2, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(180, 220, 255, ${m.opacity})`
        ctx.fill()

        m.x += Math.cos(m.angle) * m.speed
        m.y += Math.sin(m.angle) * m.speed
        m.opacity -= 0.006
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

  return <canvas id="starfield" ref={canvasRef} aria-hidden />
}
