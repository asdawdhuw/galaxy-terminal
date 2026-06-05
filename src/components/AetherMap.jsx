import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { store, genId, randSpeed, memoStore } from './memoStore'

/* ================================================================
   Constants
   ================================================================ */
const STAR_CAPTURE_R = 600
const PLANET_CAPTURE_R = 250
const MIN_ZOOM = 0.2, MAX_ZOOM = 2.0

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
  const [tick, setTick] = useState(0)
  const [editing, setEditing] = useState(null) // { type, id }
  const [selPlanet, setSelPlanet] = useState(null) // selected planet for deletion
  const [selStar, setSelStar] = useState(null) // selected star for deletion
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
    const cx = 750, cy = 500
    setPan({
      x: rect.width / (2 * zoom) - cx,
      y: rect.height / (2 * zoom) - cy,
    })
    setViewCentered(true)
  }, [zoom, viewCentered])
  const [draggingPane, setDraggingPane] = useState(false)
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
    }
    store.subs.add(sync)
    return () => { store.subs.delete(sync) }
  }, [])

  const syncStars = useCallback(fn => { setStars(prev => { const n = fn(prev); store.stars = n; return n }) }, [])
  const syncPlanets = useCallback(fn => { setPlanets(prev => { const n = fn(prev); store.planets = n; return n }) }, [])

  /* ================================================================
     Physics loop — compute orbital positions (hierarchical)
     ================================================================ */
  useEffect(() => {
    let running = true
    function loop() {
      if (!running) return
      let dirty = false
      const pos = physicsRef.current
      const editingId = editing?.id

      for (const p of store.planets) {
        if (!p.isCaptured || !p.starId) continue
        const star = store.stars.find(s => s.id === p.starId)
        if (!star) continue
        if (!pos[p.id]) pos[p.id] = { x: 0, y: 0, angle: p.angle }
        // Pause orbit while editing this body
        if (p.id !== editingId) {
          pos[p.id].angle += p.speed
        }
        pos[p.id].x = star.position.x + p.orbitR * Math.cos(pos[p.id].angle)
        pos[p.id].y = star.position.y + p.orbitR * Math.sin(pos[p.id].angle)
        dirty = true
      }

      if (dirty) setTick(t => t + 1)
      animRef.current = requestAnimationFrame(loop)
    }
    animRef.current = requestAnimationFrame(loop)
    return () => { running = false; cancelAnimationFrame(animRef.current) }
  }, [editing])

  /* ================================================================
     Resolve display position
     ================================================================ */
  const getPos = useCallback((obj) => {
    if (obj.isCaptured) {
      const pp = physicsRef.current[obj.id]
      if (pp) return { x: pp.x, y: pp.y }
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
    setSelStar(null); setSelPlanet(null)
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
    syncStars(prev => prev.map(s => s.id === starId ? { ...s, position: { x, y } } : s))
  }
  function handleStarDragging(starId, info) {
    const { x, y } = getContainerPos(info.point)
    const s = store.stars.find(s2 => s2.id === starId)
    if (s) { s.position.x = x; s.position.y = y }
  }

  // Planet drag — live update position during drag (for captured planets too)
  function handlePlanetDragging(planetId, info) {
    const { x, y } = getContainerPos(info.point)
    const p = store.planets.find(p2 => p2.id === planetId)
    if (!p) return
    if (p.isCaptured) {
      // Temporarily track position in physicsRef so getPos returns drag coords
      if (!physicsRef.current[p.id]) physicsRef.current[p.id] = { x: 0, y: 0, angle: p.angle }
      physicsRef.current[p.id].x = x
      physicsRef.current[p.id].y = y
      setTick(t => t + 1)
    } else {
      p.x = x; p.y = y
    }
  }

  // Planet drag
  function handlePlanetDragEnd(planetId, info) {
    const { x, y } = getContainerPos(info.point)

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
        // Keep existing orbitR if already captured by same star, else use actual distance
        const orbitR = (p.isCaptured && p.starId === capStar.id) ? p.orbitR : Math.hypot(x - capStar.position.x, y - capStar.position.y)
        return { ...p, isCaptured: true, starId: capStar.id, orbitR, speed: randSpeed(), angle }
      }))
    } else {
      // Released — clear physicsRef so getPos returns stored x,y
      delete physicsRef.current[planetId]
      syncPlanets(prev => prev.map(p => p.id === planetId ? { ...p, x, y, isCaptured: false, starId: null } : p))
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
  }

  /* ================================================================
     Organize
     ================================================================ */
  function handleOrganize() {
    if (store.stars.length === 0) return

    const BASE_ORBIT_R = 100
    const ORBIT_SPACING = 120

    // Assign every planet to its nearest star
    const groups = new Map()
    for (const s of store.stars) groups.set(s.id, [])

    for (const p of store.planets) {
      // Use live physics position for captured planets, stored position for free ones
      const pp = physicsRef.current[p.id]
      const px = pp?.x ?? p.x
      const py = pp?.y ?? p.y
      let best = null, bestD = Infinity
      for (const s of store.stars) {
        const d = Math.hypot(px - s.position.x, py - s.position.y)
        if (d < bestD) { bestD = d; best = s }
      }
      if (best) groups.get(best.id).push(p)
    }

    // Sort each group by angle so orbit radii are assigned consistently
    for (const [starId, group] of groups) {
      const star = store.stars.find(s => s.id === starId)
      if (!star) continue
      group.sort((a, b) => {
        const ppA = physicsRef.current[a.id]
        const ax = ppA?.x ?? a.x, ay = ppA?.y ?? a.y
        const ppB = physicsRef.current[b.id]
        const bx = ppB?.x ?? b.x, by = ppB?.y ?? b.y
        const angA = Math.atan2(ay - star.position.y, ax - star.position.x)
        const angB = Math.atan2(by - star.position.y, bx - star.position.x)
        return angA - angB
      })
    }

    syncPlanets(prev => prev.map(p => {
      // Find which star this planet belongs to
      let starId = null
      for (const [sid, group] of groups) {
        if (group.includes(p)) { starId = sid; break }
      }
      if (!starId) return p
      const star = store.stars.find(s => s.id === starId)
      const group = groups.get(starId)
      const idx = group.indexOf(p)
      const pp = physicsRef.current[p.id]
      const px = pp?.x ?? p.x, py = pp?.y ?? p.y
      const angle = Math.atan2(py - star.position.y, px - star.position.x)
      const orbitR = BASE_ORBIT_R + idx * ORBIT_SPACING
      if (!physicsRef.current[p.id]) physicsRef.current[p.id] = { x: 0, y: 0, angle }
      else physicsRef.current[p.id].angle = angle
      return { ...p, isCaptured: true, starId, orbitR, speed: Math.abs(randSpeed()), angle }
    }))
  }

  /* ================================================================
     Rename & Content editing
     ================================================================ */
  function commitEdit(val) {
    const v = val.trim()
    if (editing && v) {
      const fn = editing.type === 'star' ? syncStars : syncPlanets
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
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
        if (editing) return // don't delete while editing name
        if (selStar) {
          memoStore.removeStar(selStar); setSelStar(null); setSelPlanet(null); return
        }
        if (selPlanet) {
          memoStore.removePlanet(selPlanet); setSelPlanet(null); return
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, editing, selStar, selPlanet])

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
        {/* === ORBIT RINGS & PATHS === */}
        <svg className="aether-orbits-svg">
          {/* Capture zones — faint dashed rings */}
          {stars.map(s => (
            <circle key={s.id} cx={s.position.x} cy={s.position.y} r={STAR_CAPTURE_R}
              fill="none" stroke="var(--accent)" strokeWidth="0.8" strokeDasharray="4 8" opacity={0.15} />
          ))}
          {planets.map(p => {
            const pp = getPos(p)
            return (
              <circle key={p.id} cx={pp.x} cy={pp.y} r={PLANET_CAPTURE_R}
                fill="none" stroke="var(--accent-dim)" strokeWidth="0.6" strokeDasharray="3 6" opacity={0.1} />
            )
          })}
          {/* Actual orbit paths — planets around their stars */}
          {planets.filter(p => p.isCaptured && p.starId).map(p => {
            const star = store.stars.find(s => s.id === p.starId)
            if (!star) return null
            return (
              <circle key={`orbit-${p.id}`} cx={star.position.x} cy={star.position.y} r={p.orbitR}
                fill="none" stroke="var(--accent)" strokeWidth="1.2" strokeDasharray="6 4" opacity={0.35} />
            )
          })}
        </svg>

        {/* === STARS === */}
        {stars.map(s => (
          <motion.div
            key={s.id}
            className="aether-star-node"
            style={{ left: s.position.x, top: s.position.y }}
            drag
            dragMomentum={false}
            onDrag={(_, info) => handleStarDragging(s.id, info)}
            onDragEnd={(_, info) => handleStarDragEnd(s.id, info)}
            onClick={(e) => { e.stopPropagation(); setSelStar(s.id === selStar ? null : s.id); setSelPlanet(null) }}
            animate={{ scale: [1, 1.04, 1] }}
            transition={{ duration: 3 + Math.random(), repeat: Infinity, ease: 'easeInOut' }}
            whileHover={{ scale: 1.12 }}
          >
            <div className="aether-cell-wrap">
              <svg width="90" height="90" viewBox="0 0 90 90" className="aether-star-svg">
                <circle cx="45" cy="45" r="38" fill="url(#star-grad)" opacity="0.95" />
              </svg>
              {renderName(s.name, () => setEditing({ type: 'star', id: s.id, field: 'name' }), 'star-name')}
              {renderContent(s.content, () => setEditing({ type: 'star', id: s.id, field: 'content' }), 80)}
              {selStar === s.id && <div className="aether-sel-indicator" />}
            </div>
          </motion.div>
        ))}

        {/* === PLANETS === */}
        {planets.map(p => {
          const pp = getPos(p)
          return (
            <motion.div
              key={p.id}
              className="aether-planet-node"
              style={{ left: pp.x, top: pp.y }}
              drag
              dragMomentum={false}
              onDrag={(_, info) => { if (p.isCaptured) handlePlanetDragging(p.id, info) }}
              onDragEnd={(_, info) => handlePlanetDragEnd(p.id, info)}
              onClick={(e) => { e.stopPropagation(); setSelStar(null); setSelPlanet(p.id === selPlanet ? null : p.id) }}
              onDoubleClick={(e) => { e.stopPropagation(); if (p.isCaptured) releasePlanet(p.id) }}
              animate={{}}
              transition={{}}
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.95 }}
            >
              <div className="aether-cell-wrap">
                <svg width="56" height="56" viewBox="0 0 56 56" className="aether-planet-svg">
                  <circle cx="28" cy="28" r="24" fill="url(#planet-grad)" />
                </svg>
                {renderName(p.name, () => setEditing({ type: 'planet', id: p.id, field: 'name' }), 'planet-name')}
                {renderContent(p.content, () => setEditing({ type: 'planet', id: p.id, field: 'content' }), 50)}
                {selPlanet === p.id && <div className="aether-sel-indicator" />}
              </div>
            </motion.div>
          )
        })}

        {/* Empty state */}
        {stars.length === 0 && planets.length === 0 && (
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
          : findObj(planets, editing.id)
        if (!obj) return null
        const pos = editing.type === 'star' ? obj.position
          : getPos(obj)
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
          <motion.button
            className={`aether-btn${stars.length >= 1 ? ' aether-btn-disabled' : ''}`}
            onClick={() => memoStore.createStar()}
            whileHover={stars.length >= 1 ? undefined : "hover"}
            whileTap={stars.length >= 1 ? undefined : "tap"}
            variants={{ hover: { borderColor: 'var(--accent)', boxShadow: 'inset 0 0 18px rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.12)' }, tap: { scale: 0.93 } }}>
            <span className="aether-btn-icon">{stars.length >= 1 ? '✓' : '✚'}</span><span>恒星</span>
          </motion.button>
          <motion.button className="aether-btn" onClick={() => memoStore.addPlanet()}
            whileHover="hover" whileTap="tap"
            variants={{ hover: { borderColor: 'var(--accent)', boxShadow: 'inset 0 0 18px rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.12)' }, tap: { scale: 0.93 } }}>
            <span className="aether-btn-icon">✚</span><span>行星</span>
          </motion.button>
          <motion.button className="aether-btn aether-btn-organize" onClick={handleOrganize}
            whileHover="hover" whileTap="tap"
            variants={{ hover: { borderColor: 'var(--accent)', boxShadow: 'inset 0 0 18px rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.12)' }, tap: { scale: 0.93 } }}>
            <span className="aether-btn-icon">⟳</span><span>整理星系</span>
          </motion.button>
          <div className="aether-console-divider" />
          <span className="aether-console-hint">
            <kbd>Esc</kbd> 返回 · 双击改名/释放 · 拖拽捕获 · <kbd>Delete</kbd> 删除 · 滚轮缩放
          </span>
        </div>
      </div>
    </div>
  )
}
