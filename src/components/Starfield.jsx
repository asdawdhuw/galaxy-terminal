import { useEffect, useRef } from 'react'

export default function Starfield() {
  const canvasRef = useRef(null)
  const starsRef = useRef([])
  const shootingStarsRef = useRef([])
  const animationRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      initStars()
    }

    const initStars = () => {
      const starCount = Math.floor((canvas.width * canvas.height) / 3000)
      starsRef.current = Array.from({ length: starCount }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        z: Math.random() * 3 + 1,
        radius: Math.random() * 1.5 + 0.5,
        opacity: Math.random() * 0.5 + 0.3,
        twinkleSpeed: Math.random() * 0.02 + 0.01,
        twinkleOffset: Math.random() * Math.PI * 2
      }))

      shootingStarsRef.current = Array.from({ length: 3 }, () => ({
        x: 0,
        y: 0,
        length: 80,
        speed: 15,
        opacity: 0,
        angle: Math.PI / 4,
        active: false
      }))
    }

    const createShootingStar = () => {
      const star = shootingStarsRef.current.find((s) => !s.active)
      if (star && Math.random() < 0.002) {
        star.x = Math.random() * canvas.width
        star.y = Math.random() * (canvas.height / 3)
        star.length = Math.random() * 60 + 40
        star.speed = Math.random() * 10 + 10
        star.opacity = 1
        star.angle = Math.PI / 4 + (Math.random() - 0.5) * 0.3
        star.active = true
      }
    }

    const animate = (time) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      starsRef.current.forEach((star) => {
        const twinkle = Math.sin(time * star.twinkleSpeed + star.twinkleOffset)
        const currentOpacity = star.opacity + twinkle * 0.3
        const currentRadius = star.radius + twinkle * 0.2

        ctx.beginPath()
        ctx.arc(star.x, star.y, Math.max(0.1, currentRadius), 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, currentOpacity)})`
        ctx.fill()

        if (star.radius > 1) {
          const gradient = ctx.createRadialGradient(
            star.x, star.y, 0,
            star.x, star.y, star.radius * 3
          )
          gradient.addColorStop(0, `rgba(180, 220, 255, ${currentOpacity * 0.3})`)
          gradient.addColorStop(1, 'rgba(180, 220, 255, 0)')
          ctx.beginPath()
          ctx.arc(star.x, star.y, star.radius * 3, 0, Math.PI * 2)
          ctx.fillStyle = gradient
          ctx.fill()
        }
      })

      createShootingStar()
      shootingStarsRef.current.forEach((star) => {
        if (!star.active) return

        const gradient = ctx.createLinearGradient(
          star.x, star.y,
          star.x - Math.cos(star.angle) * star.length,
          star.y - Math.sin(star.angle) * star.length
        )
        gradient.addColorStop(0, `rgba(255, 255, 255, ${star.opacity})`)
        gradient.addColorStop(0.3, `rgba(180, 220, 255, ${star.opacity * 0.5})`)
        gradient.addColorStop(1, 'rgba(180, 220, 255, 0)')

        ctx.beginPath()
        ctx.moveTo(star.x, star.y)
        ctx.lineTo(
          star.x - Math.cos(star.angle) * star.length,
          star.y - Math.sin(star.angle) * star.length
        )
        ctx.strokeStyle = gradient
        ctx.lineWidth = 2
        ctx.stroke()

        ctx.beginPath()
        ctx.arc(star.x, star.y, 2, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`
        ctx.fill()

        star.x += Math.cos(star.angle) * star.speed
        star.y += Math.sin(star.angle) * star.speed
        star.opacity -= 0.015

        if (star.opacity <= 0 || star.x > canvas.width || star.y > canvas.height) {
          star.active = false
        }
      })

      animationRef.current = requestAnimationFrame(animate)
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    animationRef.current = requestAnimationFrame(animate)

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      cancelAnimationFrame(animationRef.current)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 1 }}
      aria-hidden
    />
  )
}
