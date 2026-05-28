import { useRef, useEffect } from 'react'

const BAR_COUNT = 10
const GAP = 3
const CANVAS_H = 48
const FADE_SPEED = 0.07
const GLOW_BLUR = 10

function indexToFreqRange(i, totalBins) {
  const start = Math.floor((i / BAR_COUNT) ** 0.55 * totalBins)
  const end = Math.floor(((i + 1) / BAR_COUNT) ** 0.55 * totalBins)
  return [start, Math.max(start + 1, end)]
}

function readAccent() {
  const s = getComputedStyle(document.documentElement)
  const r = parseInt(s.getPropertyValue('--accent-r').trim()) || 56
  const g = parseInt(s.getPropertyValue('--accent-g').trim()) || 189
  const b = parseInt(s.getPropertyValue('--accent-b').trim()) || 248
  if (r + g + b < 100) return { r: 56, g: 189, b: 248 }
  return { r, g, b }
}

export default function MusicSpectrum({ getAnalyser, playing }) {
  const canvasRef = useRef(null)
  const rafRef = useRef(null)
  const fadeRef = useRef(0)
  const dataRef = useRef(new Uint8Array(128))
  const heightsRef = useRef(new Array(BAR_COUNT).fill(0))

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    let prevW = 0

    function draw() {
      // Measure width every frame from parent (handles resize, no observers needed)
      const parent = canvas.parentElement
      if (!parent) {
        rafRef.current = requestAnimationFrame(draw)
        return
      }
      const w = parent.getBoundingClientRect().width
      if (w <= 0) {
        rafRef.current = requestAnimationFrame(draw)
        return
      }

      // Resize canvas backing store when width changes
      const dpr = window.devicePixelRatio || 1
      if (w !== prevW) {
        prevW = w
        canvas.width = w * dpr
        canvas.height = CANVAS_H * dpr
        canvas.style.width = `${w}px`
        canvas.style.height = `${CANVAS_H}px`
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      }

      // Fade
      const target = playing ? 1 : 0
      fadeRef.current += (target - fadeRef.current) * FADE_SPEED

      // Frequency data
      const analyser = getAnalyser?.()
      const data = dataRef.current
      if (analyser && data.length !== analyser.frequencyBinCount) {
        dataRef.current = new Uint8Array(analyser.frequencyBinCount)
      }
      if (analyser) {
        analyser.getByteFrequencyData(dataRef.current)
      }

      // Draw
      ctx.clearRect(0, 0, w, CANVAS_H)

      const alpha = fadeRef.current
      if (alpha < 0.003) {
        rafRef.current = requestAnimationFrame(draw)
        return
      }

      const accent = readAccent()
      const bufferLen = dataRef.current.length
      const barW = (w - GAP * (BAR_COUNT - 1)) / BAR_COUNT
      const heights = heightsRef.current

      for (let i = 0; i < BAR_COUNT; i++) {
        const [start, end] = indexToFreqRange(i, bufferLen)
        let sum = 0
        for (let j = start; j < end; j++) sum += dataRef.current[j]
        const raw = sum / (end - start) / 255
        heights[i] += (raw - heights[i]) * 0.6
        const barH = Math.max(2, heights[i] * CANVAS_H * 0.88)

        const x = i * (barW + GAP)
        const y = CANVAS_H - barH

        const grad = ctx.createLinearGradient(x, CANVAS_H, x, y > 0 ? y : 0)
        grad.addColorStop(0, `rgba(${accent.r},${accent.g},${accent.b},${0.92 * alpha})`)
        grad.addColorStop(
          0.45,
          `rgba(${Math.floor(accent.r * 0.55)},${Math.floor(accent.g * 0.45)},${Math.min(255, accent.b + 35)},${0.72 * alpha})`
        )
        grad.addColorStop(
          1,
          `rgba(${Math.floor(accent.r * 0.25)},${Math.floor(accent.g * 0.15)},${Math.min(255, accent.b + 70)},${0.48 * alpha})`
        )

        ctx.fillStyle = grad
        ctx.shadowColor = `rgba(${accent.r},${accent.g},${accent.b},${0.55 * alpha})`
        ctx.shadowBlur = GLOW_BLUR

        const r = Math.min(barW / 2, 2.5)
        ctx.beginPath()
        ctx.moveTo(x, CANVAS_H)
        ctx.lineTo(x, y + r)
        ctx.quadraticCurveTo(x, y, x + r, y)
        ctx.lineTo(x + barW - r, y)
        ctx.quadraticCurveTo(x + barW, y, x + barW, y + r)
        ctx.lineTo(x + barW, CANVAS_H)
        ctx.closePath()
        ctx.fill()
      }

      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [playing, getAnalyser])

  return (
    <div className="music-spectrum-wrap">
      <canvas ref={canvasRef} className="music-spectrum-canvas" />
    </div>
  )
}
