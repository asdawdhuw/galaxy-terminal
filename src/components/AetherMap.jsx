import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const CAPTURE_RADIUS = 130
const ORBIT_SPEED_MIN = 0.0012
const ORBIT_SPEED_MAX = 0.004
let _id = 0
const genId = () => `ae-${++_id}`
const randSpeed = () => (ORBIT_SPEED_MIN + Math.random() * (ORBIT_SPEED_MAX - ORBIT_SPEED_MIN)) * (Math.random() > 0.5 ? 1 : -1)

/* ── Module-level store — survives mount/unmount cycles ── */
const store = {
  stars: [],
  planets: [],
  subs: new Set()
}
function notify() { store.subs.forEach(fn => fn()) }

/** Direct store API — callable from TerminalCanvas even when unmounted */
export const memoStore = {
  createStar(title) {
    store.stars = [...store.stars, {
      id: genId(), title: title || `Star ${store.stars.length + 1}`,
      position: { x: 200 + Math.random() * 400, y: 100 + Math.random() * 300 }
    }]
    notify()
  },
  addPlanet(title) {
    const edge = Math.floor(Math.random() * 4), W = 800, H = 500
    let fx, fy
    if (edge === 0)      { fx = Math.random() * W; fy = -40 }
    else if (edge === 1) { fx = W + 40; fy = Math.random() * H }
    else if (edge === 2) { fx = Math.random() * W; fy = H + 40 }
    else                 { fx = -40; fy = Math.random() * H }
    store.planets = [...store.planets, {
      id: genId(), starId: null, title: title || `Task ${store.planets.length + 1}`,
      orbitRadius: 65 + Math.random() * 70, speed: randSpeed(),
      angle: Math.random() * Math.PI * 2, isCaptured: false, x: fx, y: fy,
    }]
    notify()
  },
  removePlanet(title) {
    store.planets = store.planets.filter(p => p.id !== title && p.title !== title)
    notify()
  },
  clearAll() {
    store.stars = []
    store.planets = []
    notify()
  },
}

export default function AetherMap({ visible, onClose }) {
  const containerRef = useRef(null)
  const animRef = useRef(null)
  const planetsPosRef = useRef({})

  const [stars, setStars] = useState(() => store.stars)
  const [planets, setPlanets] = useState(() => store.planets)
  const [dragTarget, setDragTarget] = useState(null)
  const [tick, setTick] = useState(0)
  const [editing, setEditing] = useState(null) // { type:'star'|'planet', id }
  const editInputRef = useRef(null)

  // -- rename commit --
  function commitRename(title) {
    const t = title.trim()
    if (editing && t) {
      if (editing.type === 'star') {
        syncStars(prev => prev.map(s => s.id === editing.id ? { ...s, title: t } : s))
      } else {
        syncPlanets(prev => prev.map(p => p.id === editing.id ? { ...p, title: t } : p))
      }
    }
    setEditing(null)
  }

  // focus input when editing starts
  useEffect(() => {
    if (editing) {
      requestAnimationFrame(() => editInputRef.current?.focus())
    }
  }, [editing])

  // -- subscribe to store changes (external commands) --
  useEffect(() => {
    function sync() {
      setStars(store.stars)
      setPlanets(store.planets)
      // clear stale position refs
      const keep = new Set(store.planets.filter(p => p.isCaptured).map(p => p.id))
      for (const id of Object.keys(planetsPosRef.current)) {
        if (!keep.has(id)) delete planetsPosRef.current[id]
      }
    }
    store.subs.add(sync)
    return () => { store.subs.delete(sync) }
  }, [])

  // -- write back to store on local state changes --
  const syncStars = useCallback((fn) => {
    setStars(prev => { const n = fn(prev); store.stars = n; return n })
  }, [])
  const syncPlanets = useCallback((fn) => {
    setPlanets(prev => {
      const n = fn(prev)
      store.planets = n
      n.forEach(p => {
        if (p.isCaptured && !planetsPosRef.current[p.id]) {
          planetsPosRef.current[p.id] = { x: p.x, y: p.y, angle: p.angle }
        }
        if (!p.isCaptured) delete planetsPosRef.current[p.id]
      })
      return n
    })
  }, [])

  // -- physics loop --
  useEffect(() => {
    let running = true
    function loop() {
      if (!running) return
      let dirty = false
      for (const p of store.planets) {
        if (!p.isCaptured || !p.starId) continue
        const pp = planetsPosRef.current[p.id]
        if (!pp) continue
        const star = store.stars.find(s => s.id === p.starId)
        if (!star) continue
        pp.angle += p.speed
        pp.x = star.position.x + p.orbitRadius * Math.cos(pp.angle)
        pp.y = star.position.y + p.orbitRadius * Math.sin(pp.angle)
        dirty = true
      }
      if (dirty) setTick(t => t + 1)
      animRef.current = requestAnimationFrame(loop)
    }
    animRef.current = requestAnimationFrame(loop)
    return () => { running = false; cancelAnimationFrame(animRef.current) }
  }, [])

  // -- resolve display position --
  const pos = useCallback((p) => {
    if (p.isCaptured) {
      const pp = planetsPosRef.current[p.id]
      if (pp) return { x: pp.x, y: pp.y }
    }
    return { x: p.x, y: p.y }
  }, [tick])

  // -- terminal command listener (local events when mounted) --
  useEffect(() => {
    function handler(e) {
      const { action, title } = e.detail
      if (action === 'create') memoStore.createStar(title)
      else if (action === 'add') memoStore.addPlanet(title)
      else if (action === 'remove') memoStore.removePlanet(title)
      else if (action === 'clear') memoStore.clearAll()
    }
    window.addEventListener('galaxy:memo', handler)
    return () => window.removeEventListener('galaxy:memo', handler)
  }, [])

  // -- Escape key --
  useEffect(() => {
    if (!visible) return
    function onKey(e) { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visible, onClose])

  // -- drag end: capture check --
  function handleDragEnd(planetId, info) {
    const rect = containerRef.current?.getBoundingClientRect()
    const rx = rect ? info.point.x - rect.left : info.point.x
    const ry = rect ? info.point.y - rect.top : info.point.y

    let capturedStar = null
    for (const star of store.stars) {
      const dx = rx - star.position.x
      const dy = ry - star.position.y
      if (Math.sqrt(dx * dx + dy * dy) < CAPTURE_RADIUS) {
        capturedStar = star
        break
      }
    }

    if (capturedStar) {
      const dx = rx - capturedStar.position.x
      const dy = ry - capturedStar.position.y
      const angle = Math.atan2(dy, dx)
      const orbitR = 55 + Math.random() * 65
      const spd = randSpeed()
      syncPlanets(prev => prev.map(p => {
        if (p.id !== planetId) return p
        planetsPosRef.current[p.id] = {
          x: capturedStar.position.x + orbitR * Math.cos(angle),
          y: capturedStar.position.y + orbitR * Math.sin(angle),
          angle
        }
        return { ...p, isCaptured: true, starId: capturedStar.id, orbitRadius: orbitR, speed: spd, angle }
      }))
    } else {
      syncPlanets(prev => prev.map(p =>
        p.id === planetId ? { ...p, x: rx, y: ry, isCaptured: false, starId: null } : p
      ))
    }
    setDragTarget(null)
  }

  // -- click planet to release --
  function releasePlanet(planetId) {
    syncPlanets(prev => prev.map(p => {
      if (p.id !== planetId || !p.isCaptured) return p
      const pp = planetsPosRef.current[p.id]
      const cx = pp?.x ?? p.x
      const cy = pp?.y ?? p.y
      delete planetsPosRef.current[p.id]
      const star = store.stars.find(s => s.id === p.starId)
      let vx = 6, vy = -4
      if (star) {
        const dx = cx - star.position.x, dy = cy - star.position.y
        const d = Math.sqrt(dx * dx + dy * dy) || 1
        vx = (dx / d) * 7; vy = (dy / d) * 7
      }
      return { ...p, isCaptured: false, starId: null, x: cx + vx * 4, y: cy + vy * 4 }
    }))
  }

  // -- star drag: real-time position sync for orbiting planets --
  function handleStarDragging(starId, info) {
    const rect = containerRef.current?.getBoundingClientRect()
    const rx = rect ? info.point.x - rect.left : info.point.x
    const ry = rect ? info.point.y - rect.top : info.point.y
    const star = store.stars.find(s => s.id === starId)
    if (star) { star.position.x = rx; star.position.y = ry }
  }

  // -- star drag end: commit to React state (redraws orbit ring) --
  function handleStarDrag(starId, info) {
    const rect = containerRef.current?.getBoundingClientRect()
    const rx = rect ? info.point.x - rect.left : info.point.x
    const ry = rect ? info.point.y - rect.top : info.point.y
    syncStars(prev => prev.map(s =>
      s.id === starId ? { ...s, position: { x: rx, y: ry } } : s
    ))
  }

  // -- organize: auto-capture all free planets to nearest star --
  function handleOrganize() {
    if (store.stars.length === 0) return
    syncPlanets(prev => prev.map(p => {
      if (p.isCaptured) return p
      // find nearest star
      let bestStar = null, bestDist = Infinity
      for (const star of store.stars) {
        const dx = p.x - star.position.x, dy = p.y - star.position.y
        const d = Math.sqrt(dx * dx + dy * dy)
        if (d < bestDist) { bestDist = d; bestStar = star }
      }
      if (!bestStar) return p
      const dx = p.x - bestStar.position.x, dy = p.y - bestStar.position.y
      const angle = Math.atan2(dy, dx)
      const orbitR = 50 + Math.random() * 70
      const spd = randSpeed()
      planetsPosRef.current[p.id] = {
        x: bestStar.position.x + orbitR * Math.cos(angle),
        y: bestStar.position.y + orbitR * Math.sin(angle),
        angle
      }
      return { ...p, isCaptured: true, starId: bestStar.id, orbitRadius: orbitR, speed: spd, angle }
    }))
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="aether-map"
          ref={containerRef}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Orbit rings */}
          <svg className="aether-orbits-svg">
            {stars.map(star => (
              <circle
                key={`ring-${star.id}`}
                cx={star.position.x}
                cy={star.position.y}
                r={CAPTURE_RADIUS}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="1.2"
                strokeDasharray="5 6"
                opacity={dragTarget === star.id ? 0.5 : 0.18}
                style={{ transition: 'opacity 0.35s ease' }}
              />
            ))}
          </svg>

          {/* Stars */}
          {stars.map(star => (
            <motion.div
              key={star.id}
              className="aether-star"
              style={{ left: star.position.x - 38, top: star.position.y - 38 }}
              drag
              dragMomentum={false}
              onDrag={(_, info) => handleStarDragging(star.id, info)}
              onDragEnd={(_, info) => handleStarDrag(star.id, info)}
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 2.8 + Math.random() * 1.5, repeat: Infinity, ease: 'easeInOut', delay: Math.random() * 1.5 }}
            >
              <div className="aether-star-glow" />
              <div className="aether-star-core">
                <span className="aether-star-icon">✧</span>
              </div>
              <span
                className="aether-star-label"
                onDoubleClick={(e) => { e.stopPropagation(); setEditing({ type: 'star', id: star.id }) }}
              >{star.title}</span>
            </motion.div>
          ))}

          {/* Planets */}
          {planets.map(planet => {
            const { x, y } = pos(planet)
            return (
              <motion.div
                key={planet.id}
                className={`aether-planet ${planet.isCaptured ? 'captured' : 'free'}`}
                style={{ left: x - 16, top: y - 16 }}
                drag={!planet.isCaptured}
                dragMomentum={false}
                whileDrag={{ scale: 1.18, zIndex: 200 }}
                onDrag={(_, info) => {
                  const rect = containerRef.current?.getBoundingClientRect()
                  const rx = rect ? info.point.x - rect.left : info.point.x
                  const ry = rect ? info.point.y - rect.top : info.point.y
                  let near = null
                  for (const star of stars) {
                    const dx = rx - star.position.x
                    const dy = ry - star.position.y
                    if (Math.sqrt(dx * dx + dy * dy) < CAPTURE_RADIUS) { near = star.id; break }
                  }
                  setDragTarget(near)
                }}
                onDragEnd={(_, info) => handleDragEnd(planet.id, info)}
                onClick={(e) => { e.stopPropagation(); if (planet.isCaptured) releasePlanet(planet.id) }}
                onDoubleClick={(e) => { e.stopPropagation(); setEditing({ type: 'planet', id: planet.id }) }}
                whileHover={{ scale: planet.isCaptured ? 1.2 : 1.15 }}
                whileTap={{ scale: 0.92 }}
              >
                <div className="aether-planet-dot" />
                {planet.isCaptured && (
                  <svg className="aether-moon-ring-svg" viewBox="0 0 48 48">
                    <circle cx="24" cy="24" r="22" fill="none" stroke="var(--accent)" strokeWidth="0.7" strokeDasharray="3 4" />
                  </svg>
                )}
                <span className="aether-planet-label">{planet.title}</span>
              </motion.div>
            )
          })}

          {/* Empty state — only glyph + title when nothing exists */}
          {stars.length === 0 && planets.length === 0 && (
            <motion.div
              className="aether-empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <div className="aether-empty-glyph">◈</div>
              <p className="aether-empty-title">Aether Map</p>
              <p className="aether-empty-sub">cosmic task plane — use the console below to begin</p>
            </motion.div>
          )}

          {/* Inline rename input */}
          {editing && (() => {
            let ex, ey, currentTitle
            if (editing.type === 'star') {
              const s = stars.find(x => x.id === editing.id)
              if (s) { ex = s.position.x; ey = s.position.y; currentTitle = s.title }
            } else {
              const p = planets.find(x => x.id === editing.id)
              if (p) {
                const pp = pos(p)
                ex = pp.x; ey = pp.y; currentTitle = p.title
              }
            }
            if (ex == null) return null
            return (
              <div className="aether-rename-overlay" onClick={() => commitRename(currentTitle)}>
                <input
                  ref={editInputRef}
                  className="aether-rename-input"
                  style={{ left: ex, top: ey + 40 }}
                  defaultValue={currentTitle}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(e.target.value)
                    if (e.key === 'Escape') setEditing(null)
                  }}
                  onBlur={(e) => commitRename(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  spellCheck={false}
                />
              </div>
            )
          })()}

          {/* Console Bar */}
          <div className="aether-console">
            <div className="aether-console-inner">
              <motion.button
                className="aether-btn"
                onClick={() => memoStore.createStar()}
                whileHover="hover"
                whileTap="tap"
                variants={{
                  hover: { borderColor: 'var(--accent)', boxShadow: 'inset 0 0 18px rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.12), 0 0 12px rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.15)' },
                  tap:   { scale: 0.93, transition: { duration: 0.1 } },
                }}
              >
                <span className="aether-btn-icon">✚</span>
                <span>恒星</span>
              </motion.button>

              <motion.button
                className="aether-btn"
                onClick={() => memoStore.addPlanet()}
                whileHover="hover"
                whileTap="tap"
                variants={{
                  hover: { borderColor: 'var(--accent)', boxShadow: 'inset 0 0 18px rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.12), 0 0 12px rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.15)' },
                  tap:   { scale: 0.93, transition: { duration: 0.1 } },
                }}
              >
                <span className="aether-btn-icon">✚</span>
                <span>行星</span>
              </motion.button>

              <motion.button
                className="aether-btn aether-btn-organize"
                onClick={handleOrganize}
                whileHover="hover"
                whileTap="tap"
                variants={{
                  hover: { borderColor: 'var(--accent)', boxShadow: 'inset 0 0 18px rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.12), 0 0 12px rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.15)' },
                  tap:   { scale: 0.93, transition: { duration: 0.1 } },
                }}
              >
                <span className="aether-btn-icon">⟳</span>
                <span>整理星系</span>
              </motion.button>

              <div className="aether-console-divider" />

              <span className="aether-console-hint">
                <kbd>Esc</kbd> 返回 · 双击重命名 · 拖拽行星至恒星捕获 · 点击释放
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
