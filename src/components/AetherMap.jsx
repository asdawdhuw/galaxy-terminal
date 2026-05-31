import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'

/* ================================================================
   Constants
   ================================================================ */
const STAR_CAPTURE_R = 140
const PLANET_CAPTURE_R = 75
const BH_X = 1, BH_Y = 1, BH_R = 55
const MIN_ZOOM = 0.2, MAX_ZOOM = 2.0

let _id = 0
const genId = () => `mm-${++_id}`
const randSpeed = () => (0.0008 + Math.random() * 0.0025) * (Math.random() > 0.5 ? 1 : -1)

/* ================================================================
   Module-level store
   ================================================================ */
const store = {
  stars: [],    // { id, name, content, position:{x,y} }
  planets: [],  // { id, name, content, starId, isCaptured, orbitR, speed, angle, x, y }
  moons: [],    // { id, name, content, planetId, isCaptured, orbitR, speed, angle, x, y }
  subs: new Set()
}
function notify() { store.subs.forEach(fn => fn()) }

export const memoStore = {
  createStar(name) {
    store.stars.push({
      id: genId(), name: name || `Star ${store.stars.length + 1}`, content: '',
      position: { x: 180 + Math.random() * 500, y: 120 + Math.random() * 380 }
    })
    notify()
  },
  addPlanet(name, starId) {
    store.planets.push({
      id: genId(), name: name || `Planet ${store.planets.length + 1}`, content: '',
      starId: starId || null, isCaptured: false,
      orbitR: 70 + Math.random() * 60, speed: randSpeed(),
      angle: Math.random() * Math.PI * 2, x: 300 + Math.random() * 300, y: 200 + Math.random() * 200
    })
    notify()
  },
  addMoon(name, planetId) {
    store.moons.push({
      id: genId(), name: name || `Moon ${store.moons.length + 1}`, content: '',
      planetId: planetId || null, isCaptured: false,
      orbitR: 32 + Math.random() * 28, speed: randSpeed(),
      angle: Math.random() * Math.PI * 2, x: 300 + Math.random() * 300, y: 200 + Math.random() * 200
    })
    notify()
  },
  removePlanet(id) {
    store.planets = store.planets.filter(p => p.id !== id)
    store.moons = store.moons.filter(m => m.planetId !== id)
    notify()
  },
  clearAll() { store.stars = []; store.planets = []; store.moons = []; notify() }
}

/* ================================================================
   SVG Celestial Gradients (defined once, referenced by id)
   ================================================================ */
function CelestialDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }}>
      <defs>
        <radialGradient id="star-grad" cx="35%" cy="30%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="40%" stopColor="#f0c040" />
          <stop offset="100%" stopColor="#804010" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="planet-grad" cx="40%" cy="35%">
          <stop offset="0%" stopColor="#a0c0ff" />
          <stop offset="50%" stopColor="#4060c0" />
          <stop offset="100%" stopColor="#102040" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="moon-grad" cx="40%" cy="35%">
          <stop offset="0%" stopColor="#d0d0e0" />
          <stop offset="60%" stopColor="#707090" />
          <stop offset="100%" stopColor="#282838" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="bh-grad" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#000000" />
          <stop offset="40%" stopColor="#050510" />
          <stop offset="100%" stopColor="#150030" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  )
}

/* ================================================================
   AetherMap Component
   ================================================================ */
export default function AetherMap({ visible, onClose }) {
  const containerRef = useRef(null)
  const contentRef = useRef(null)
  const animRef = useRef(null)

  const [stars, setStars] = useState(() => store.stars)
  const [planets, setPlanets] = useState(() => store.planets)
  const [moons, setMoons] = useState(() => store.moons)
  const [tick, setTick] = useState(0)
  const [editing, setEditing] = useState(null) // { type, id }
  const [selPlanet, setSelPlanet] = useState(null) // selected planet for moon creation
  const [zoom, setZoom] = useState(0.55)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [viewCentered, setViewCentered] = useState(false)

  // Center view on universe when first mounted
  useEffect(() => {
    if (viewCentered) return
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    // Center on the universe midpoint (between black hole and typical star placement area)
    const cx = 430, cy = 430
    setPan({
      x: rect.width / (2 * zoom) - cx,
      y: rect.height / (2 * zoom) - cy,
    })
    setViewCentered(true)
  }, [zoom, viewCentered])
  const [draggingPane, setDraggingPane] = useState(false)
  const [sucked, setSucked] = useState(new Set())
  const [explosions, setExplosions] = useState([])
  const editRef = useRef(null)
  const panRef = useRef({ x: 0, y: 0, startX: 0, startY: 0 })
  const pendingCommitRef = useRef(null)

  // Live physics positions (mutable, not React state)
  const physicsRef = useRef({})

  /* ================================================================
     Store sync
     ================================================================ */
  useEffect(() => {
    function sync() {
      setStars([...store.stars])
      setPlanets([...store.planets])
      setMoons([...store.moons])
    }
    store.subs.add(sync)
    return () => { store.subs.delete(sync) }
  }, [])

  const syncStars = useCallback(fn => { setStars(prev => { const n = fn(prev); store.stars = n; return n }) }, [])
  const syncPlanets = useCallback(fn => { setPlanets(prev => { const n = fn(prev); store.planets = n; return n }) }, [])
  const syncMoons = useCallback(fn => { setMoons(prev => { const n = fn(prev); store.moons = n; return n }) }, [])

  /* ================================================================
     Physics loop — compute orbital positions
     ================================================================ */
  useEffect(() => {
    let running = true
    function loop() {
      if (!running) return
      let dirty = false
      const pos = physicsRef.current

      for (const p of store.planets) {
        if (!p.isCaptured || !p.starId) continue
        const star = store.stars.find(s => s.id === p.starId)
        if (!star) continue
        if (!pos[p.id]) pos[p.id] = { x: 0, y: 0, angle: p.angle }
        pos[p.id].angle += p.speed
        pos[p.id].x = star.position.x + p.orbitR * Math.cos(pos[p.id].angle)
        pos[p.id].y = star.position.y + p.orbitR * Math.sin(pos[p.id].angle)
        dirty = true
      }

      for (const m of store.moons) {
        if (!m.isCaptured || !m.planetId) continue
        const planet = store.planets.find(p => p.id === m.planetId)
        if (!planet) continue
        // Resolve planet's live position (may be orbiting a star or free)
        let px, py
        if (planet.isCaptured && planet.starId && pos[planet.id]) {
          px = pos[planet.id].x; py = pos[planet.id].y
        } else {
          px = planet.x; py = planet.y
        }
        if (!pos[m.id]) pos[m.id] = { x: 0, y: 0, angle: m.angle }
        pos[m.id].angle += m.speed
        pos[m.id].x = px + m.orbitR * Math.cos(pos[m.id].angle)
        pos[m.id].y = py + m.orbitR * Math.sin(pos[m.id].angle)
        dirty = true
      }

      if (dirty) setTick(t => t + 1)
      animRef.current = requestAnimationFrame(loop)
    }
    animRef.current = requestAnimationFrame(loop)
    return () => { running = false; cancelAnimationFrame(animRef.current) }
  }, [])

  /* ================================================================
     Resolve display position
     ================================================================ */
  const getPos = useCallback((obj, type) => {
    if (type === 'planet' && obj.isCaptured) {
      const pp = physicsRef.current[obj.id]
      if (pp) return { x: pp.x, y: pp.y }
    }
    if (type === 'moon' && obj.isCaptured) {
      const mp = physicsRef.current[obj.id]
      if (mp) return { x: mp.x, y: mp.y }
    }
    return { x: obj.x, y: obj.y }
  }, [tick])

  /* ================================================================
     Zoom & Pan
     ================================================================ */
  const hasStars = stars.length > 0

  const handleWheel = useCallback((e) => {
    if (!hasStars) return
    e.preventDefault()
    setZoom(z => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z - e.deltaY * 0.0008)))
  }, [hasStars])

  const handlePanStart = useCallback((e) => {
    if (!hasStars) return
    if (e.target !== contentRef.current && e.target !== containerRef.current) return
    if (e.button !== 0) return
    setDraggingPane(true)
    panRef.current = { ...pan, startX: e.clientX, startY: e.clientY }
  }, [pan, hasStars])

  useEffect(() => {
    if (!draggingPane) return
    function onMove(e) {
      setPan({
        x: panRef.current.x + (e.clientX - panRef.current.startX) / zoom,
        y: panRef.current.y + (e.clientY - panRef.current.startY) / zoom,
      })
    }
    function onUp() { setDraggingPane(false) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [draggingPane, zoom])

  /* ================================================================
     Black Hole — cascade delete
     ================================================================ */
  function checkBH(x, y) {
    const dx = x - BH_X, dy = y - BH_Y
    return Math.sqrt(dx * dx + dy * dy) < BH_R + 30
  }

  function suckStar(starId) {
    const star = store.stars.find(s => s.id === starId)
    if (!star) return
    setSucked(prev => new Set([...prev, starId]))
    setExplosions(prev => [...prev, { id: 'bh-'+Date.now(), x: BH_X, y: BH_Y }])

    // Find all captured planets and their moons
    const linkedPlanets = store.planets.filter(p => p.starId === starId && p.isCaptured)
    const linkedMoonIds = []
    linkedPlanets.forEach(p => {
      setSucked(prev => new Set([...prev, p.id]))
      store.moons.filter(m => m.planetId === p.id && m.isCaptured).forEach(m => {
        linkedMoonIds.push(m.id)
        setSucked(prev => new Set([...prev, m.id]))
      })
    })

    setTimeout(() => {
      syncStars(prev => prev.filter(s => s.id !== starId))
      syncPlanets(prev => prev.filter(p => !linkedPlanets.some(lp => lp.id === p.id)))
      syncMoons(prev => prev.filter(m => !linkedMoonIds.includes(m.id)))
      setSucked(new Set())
      setExplosions(prev => prev.slice(1))
    }, 500)
  }

  function suckPlanet(planetId) {
    const planet = store.planets.find(p => p.id === planetId)
    if (!planet) return
    setSucked(prev => new Set([...prev, planetId]))
    setExplosions(prev => [...prev, { id: 'bh-'+Date.now(), x: BH_X, y: BH_Y }])

    const linkedMoonIds = []
    store.moons.filter(m => m.planetId === planetId && m.isCaptured).forEach(m => {
      linkedMoonIds.push(m.id)
      setSucked(prev => new Set([...prev, m.id]))
    })

    setTimeout(() => {
      syncPlanets(prev => prev.filter(p => p.id !== planetId))
      syncMoons(prev => prev.filter(m => !linkedMoonIds.includes(m.id)))
      setSucked(new Set())
      setExplosions(prev => prev.slice(1))
    }, 500)
  }

  /* ================================================================
     Drag handlers
     ================================================================ */
  function getContainerPos(point) {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return { x: point.x, y: point.y }
    return {
      x: (point.x - rect.left) / zoom - pan.x,
      y: (point.y - rect.top) / zoom - pan.y,
    }
  }

  // Star drag
  function handleStarDragEnd(starId, info) {
    const { x, y } = getContainerPos(info.point)
    if (checkBH(x, y)) { suckStar(starId); return }
    syncStars(prev => prev.map(s => s.id === starId ? { ...s, position: { x, y } } : s))
  }
  function handleStarDragging(starId, info) {
    const { x, y } = getContainerPos(info.point)
    const s = store.stars.find(s2 => s2.id === starId)
    if (s) { s.position.x = x; s.position.y = y }
  }

  // Planet drag
  function handlePlanetDragEnd(planetId, info) {
    const { x, y } = getContainerPos(info.point)
    if (checkBH(x, y)) { suckPlanet(planetId); return }

    // Check star capture
    let capStar = null
    for (const s of store.stars) {
      if (Math.hypot(x - s.position.x, y - s.position.y) < STAR_CAPTURE_R) { capStar = s; break }
    }
    if (capStar) {
      syncPlanets(prev => prev.map(p => {
        if (p.id !== planetId) return p
        const angle = Math.atan2(y - capStar.position.y, x - capStar.position.x)
        if (!physicsRef.current[p.id]) physicsRef.current[p.id] = { x: 0, y: 0, angle }
        else physicsRef.current[p.id].angle = angle
        return { ...p, isCaptured: true, starId: capStar.id, orbitR: 65 + Math.random() * 70, speed: randSpeed(), angle }
      }))
    } else {
      syncPlanets(prev => prev.map(p => p.id === planetId ? { ...p, x, y, isCaptured: false, starId: null } : p))
    }
  }

  // Moon drag
  function handleMoonDragEnd(moonId, info) {
    const { x, y } = getContainerPos(info.point)
    // Moons can't be destroyed by black hole directly — skip checkBH

    let capPlanet = null
    for (const p of store.planets) {
      const pp = p.isCaptured && physicsRef.current[p.id] ? physicsRef.current[p.id] : { x: p.x, y: p.y }
      if (Math.hypot(x - pp.x, y - pp.y) < PLANET_CAPTURE_R) { capPlanet = p; break }
    }
    if (capPlanet) {
      syncMoons(prev => prev.map(m => {
        if (m.id !== moonId) return m
        const ppos = capPlanet.isCaptured && physicsRef.current[capPlanet.id] ? physicsRef.current[capPlanet.id] : { x: capPlanet.x, y: capPlanet.y }
        const angle = Math.atan2(y - ppos.y, x - ppos.x)
        if (!physicsRef.current[m.id]) physicsRef.current[m.id] = { x: 0, y: 0, angle }
        else physicsRef.current[m.id].angle = angle
        return { ...m, isCaptured: true, planetId: capPlanet.id, orbitR: 30 + Math.random() * 30, speed: randSpeed(), angle }
      }))
    } else {
      syncMoons(prev => prev.map(m => m.id === moonId ? { ...m, x, y, isCaptured: false, planetId: null } : m))
    }
  }

  /* ================================================================
     Release captured objects
     ================================================================ */
  function releasePlanet(planetId) {
    syncPlanets(prev => prev.map(p => {
      if (p.id !== planetId || !p.isCaptured) return p
      const pp = physicsRef.current[p.id]
      const cx = pp?.x ?? p.x, cy = pp?.y ?? p.y
      delete physicsRef.current[p.id]
      return { ...p, isCaptured: false, starId: null, x: cx, y: cy }
    }))
    // Release all moons of this planet
    syncMoons(prev => prev.map(m => {
      if (m.planetId !== planetId || !m.isCaptured) return m
      const mp = physicsRef.current[m.id]
      const mx = mp?.x ?? m.x, my = mp?.y ?? m.y
      delete physicsRef.current[m.id]
      return { ...m, isCaptured: false, planetId: null, x: mx, y: my }
    }))
  }

  function releaseMoon(moonId) {
    syncMoons(prev => prev.map(m => {
      if (m.id !== moonId || !m.isCaptured) return m
      const mp = physicsRef.current[m.id]
      const mx = mp?.x ?? m.x, my = mp?.y ?? m.y
      delete physicsRef.current[m.id]
      return { ...m, isCaptured: false, planetId: null, x: mx, y: my }
    }))
  }

  /* ================================================================
     Organize
     ================================================================ */
  function handleOrganize() {
    if (store.stars.length === 0) return
    // Capture all free planets to nearest star
    syncPlanets(prev => prev.map(p => {
      if (p.isCaptured) return p
      let best = null, bestD = Infinity
      for (const s of store.stars) {
        const d = Math.hypot(p.x - s.position.x, p.y - s.position.y)
        if (d < bestD) { bestD = d; best = s }
      }
      if (!best) return p
      const angle = Math.atan2(p.y - best.position.y, p.x - best.position.x)
      if (!physicsRef.current[p.id]) physicsRef.current[p.id] = { x: 0, y: 0, angle }
      else physicsRef.current[p.id].angle = angle
      return { ...p, isCaptured: true, starId: best.id, orbitR: 55 + Math.random() * 75, speed: randSpeed(), angle }
    }))
    // Capture all free moons to nearest planet
    syncMoons(prev => prev.map(m => {
      if (m.isCaptured) return m
      let best = null, bestD = Infinity
      for (const p of store.planets) {
        const pp = getPosRaw(p, 'planet')
        const d = Math.hypot(m.x - pp.x, m.y - pp.y)
        if (d < bestD) { bestD = d; best = p }
      }
      if (!best) return m
      const ppos = getPosRaw(best, 'planet')
      const angle = Math.atan2(m.y - ppos.y, m.x - ppos.x)
      if (!physicsRef.current[m.id]) physicsRef.current[m.id] = { x: 0, y: 0, angle }
      else physicsRef.current[m.id].angle = angle
      return { ...m, isCaptured: true, planetId: best.id, orbitR: 28 + Math.random() * 32, speed: randSpeed(), angle }
    }))
  }

  function getPosRaw(obj, type) {
    if (type === 'planet' && obj.isCaptured) {
      const pp = physicsRef.current[obj.id]
      if (pp) return { x: pp.x, y: pp.y }
    }
    return { x: obj.x, y: obj.y }
  }

  /* ================================================================
     Rename & Content editing
     ================================================================ */
  function commitEdit(val) {
    const v = val.trim()
    if (editing && v) {
      const fn = editing.type === 'star' ? syncStars : editing.type === 'planet' ? syncPlanets : syncMoons
      fn(prev => prev.map(x => x.id === editing.id ? { ...x, [editing.field]: v } : x))
    }
    setEditing(null)
  }

  useEffect(() => {
    if (editing) requestAnimationFrame(() => editRef.current?.focus())
  }, [editing])

  /* ================================================================
     Keyboard
     ================================================================ */
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') { setEditing(null); onClose?.() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  /* ================================================================
     Terminal commands
     ================================================================ */
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

  /* ================================================================
     Render helpers
     ================================================================ */
  const zoomLvl = zoom
  const showContent = zoomLvl >= 0.4
  const showFullContent = zoomLvl > 0.8

  function renderName(name, onDblClick, extraClass = '') {
    return (
      <span
        className={`aether-object-name ${extraClass}`}
        onDoubleClick={(e) => { e.stopPropagation(); onDblClick() }}
        style={{ opacity: zoomLvl < 0.4 ? 0.35 : 0.9 }}
      >{name}</span>
    )
  }

  function renderContent(content, onDblClick, maxLen) {
    if (!showContent || !content) return null
    const text = showFullContent ? content : content.slice(0, maxLen || 60)
    return (
      <div
        className="aether-object-content"
        onDoubleClick={(e) => { e.stopPropagation(); onDblClick() }}
      >{text}{!showFullContent && content.length > (maxLen || 60) ? '...' : ''}</div>
    )
  }

  /* ================================================================
     Render
     ================================================================ */
  if (!visible) return null

  return (
    <div
      ref={containerRef}
      className="aether-map"
      onWheel={handleWheel}
      onMouseDown={handlePanStart}
    >
      <CelestialDefs />

      {/* Zoom indicator */}
      {hasStars && <div className="aether-zoom-badge">{Math.round(zoomLvl * 100)}%</div>}

      {/* Transformed content layer */}
      <div
        ref={contentRef}
        className="aether-content-layer"
        style={{ transform: `scale(${zoomLvl}) translate(${pan.x}px, ${pan.y}px)` }}
      >
        {/* === Black Hole === */}
        <motion.div
          className="aether-bh"
          style={{ left: BH_X - BH_R, top: BH_Y - BH_R, width: BH_R * 2, height: BH_R * 2 }}
          animate={{ scale: [1, 1.03, 1] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <svg width={BH_R * 2} height={BH_R * 2} viewBox="0 0 110 110">
            <circle cx="55" cy="55" r="50" fill="url(#bh-grad)" />
            <circle cx="55" cy="55" r="50" fill="none" stroke="rgba(80,20,140,0.3)" strokeWidth="2" strokeDasharray="6 4">
              <animateTransform attributeName="transform" type="rotate" values="0 55 55;360 55 55" dur="7s" repeatCount="indefinite" />
            </circle>
          </svg>
          <span className="aether-bh-label">SINGULARITY</span>
        </motion.div>

        {/* Explosions */}
        {explosions.map(exp => (
          <motion.div
            key={exp.id}
            className="aether-explosion"
            style={{ left: exp.x - 40, top: exp.y - 40 }}
            initial={{ scale: 0.3, opacity: 1 }}
            animate={{ scale: 3, opacity: 0 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
          />
        ))}

        {/* === STAR ORBIT RINGS === */}
        <svg className="aether-orbits-svg">
          {stars.map(s => (
            <circle key={s.id} cx={s.position.x} cy={s.position.y} r={STAR_CAPTURE_R}
              fill="none" stroke="var(--accent)" strokeWidth="1" strokeDasharray="5 6" opacity={0.22} />
          ))}
          {planets.map(p => {
            const pp = getPos(p, 'planet')
            return (
              <circle key={p.id} cx={pp.x} cy={pp.y} r={PLANET_CAPTURE_R}
                fill="none" stroke="var(--accent-dim)" strokeWidth="0.7" strokeDasharray="3 5" opacity={0.14} />
            )
          })}
        </svg>

        {/* === STARS === */}
        {stars.map(s => (
          <motion.div
            key={s.id}
            className="aether-star-node"
            style={{ left: s.position.x - 45, top: s.position.y - 45 }}
            drag
            dragMomentum={false}
            onDrag={(_, info) => handleStarDragging(s.id, info)}
            onDragEnd={(_, info) => handleStarDragEnd(s.id, info)}
            onClick={() => setSelPlanet(null)}
            animate={sucked.has(s.id) ? { scale: 0, rotate: 180, opacity: 0 } : { scale: [1, 1.04, 1] }}
            transition={sucked.has(s.id) ? { duration: 0.45, ease: 'easeIn' } : { duration: 3 + Math.random(), repeat: Infinity, ease: 'easeInOut' }}
            whileHover={{ scale: 1.12 }}
          >
            <svg width="90" height="90" viewBox="0 0 90 90" className="aether-star-svg">
              <circle cx="45" cy="45" r="38" fill="url(#star-grad)" opacity="0.95" />
            </svg>
            {renderName(s.name, () => setEditing({ type: 'star', id: s.id, field: 'name' }), 'star-name')}
            {renderContent(s.content, () => setEditing({ type: 'star', id: s.id, field: 'content' }), 80)}
          </motion.div>
        ))}

        {/* === PLANETS === */}
        {planets.map(p => {
          const pp = getPos(p, 'planet')
          return (
            <motion.div
              key={p.id}
              className="aether-planet-node"
              style={{ left: pp.x - 28, top: pp.y - 28 }}
              drag={!p.isCaptured}
              dragMomentum={false}
              onDragEnd={!p.isCaptured ? (_, info) => handlePlanetDragEnd(p.id, info) : undefined}
              onClick={(e) => { e.stopPropagation(); if (p.isCaptured) releasePlanet(p.id); else setSelPlanet(p.id === selPlanet ? null : p.id) }}
              animate={sucked.has(p.id) ? { scale: 0, rotate: -90, opacity: 0 } : {}}
              transition={sucked.has(p.id) ? { duration: 0.45, ease: 'easeIn' } : {}}
              whileHover={{ scale: 1.15 }}
              whileTap={!p.isCaptured ? { scale: 0.95 } : {}}
            >
              <svg width="56" height="56" viewBox="0 0 56 56" className="aether-planet-svg">
                <circle cx="28" cy="28" r="24" fill="url(#planet-grad)" />
              </svg>
              {renderName(p.name, () => setEditing({ type: 'planet', id: p.id, field: 'name' }), 'planet-name')}
              {renderContent(p.content, () => setEditing({ type: 'planet', id: p.id, field: 'content' }), 50)}
              {selPlanet === p.id && <div className="aether-sel-indicator" />}
            </motion.div>
          )
        })}

        {/* === MOONS === */}
        {moons.map(m => {
          const mp = getPos(m, 'moon')
          return (
            <motion.div
              key={m.id}
              className="aether-moon-node"
              style={{ left: mp.x - 12, top: mp.y - 12 }}
              drag={!m.isCaptured}
              dragMomentum={false}
              onDragEnd={!m.isCaptured ? (_, info) => handleMoonDragEnd(m.id, info) : undefined}
              onClick={(e) => { e.stopPropagation(); if (m.isCaptured) releaseMoon(m.id) }}
              animate={sucked.has(m.id) ? { scale: 0, opacity: 0 } : {}}
              transition={sucked.has(m.id) ? { duration: 0.35, ease: 'easeIn' } : {}}
              whileHover={{ scale: 1.2 }}
              whileTap={!m.isCaptured ? { scale: 0.9 } : {}}
            >
              <svg width="24" height="24" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" fill="url(#moon-grad)" />
              </svg>
              {renderName(m.name, () => setEditing({ type: 'moon', id: m.id, field: 'name' }), 'moon-name')}
            </motion.div>
          )
        })}

        {/* Empty state */}
        {stars.length === 0 && planets.length === 0 && moons.length === 0 && (
          <motion.div className="aether-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            <div className="aether-empty-glyph">◈</div>
            <p className="aether-empty-title">Aether Map</p>
            <p className="aether-empty-sub">Multiverse Memo — use the console below to create stars</p>
          </motion.div>
        )}
      </div>

      {/* === INLINE EDIT OVERLAY === */}
      {editing && (() => {
        let ex, ey, val
        const findObj = (arr, id) => arr.find(x => x.id === id)
        const obj = editing.type === 'star' ? findObj(stars, editing.id)
          : editing.type === 'planet' ? findObj(planets, editing.id)
          : findObj(moons, editing.id)
        if (!obj) return null
        const pos = editing.type === 'star' ? obj.position
          : editing.type === 'planet' ? getPos(obj, 'planet')
          : getPos(obj, 'moon')
        ex = pos.x; ey = pos.y; val = obj[editing.field]
        return (
          <div className="aether-rename-overlay" onClick={() => commitEdit(val)}>
            <input ref={editRef} className="aether-rename-input"
              style={{ left: (ex + pan.x) * zoomLvl, top: (ey + pan.y + 40) * zoomLvl }}
              defaultValue={val}
              onKeyDown={e => { if (e.key === 'Enter') commitEdit(e.target.value); if (e.key === 'Escape') setEditing(null) }}
              onBlur={e => commitEdit(e.target.value)}
              onClick={e => e.stopPropagation()}
              spellCheck={false}
            />
          </div>
        )
      })()}

      {/* === CONSOLE BAR === */}
      <div className="aether-console">
        <div className="aether-console-inner">
          <motion.button className="aether-btn" onClick={() => memoStore.createStar()}
            whileHover="hover" whileTap="tap"
            variants={{ hover: { borderColor: 'var(--accent)', boxShadow: 'inset 0 0 18px rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.12)' }, tap: { scale: 0.93 } }}>
            <span className="aether-btn-icon">✚</span><span>恒星</span>
          </motion.button>
          <motion.button className="aether-btn" onClick={() => memoStore.addPlanet()}
            whileHover="hover" whileTap="tap"
            variants={{ hover: { borderColor: 'var(--accent)', boxShadow: 'inset 0 0 18px rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.12)' }, tap: { scale: 0.93 } }}>
            <span className="aether-btn-icon">✚</span><span>行星</span>
          </motion.button>
          <motion.button
            className={`aether-btn ${!selPlanet ? 'aether-btn-disabled' : ''}`}
            onClick={() => { if (selPlanet) { memoStore.addMoon('', selPlanet); setSelPlanet(null) } }}
            whileHover={selPlanet ? "hover" : undefined} whileTap={selPlanet ? "tap" : undefined}
            variants={{ hover: { borderColor: 'var(--accent)', boxShadow: 'inset 0 0 18px rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.12)' }, tap: { scale: 0.93 } }}
            title={selPlanet ? 'Add moon to selected planet' : 'Click a planet first to enable'}
          >
            <span className="aether-btn-icon">✚</span><span>卫星</span>
          </motion.button>
          <motion.button className="aether-btn aether-btn-organize" onClick={handleOrganize}
            whileHover="hover" whileTap="tap"
            variants={{ hover: { borderColor: 'var(--accent)', boxShadow: 'inset 0 0 18px rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.12)' }, tap: { scale: 0.93 } }}>
            <span className="aether-btn-icon">⟳</span><span>整理星系</span>
          </motion.button>
          <div className="aether-console-divider" />
          <span className="aether-console-hint">
            <kbd>Esc</kbd> 返回 · 双击改名 · 拖拽捕获 · 黑洞销毁 · 滚轮缩放
          </span>
        </div>
      </div>
    </div>
  )
}
