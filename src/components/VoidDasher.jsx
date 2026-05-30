import { useRef, useEffect, useState } from 'react'
import l1Bgm from '../../sound/bgm/l1-dark-matter.mp3'
import l2Bgm from '../../sound/bgm/l2-flight-of-the-cosmos.mp3'
import l3Bgm from '../../sound/bgm/l3-darkwave-storm.mp3'

/* ================================================================
   Void Dasher — cosmic action-platformer mini-game
   WASD move  |  Space = laser sword  |  Esc = pause
   ================================================================ */

const GRAVITY = 900
const GRAVITY_FALL = 1350
const PLAYER_SPEED = 280
const CRAWLER_PATROL_SPEED = 50
const JUMP_VEL = -520
const SWORD_COOLDOWN = 0.35
const SWORD_REACH = 52
const SWORD_ARC = Math.PI * 0.7
const SWORD_DAMAGE = 2
const INVINCIBLE_TIME = 0.8
const CONTACT_DMG_COOLDOWN = 0.5
const COYOTE_TIME = 0.1
const JUMP_BUFFER = 0.1

// ---- Sound engine (Web Audio API) ----
let _audioCtx = null
function ctx() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  if (_audioCtx.state === 'suspended') _audioCtx.resume()
  return _audioCtx
}
function sfxSlash() {
  const c = ctx(); const t = c.currentTime
  const o = c.createOscillator(); const g = c.createGain()
  o.type = 'sawtooth'; o.frequency.setValueAtTime(800, t); o.frequency.linearRampToValueAtTime(200, t + 0.15)
  g.gain.setValueAtTime(0.15, t); g.gain.linearRampToValueAtTime(0, t + 0.15)
  o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 0.15)
}
function sfxHit() {
  const c = ctx(); const t = c.currentTime
  const o = c.createOscillator(); const g = c.createGain()
  o.type = 'square'; o.frequency.setValueAtTime(180, t); o.frequency.linearRampToValueAtTime(80, t + 0.08)
  g.gain.setValueAtTime(0.12, t); g.gain.linearRampToValueAtTime(0, t + 0.08)
  o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 0.08)
}
function sfxDeath() {
  const c = ctx(); const t = c.currentTime
  const o = c.createOscillator(); const g = c.createGain()
  o.type = 'sine'; o.frequency.setValueAtTime(300, t); o.frequency.linearRampToValueAtTime(40, t + 0.35)
  g.gain.setValueAtTime(0.15, t); g.gain.linearRampToValueAtTime(0, t + 0.35)
  o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 0.35)
}
function sfxHurt() {
  const c = ctx(); const t = c.currentTime
  const o = c.createOscillator(); const g = c.createGain()
  o.type = 'sawtooth'; o.frequency.setValueAtTime(150, t); o.frequency.linearRampToValueAtTime(50, t + 0.18)
  g.gain.setValueAtTime(0.15, t); g.gain.linearRampToValueAtTime(0, t + 0.18)
  o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 0.18)
}
function sfxClear() {
  const c = ctx(); const t = c.currentTime
  ;[523, 659, 784].forEach((freq, i) => {
    const o = c.createOscillator(); const g = c.createGain()
    o.type = 'sine'; o.frequency.value = freq
    g.gain.setValueAtTime(0, t + i * 0.12); g.gain.linearRampToValueAtTime(0.15, t + i * 0.12 + 0.02)
    g.gain.linearRampToValueAtTime(0, t + i * 0.12 + 0.3)
    o.connect(g); g.connect(c.destination); o.start(t + i * 0.12); o.stop(t + i * 0.12 + 0.3)
  })
}
function sfxBoss() {
  const c = ctx(); const t = c.currentTime
  const o = c.createOscillator(); const g = c.createGain()
  o.type = 'square'; o.frequency.setValueAtTime(60, t)
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.08, t + 0.1)
  g.gain.linearRampToValueAtTime(0, t + 0.5); g.gain.linearRampToValueAtTime(0.08, t + 0.6)
  o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 0.6)
}
function sfxExplosion() {
  const c = ctx(); const t = c.currentTime
  const o = c.createOscillator(); const g = c.createGain()
  o.type = 'sawtooth'; o.frequency.setValueAtTime(120, t); o.frequency.linearRampToValueAtTime(30, t + 0.8)
  g.gain.setValueAtTime(0.25, t); g.gain.linearRampToValueAtTime(0, t + 0.8)
  o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 0.8)
}

// ---- Level definitions ----
const LEVELS = [
  {
    name: 'Stardust Ruins', crawlers: 3, orbs: 0, boss: false,
    platforms: [
      { x: 0, y: 540, w: 900, h: 100 },
      { x: 100, y: 410, w: 140, h: 14 },
      { x: 380, y: 340, w: 140, h: 14 },
      { x: 620, y: 410, w: 140, h: 14 },
    ]
  },
  {
    name: 'Void Rift', crawlers: 4, orbs: 2, boss: false,
    platforms: [
      { x: 0, y: 540, w: 900, h: 100 },
      { x: 60, y: 430, w: 110, h: 12 },
      { x: 260, y: 360, w: 110, h: 12 },
      { x: 480, y: 290, w: 140, h: 12 },
      { x: 680, y: 380, w: 110, h: 12 },
    ]
  },
  {
    name: 'Black Hole Core', crawlers: 0, orbs: 0, boss: true,
    platforms: [
      { x: 0, y: 540, w: 900, h: 100 },
      { x: 300, y: 420, w: 300, h: 14 },
      { x: 100, y: 310, w: 120, h: 12 },
      { x: 680, y: 310, w: 120, h: 12 },
    ]
  },
]

// ---- Helpers ----
function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}
function pointInSector(px, py, cx, cy, facing, radius, halfAngle) {
  const dx = px - cx; const dy = py - cy
  if (dx * dx + dy * dy > radius * radius) return false
  let angle = Math.atan2(dy, dx)
  let diff = angle - (facing > 0 ? 0 : Math.PI)
  while (diff > Math.PI) diff -= Math.PI * 2
  while (diff < -Math.PI) diff += Math.PI * 2
  return Math.abs(diff) <= halfAngle
}
function readAccent() {
  return { r: 56, g: 189, b: 248 }
}
function spawnParticles(list, x, y, count, color, speed, opts) {
  const lm = (opts && opts.lifeMult) || 1
  const sh = (opts && opts.shape) || 'circle'
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2
    const s = speed * (0.4 + Math.random() * 0.6)
    list.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: (0.35 + Math.random() * 0.25) * lm, maxLife: 0.45 * lm, size: 1.5 + Math.random() * 2.5, color, shape: sh })
  }
}

// ---- Boss helper: jagged spike polygon ----
function bossSpikeVerts(cx, cy, count, innerR, outerR, phase) {
  const verts = []
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + phase
    const jitter = 1 + Math.sin(i * 3.7) * 0.2  // random-looking variation
    verts.push({ x: cx + Math.cos(a - Math.PI / count) * innerR * jitter, y: cy + Math.sin(a - Math.PI / count) * innerR * jitter })
    verts.push({ x: cx + Math.cos(a) * outerR * jitter, y: cy + Math.sin(a) * outerR * jitter })
  }
  return verts
}

export default function VoidDasher({ onClose }) {
  const GAME_W = 900
  const GAME_H = 640
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const keysRef = useRef({})
  const rafRef = useRef(0)
  const [pinned, setPinned] = useState(false)
  const togglePin = async () => {
    const r = await window.terminal?.toggleGamePin()
    if (r) setPinned(r.pinned)
  }

  useEffect(() => {
    try {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = GAME_W * dpr
    canvas.height = GAME_H * dpr
    const ctx2d = canvas.getContext('2d')
    ctx2d.scale(dpr, dpr)
    const cw = GAME_W
    const ch = GAME_H

    const accent = readAccent()
    const ac = (a = 1) => `rgba(${accent.r},${accent.g},${accent.b},${a})`

    // ---- State ----
    const s = {
      levelIdx: 0,
      player: { x: 200, y: 504, w: 28, h: 42, vx: 0, vy: 0, facing: 1, grounded: false,
        health: 30, maxHealth: 30, swordTimer: 0, invTimer: 0, dmgTimer: 0,
        animTimer: 0, coyoteTimer: 0, jumpBuffer: 0, wasGrounded: false,
        slashPhase: -1, slashTimer: 0 },
      enemies: [],
      particles: [],
      kills: 0,
      paused: false,
      gameOver: false,
      levelClear: false,
      clearTimer: 0,
      stars: [],
      time: 0,
      screenShake: 0,
      flashAlpha: 0,
    }
    stateRef.current = s

    for (let i = 0; i < 180; i++) {
      s.stars.push({ x: Math.random() * cw, y: Math.random() * ch, r: 0.3 + Math.random() * 1.5, o: 0.3 + Math.random() * 0.5, s: 0.2 + Math.random() * 0.6 })
    }

    function spawnLevel(idx) {
      const lv = LEVELS[idx]
      s.enemies = []
      s.particles = []
      s.levelClear = false
      s.clearTimer = 0
      s.screenShake = 0
      s.flashAlpha = 0
      const p = s.player
      p.x = 200; p.y = 504; p.vx = 0; p.vy = 0
      p.health = Math.min(p.health + 8, p.maxHealth)
      p.swordTimer = 0; p.invTimer = 0; p.dmgTimer = 0
      p.animTimer = 0; p.coyoteTimer = 0; p.jumpBuffer = 0; p.wasGrounded = false
      p.slashPhase = -1; p.slashTimer = 0

      const upperPlats = lv.platforms.filter(p => p.w >= 100 && p.y < 500)
      const crawlPlats = upperPlats.length >= lv.crawlers ? upperPlats : lv.platforms.filter(p => p.w >= 100)
      const shuffled = [...crawlPlats].sort(() => Math.random() - 0.5)
      for (let i = 0; i < lv.crawlers; i++) {
        const plat = shuffled[i % shuffled.length]
        const rx = plat.x + 24 + Math.random() * (plat.w - 72)
        s.enemies.push({ type: 'crawler', x: rx, y: plat.y - 28, w: 28, h: 30,
          vx: (Math.random() > 0.5 ? 1 : -1) * (45 + Math.random() * 30), vy: 0,
          health: 5, maxHealth: 5, grounded: false, stunTimer: 0,
          hitFlash: 0, animTimer: Math.random() * 2,
          rushTimer: 0, rushCooldown: 0 })
      }
      for (let i = 0; i < lv.orbs; i++) {
        const rx = 80 + Math.random() * (cw - 160)
        const ry = 120 + Math.random() * 260
        s.enemies.push({ type: 'floater', x: rx, y: ry, w: 26, h: 38, vx: 0, vy: 0,
          health: 4, maxHealth: 4, baseY: ry, timer: Math.random() * 3,
          hitFlash: 0, animTimer: Math.random() * 2, spitTimer: 0 })
      }
      if (lv.boss) {
        s.enemies.push({
          type: 'boss', x: 420, y: 300, w: 80, h: 80, vx: 0, vy: 0,
          health: 50, maxHealth: 50, grounded: false,
          phase: 0, timer: 0, state: 'idle', attackTimer: 2.5,
          growScale: 1, spikePhase: 0, eyePhase: 0,
          shockwaveTimer: 3, shockwaveActive: 0,
          fragThrowTimer: 5, frags: [],
          beamCharge: 0, beamActive: 0, beamWarning: 0,
          singularityTimer: 8, singularityActive: 0,
          transitionTimer: 0, transitioningFrom: -1,
          deathTimer: 0, deathPhase: 0, hitFlash: 0,
          // Init orbiting fragments
          orbData: [
            { a: 0, spd: 0.8, rx: 70, ry: 55, size: 14, trail: [] },
            { a: Math.PI * 0.7, spd: 1.2, rx: 60, ry: 50, size: 12, trail: [] },
            { a: Math.PI * 1.4, spd: 1.6, rx: 75, ry: 60, size: 13, trail: [] },
          ]
        })
        sfxBoss()
      }
      switchBgm(idx)
    }

    // ---- BGM ----
    const bgmTracks = [new Audio(l1Bgm), new Audio(l2Bgm), new Audio(l3Bgm)]
    bgmTracks.forEach(a => { a.loop = true; a.volume = 0.35 })
    let currentBgm = bgmTracks[0]
    currentBgm.play().catch(() => {})

    function switchBgm(idx) {
      if (currentBgm === bgmTracks[idx]) return
      currentBgm.pause(); currentBgm.currentTime = 0
      currentBgm = bgmTracks[idx]
      currentBgm.play().catch(() => {})
    }

    spawnLevel(0)

    // ---- Keyboard ----
    function onKD(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      const preventKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Escape', 'KeyR', 'KeyX']
      if (preventKeys.includes(e.code)) e.preventDefault()
      keysRef.current[e.code] = true
      if (e.code === 'Escape') { s.paused = !s.paused }
      if (e.code === 'KeyX') { onClose?.() }
      if (e.code === 'KeyR' && s.gameOver) { s.gameOver = false; s.kills = 0; s.player.health = 30; s.levelIdx = 0; spawnLevel(0) }
      if (e.code === 'Space') {
        if (s.player.swordTimer <= 0 && !s.gameOver && !s.levelClear && !s.paused) {
          s.player.swordTimer = SWORD_COOLDOWN
          s.player.slashPhase = 0; s.player.slashTimer = 0
          for (const en of s.enemies) en.hitByThisSwing = false
          sfxSlash()
        }
      }
    }
    function onKU(e) { keysRef.current[e.code] = false }
    window.addEventListener('keydown', onKD, { capture: true })
    window.addEventListener('keyup', onKU, { capture: true })

    // ---- Game Loop ----
    let lastT = 0
    function loop(ts) {
      const dt = Math.min((ts - lastT) / 1000, 0.05)
      lastT = ts
      s.time += dt
      if (s.screenShake > 0) s.screenShake = Math.max(0, s.screenShake - dt)
      if (s.flashAlpha > 0) s.flashAlpha = Math.max(0, s.flashAlpha - dt * 2)
      const keys = keysRef.current
      const p = s.player
      const lv = LEVELS[s.levelIdx]
      const plats = lv.platforms

      // Find the boss
      const boss = s.enemies.find(e => e.type === 'boss' && e.health > 0)

      if (!s.paused && !s.gameOver && !s.levelClear) {
        // ---- Player movement ----
        if (keys['KeyA'] || keys['ArrowLeft']) { p.vx = -PLAYER_SPEED; p.facing = -1 }
        else if (keys['KeyD'] || keys['ArrowRight']) { p.vx = PLAYER_SPEED; p.facing = 1 }
        else p.vx *= 0.82

        if (keys['KeyW'] || keys['ArrowUp']) {
          if (p.grounded || p.coyoteTimer > 0) {
            p.vy = JUMP_VEL; p.grounded = false; p.coyoteTimer = 0
            spawnParticles(s.particles, p.x + p.w / 2 - 4, p.y + p.h, 3, ac(0.6), 60, { shape: 'circle' })
            spawnParticles(s.particles, p.x + p.w / 2 + 4, p.y + p.h, 3, ac(0.6), 60, { shape: 'circle' })
          } else if (!p.grounded) {
            p.jumpBuffer = JUMP_BUFFER
          }
        }
        if (p.jumpBuffer > 0) {
          p.jumpBuffer -= dt
          if (p.grounded && p.jumpBuffer > 0) { p.vy = JUMP_VEL; p.grounded = false; p.jumpBuffer = 0 }
        }

        // Boss singularity pull on player
        if (boss && boss.singularityActive > 0) {
          const dx = (boss.x + boss.w / 2) - (p.x + p.w / 2)
          const dy = (boss.y + boss.h / 2) - (p.y + p.h / 2)
          const d = Math.sqrt(dx * dx + dy * dy) || 1
          p.vx += (dx / d) * 60 * dt
          p.vy += (dy / d) * 60 * dt
        }

        const grav = p.vy > 0 ? GRAVITY_FALL : GRAVITY
        p.vy += grav * dt
        p.x += p.vx * dt
        p.y += p.vy * dt

        p.wasGrounded = p.grounded
        p.grounded = false
        if (p.coyoteTimer > 0) p.coyoteTimer -= dt

        // Player vs platforms
        for (const plt of plats) {
          if (aabb(p, plt)) {
            const overlapL = (p.x + p.w) - plt.x
            const overlapR = (plt.x + plt.w) - p.x
            const overlapT = (p.y + p.h) - plt.y
            const overlapB = (plt.y + plt.h) - p.y
            if (p.vy >= 0 && overlapT < overlapB && overlapT <= overlapL && overlapT <= overlapR) {
              p.y = plt.y - p.h; p.vy = 0; p.grounded = true
            } else if (p.vy < 0 && overlapB <= overlapT) {
              p.y = plt.y + plt.h; p.vy = 0
            } else if (overlapL <= overlapR) {
              p.x = plt.x - p.w
            } else {
              p.x = plt.x + plt.w
            }
          }
        }
        if (p.wasGrounded && !p.grounded && p.vy > 0) p.coyoteTimer = COYOTE_TIME
        p.x = Math.max(0, Math.min(cw - p.w, p.x))
        if (p.y > ch + 100) { p.y = 200; p.vy = 0 }

        p.animTimer += dt
        if (p.swordTimer > 0) p.swordTimer -= dt
        if (p.invTimer > 0) p.invTimer -= dt
        if (p.dmgTimer > 0) p.dmgTimer -= dt

        // Sword slash animation
        if (p.slashPhase >= 0) {
          p.slashTimer += dt
          if (p.slashTimer < 0.06) p.slashPhase = 0
          else if (p.slashTimer < 0.18) p.slashPhase = 1
          else if (p.slashTimer < 0.24) p.slashPhase = 2
          else { p.slashPhase = -1; p.slashTimer = 0 }
        }

        // Sword hit detection
        if (p.slashPhase === 1) {
          const scx = p.x + p.w / 2; const scy = p.y + p.h / 2
          const halfArc = SWORD_ARC / 2
          for (const en of s.enemies) {
            if (en.health <= 0 || en.hitByThisSwing) continue
            const pts = [
              { x: en.x, y: en.y }, { x: en.x + en.w, y: en.y },
              { x: en.x, y: en.y + en.h }, { x: en.x + en.w, y: en.y + en.h },
              { x: en.x + en.w / 2, y: en.y + en.h / 2 },
            ]
            let hit = false
            for (const pt of pts) {
              if (pointInSector(pt.x, pt.y, scx, scy, p.facing, SWORD_REACH, halfArc)) { hit = true; break }
            }
            const edx = (en.x + en.w / 2) - scx; const edy = (en.y + en.h / 2) - scy
            if (edx * edx + edy * edy < 625) hit = true
            if (!hit) continue

            en.health -= SWORD_DAMAGE
            en.hitByThisSwing = true
            en.hitFlash = 0.12
            en.stunTimer = 0.25
            const kx = (en.x + en.w / 2) - scx
            const ky = (en.y + en.h / 2) - scy
            const kd = Math.sqrt(kx * kx + ky * ky) || 1
            en.vx = (kx / kd) * 280
            en.vy = (ky / kd) * 150 - 80
            sfxHit()
            // Crawler rushes at player when hit (with cooldown)
            if (en.type === 'crawler' && en.rushCooldown <= 0) {
              en.rushTimer = 1.2; en.rushCooldown = 3.0
            }
            const hx = Math.max(p.x, Math.min(p.x + p.w, en.x + en.w / 2))
            const hy = Math.max(p.y, Math.min(p.y + p.h, en.y + en.h / 2))
            spawnParticles(s.particles, hx, hy, 6, ac(1), 120, { shape: 'square' })
            spawnParticles(s.particles, hx, hy, 3, '#ffffff', 70, { lifeMult: 0.5 })
            if (en.health <= 0) {
              sfxDeath()
              spawnParticles(s.particles, en.x + en.w / 2, en.y + en.h / 2, 16, en.type === 'boss' ? '#ff4444' : '#ff8844', 180, { shape: 'square' })
              spawnParticles(s.particles, en.x + en.w / 2, en.y + en.h / 2, 12, en.type === 'boss' ? '#ff4444' : ac(1), 200)
              s.kills++
            }
          }
        }

        // ---- ENEMY AI ----
        for (const en of s.enemies) {
          if (en.health <= 0) continue
          if (en.hitFlash > 0) en.hitFlash -= dt
          en.animTimer += dt
          if (en.stunTimer > 0) { en.stunTimer -= dt; continue }

          if (en.type === 'crawler') {
            if (en.rushCooldown > 0) en.rushCooldown -= dt
            if (en.rushTimer > 0) {
              en.rushTimer -= dt
              const rdx = (p.x + p.w / 2) - (en.x + en.w / 2)
              const rdy = (p.y + p.h / 2) - (en.y + en.h / 2)
              const rd = Math.sqrt(rdx * rdx + rdy * rdy) || 1
              en.vx = (rdx / rd) * 220
              en.vy = (rdy / rd) * 140
            }
            if (!en.grounded) { en.vy += GRAVITY_FALL * dt; en.vx *= 0.998 }
            else if (!en.rushTimer) {
              en.vx = (en.vx > 0 ? 1 : -1) * CRAWLER_PATROL_SPEED
            }
            en.x += en.vx * dt; en.y += en.vy * dt
            en.grounded = false
            for (const plt of plats) {
              if (aabb(en, plt)) {
                const oT = (en.y + en.h) - plt.y; const oB = (plt.y + plt.h) - en.y
                const oL = (en.x + en.w) - plt.x; const oR = (plt.x + plt.w) - en.x
                if (en.vy >= 0 && oT <= oB && oT <= oL && oT <= oR) { en.y = plt.y - en.h; en.vy = 0; en.grounded = true }
                else if (en.vy < 0 && oB < oT) { en.y = plt.y + plt.h; en.vy = 0 }
                else if (oL <= oR) { en.x = plt.x - en.w; en.vx *= -1 }
                else { en.x = plt.x + plt.w; en.vx *= -1 }
              }
            }
            if (!en.rushTimer && en.grounded) {
              const stepX = en.vx > 0 ? en.x + en.w + 2 : en.x - 2
              let hasFloor = false
              const footY = en.y + en.h
              for (const plt of plats) {
                if (stepX >= plt.x && stepX <= plt.x + plt.w && Math.abs(footY - plt.y) < 20) { hasFloor = true; break }
              }
              if (!hasFloor) en.vx = -(en.vx > 0 ? 1 : -1) * CRAWLER_PATROL_SPEED
            }
            if (en.y > ch + 100) { en.y = 300; en.vy = 0; en.vx = (Math.random() > 0.5 ? 1 : -1) * CRAWLER_PATROL_SPEED }
            en.x = Math.max(0, Math.min(cw - en.w, en.x))
          } else if (en.type === 'floater') {
            en.timer += dt
            const dx = p.x - en.x; const dy = p.y - en.y
            const d = Math.sqrt(dx * dx + dy * dy) || 1
            en.vx = (dx / d) * 55
            en.vy = (dy / d) * 55 + Math.sin(en.timer * 2.5) * 25
            en.x += en.vx * dt; en.y += en.vy * dt
            en.x = Math.max(0, Math.min(cw - en.w, en.x))
            en.y = Math.max(20, Math.min(ch - 120, en.y))
            // Spit toxic particle at player
            en.spitTimer -= dt
            if (en.spitTimer <= 0) {
              en.spitTimer = 1.5 + Math.random() * 2
              const sdx = (p.x + p.w / 2) - (en.x + en.w / 2)
              const sdy = (p.y + p.h / 2) - (en.y + en.h / 2)
              const sd = Math.sqrt(sdx * sdx + sdy * sdy) || 1
              s.particles.push({ type: 'toxic', x: en.x + en.w / 2, y: en.y + en.h / 2,
                vx: (sdx / sd) * 180, vy: (sdy / sd) * 180, w: 6, h: 6, life: 2.5, owner: 'enemy' })
            }
          } else if (en.type === 'boss') {
            // ---- BOSS AI ----
            const bx = en.x + en.w / 2; const by = en.y + en.h / 2
            en.timer += dt
            en.spikePhase += dt * 2.6  // ~0.3 rad/s for spikes
            en.eyePhase += dt

            // Phase transitions
            const hpRatio = en.health / en.maxHealth
            const oldPhase = en.phase
            if (hpRatio > 0.6) en.phase = 0
            else if (hpRatio > 0.3) en.phase = 1
            else en.phase = 2
            if (en.phase !== oldPhase && en.transitionTimer <= 0) {
              en.transitionTimer = 0.5
              en.transitioningFrom = oldPhase
              s.flashAlpha = 0.35
              if (en.phase === 1) en.growScale = 1.2
              if (en.phase === 2) en.growScale = 1.25
              sfxBoss()
            }
            if (en.transitionTimer > 0) en.transitionTimer -= dt

            // Boss float movement — roams the entire screen randomly
            const driftX = Math.cos(en.timer * 0.7) + Math.sin(en.timer * 0.33) * 0.6 + Math.cos(en.timer * 0.17) * 0.8
            const driftY = Math.sin(en.timer * 1.1) + Math.cos(en.timer * 0.55) * 0.4 + Math.sin(en.timer * 0.23) * 0.9
            const speedX = 80 + en.phase * 25
            const speedY = 55 + en.phase * 20
            en.x += driftX * speedX * dt
            en.y += driftY * speedY * dt
            // Full-screen roaming with small margin
            en.x = Math.max(30, Math.min(cw - en.w - 30, en.x))
            en.y = Math.max(30, Math.min(ch - en.h - 50, en.y))

            // Death
            if (en.health <= 0) {
              if (!en.deathTimer) { en.deathTimer = 0; en.deathPhase = 0; sfxExplosion() }
              en.deathTimer += dt
              if (en.deathPhase === 0 && en.deathTimer > 0.1) { en.deathPhase = 1; sfxExplosion() }
              if (en.deathPhase === 1 && en.deathTimer > 0.2) { en.deathPhase = 2; sfxExplosion() }
              if (en.deathTimer > 0.6) { s.screenShake = 0; /* done */ }
              continue
            }

            // Attacks
            const spdMul = en.phase === 2 ? 0.5 : 1
            en.attackTimer -= dt

            // Attack A: Gravity Pulse (all phases)
            en.shockwaveTimer -= dt * spdMul
            if (en.shockwaveTimer <= 0 && en.shockwaveActive <= 0) {
              en.shockwaveActive = 0.45
              en.shockwaveTimer = en.phase >= 2 ? 1.5 : 3
            }
            if (en.shockwaveActive > 0) en.shockwaveActive -= dt

            // Attack B: Fragment Throw (phase 1+)
            if (en.phase >= 1) {
              en.fragThrowTimer -= dt * spdMul
              if (en.fragThrowTimer <= 0) {
                en.fragThrowTimer = en.phase >= 2 ? 1.5 : 3
                // Launch a fragment toward player
                const fdx = (p.x + p.w / 2) - bx
                const fdy = (p.y + p.h / 2) - by
                const fd = Math.sqrt(fdx * fdx + fdy * fdy) || 1
                s.particles.push({ type: 'bossFrag', x: bx, y: by,
                  vx: (fdx / fd) * 300, vy: (fdy / fd) * 300,
                  w: 16, h: 16, life: 2 })
              }
            }

            // Attack C: Void Beam (phase 2+)
            if (en.phase >= 2) {
              if (en.beamWarning > 0) {
                en.beamWarning -= dt
                if (en.beamWarning <= 0) { en.beamActive = 0.5; en.beamCharge = 0 }
              } else if (en.beamActive > 0) {
                en.beamActive -= dt
                // Beam hits player
                const beamY = en.y + en.h / 2
                if (Math.abs(p.y + p.h / 2 - beamY) < 18 && p.invTimer <= 0) {
                  p.health -= 8 + en.phase * 5; p.invTimer = INVINCIBLE_TIME
                  sfxHurt()
                  spawnParticles(s.particles, p.x + p.w / 2, p.y + p.h / 2, 10, '#ff4444', 120)
                }
                if (en.beamActive <= 0) en.beamTimer = en.phase >= 2 ? 3 : 5
              } else if (en.beamTimer <= 0) {
                en.beamTimer = 4 / spdMul
                en.beamWarning = 0.8
              } else {
                en.beamTimer -= dt
              }
            }

            // Attack D: Singularity Pull (phase 3)
            if (en.phase >= 2) {
              en.singularityTimer -= dt
              if (en.singularityTimer <= 0) {
                en.singularityActive = 1.5
                en.singularityTimer = 8
              }
            }
            if (en.singularityActive > 0) en.singularityActive -= dt

            // Shockwave hits player (blocked by platforms)
            if (en.shockwaveActive > 0) {
              const progress = 1 - en.shockwaveActive / 0.45
              const ringR = 30 + progress * 250
              const pdx = (p.x + p.w / 2) - bx
              const pdy = (p.y + p.h / 2) - by
              const pdist = Math.sqrt(pdx * pdx + pdy * pdy)
              // Check line-of-sight: any platform between boss and player?
              let blocked = false
              for (const plt of plats) {
                // Simple ray-AABB check against platforms (not ground, y<500)
                if (plt.y >= 500) continue
                const losx = Math.min(bx, bx + pdx); const losy = Math.min(by, by + pdy)
                const losw = Math.abs(pdx); const losh = Math.abs(pdy)
                if (aabb({ x: losx, y: losy, w: losw || 1, h: losh || 1 }, plt)) { blocked = true; break }
              }
              if (!blocked && Math.abs(pdist - ringR) < 30 && p.invTimer <= 0) {
                p.health -= 4 + en.phase * 3; p.invTimer = INVINCIBLE_TIME * 0.5
                p.vx += (pdx / pdist) * 80; p.vy += (pdy / pdist) * 60
                sfxHurt()
              }
            }

          }
        }

        // Toxic particles hit player (runs for all levels with floaters)
        for (let i = s.particles.length - 1; i >= 0; i--) {
          const pt = s.particles[i]
          if (pt.type === 'toxic' && aabb(p, pt) && p.invTimer <= 0) {
            p.health -= 3; p.invTimer = INVINCIBLE_TIME * 0.6
            sfxHurt(); s.particles.splice(i, 1)
            spawnParticles(s.particles, p.x + p.w / 2, p.y + p.h / 2, 5, '#a855f7', 80)
          }
        }

        // Particles update
        for (let i = s.particles.length - 1; i >= 0; i--) {
          const pt = s.particles[i]
          if (pt.type === 'bossFrag') {
            pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt
            if (pt.life <= 0 || pt.x < 0 || pt.x > cw || pt.y > ch) { s.particles.splice(i, 1); continue }
            // Hit player
            if (aabb(p, { x: pt.x - pt.w / 2, y: pt.y - pt.h / 2, w: pt.w, h: pt.h }) && p.invTimer <= 0) {
              p.health -= 5 + (boss?.phase || 0) * 3; p.invTimer = INVINCIBLE_TIME
              sfxHurt(); s.particles.splice(i, 1)
              spawnParticles(s.particles, p.x + p.w / 2, p.y + p.h / 2, 8, '#ff8844', 100)
            }
          } else if (pt.type === 'toxic') {
            pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt
            if (pt.life <= 0) s.particles.splice(i, 1)
          } else {
            pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vy += 200 * dt; pt.life -= dt
            if (pt.life <= 0) s.particles.splice(i, 1)
          }
        }

        // Contact damage (exclude boss — handled by attacks)
        if (p.dmgTimer <= 0) {
          for (const en of s.enemies) {
            if (en.health <= 0 || en.type === 'boss') continue
            if (aabb(p, en) && p.invTimer <= 0) {
              const dmg = en.type === 'floater' ? 4 : 5
              p.health -= dmg; p.invTimer = INVINCIBLE_TIME; p.dmgTimer = CONTACT_DMG_COOLDOWN
              sfxHurt()
              spawnParticles(s.particles, p.x + p.w / 2, p.y + p.h / 2, 8, '#ff4444', 100)
              const kx = p.x + p.w / 2 - en.x - en.w / 2
              p.vx = (kx > 0 ? 1 : -1) * 200; p.vy = -180
            }
          }
        }

        // Level clear
        const alive = s.enemies.filter(e => e.health > 0).length
        if (alive === 0 && !s.levelClear) {
          s.levelClear = true; s.clearTimer = 2.0; sfxClear()
        }
        if (p.health <= 0) { p.health = 0; s.gameOver = true; currentBgm.pause() }
      }

      if (s.levelClear) {
        s.clearTimer -= dt
        if (s.clearTimer <= 0) {
          if (s.levelIdx < LEVELS.length - 1) { s.levelIdx++; spawnLevel(s.levelIdx) }
          else { s.gameOver = true; currentBgm.pause() }
        }
      }

      // ==================== RENDER ====================
      const shakeX = s.screenShake > 0 ? (Math.random() - 0.5) * s.screenShake * 20 : 0
      const shakeY = s.screenShake > 0 ? (Math.random() - 0.5) * s.screenShake * 20 : 0
      ctx2d.save()
      ctx2d.translate(shakeX, shakeY)

      ctx2d.clearRect(-10, -10, cw + 20, ch + 20)
      ctx2d.fillStyle = '#05070f'; ctx2d.fillRect(-10, -10, cw + 20, ch + 20)

      // Stars
      for (const st of s.stars) {
        ctx2d.globalAlpha = st.o * (0.6 + 0.4 * Math.sin(s.time * 0.8 * st.s + st.x))
        ctx2d.fillStyle = '#c8d8f0'; ctx2d.beginPath()
        ctx2d.arc(st.x, st.y, st.r, 0, Math.PI * 2); ctx2d.fill()
      }
      ctx2d.globalAlpha = 1

      // Nebula
      const ng = ctx2d.createRadialGradient(cw / 2, ch / 2, 50, cw / 2, ch / 2, 500)
      ng.addColorStop(0, ac(0.05)); ng.addColorStop(1, 'transparent')
      ctx2d.fillStyle = ng; ctx2d.fillRect(-10, -10, cw + 20, ch + 20)

      // Platforms
      for (const plt of plats) {
        const pg = ctx2d.createLinearGradient(plt.x, plt.y, plt.x, plt.y + plt.h)
        pg.addColorStop(0, ac(0.25)); pg.addColorStop(1, ac(0.08))
        ctx2d.fillStyle = pg; ctx2d.fillRect(plt.x, plt.y, plt.w, plt.h)
        ctx2d.strokeStyle = ac(0.35); ctx2d.lineWidth = 1; ctx2d.strokeRect(plt.x, plt.y, plt.w, plt.h)
      }

      // Particles
      for (const pt of s.particles) {
        if (pt.type === 'toxic') {
          ctx2d.fillStyle = '#a855f7'; ctx2d.shadowColor = '#a855f7'; ctx2d.shadowBlur = 5
          ctx2d.beginPath(); ctx2d.arc(pt.x, pt.y, pt.w / 2, 0, Math.PI * 2); ctx2d.fill()
          ctx2d.shadowBlur = 0
        } else if (pt.type === 'bossFrag') {
          ctx2d.fillStyle = '#444'; ctx2d.fillRect(pt.x - pt.w / 2, pt.y - pt.h / 2, pt.w, pt.h)
          ctx2d.strokeStyle = '#ff4444'; ctx2d.lineWidth = 2
          ctx2d.strokeRect(pt.x - pt.w / 2, pt.y - pt.h / 2, pt.w, pt.h)
          ctx2d.lineWidth = 1
        } else if (pt.type === 'bossShot') {
          ctx2d.fillStyle = '#ff4444'; ctx2d.shadowColor = '#ff0000'; ctx2d.shadowBlur = 8
          ctx2d.beginPath(); ctx2d.arc(pt.x, pt.y, pt.w / 2, 0, Math.PI * 2); ctx2d.fill()
          ctx2d.shadowBlur = 0
        } else {
          ctx2d.globalAlpha = Math.max(0, pt.life / pt.maxLife)
          ctx2d.fillStyle = pt.color
          if (pt.shape === 'square') {
            ctx2d.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size)
          } else {
            ctx2d.beginPath(); ctx2d.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx2d.fill()
          }
        }
      }
      ctx2d.globalAlpha = 1

      // ========== ENEMIES ==========
      for (const en of s.enemies) {
        if (en.health <= 0 && en.type !== 'boss') continue
        const ex = en.x, ey = en.y, ew = en.w, eh = en.h
        const flashOn = en.hitFlash > 0 && (Math.floor(en.hitFlash * 30) % 2 === 0)

        if (en.type === 'boss') {
          // ===== VOID SOVEREIGN =====
          if (en.health <= 0) {
            // Death animation
            const dt2 = en.deathTimer
            if (en.deathPhase >= 0 && dt2 < 0.5) {
              const r1 = dt2 * 400; const alpha1 = 1 - dt2 / 0.5
              ctx2d.strokeStyle = `rgba(255,68,68,${alpha1})`; ctx2d.lineWidth = 4
              ctx2d.beginPath(); ctx2d.arc(en.x + ew / 2, en.y + eh / 2, r1, 0, Math.PI * 2); ctx2d.stroke()
              ctx2d.lineWidth = 1
            }
            if (en.deathPhase >= 1 && dt2 < 0.8) {
              const r2 = (dt2 - 0.1) * 350; const alpha2 = 1 - (dt2 - 0.1) / 0.7
              ctx2d.strokeStyle = `rgba(255,136,68,${alpha2})`; ctx2d.lineWidth = 3
              ctx2d.beginPath(); ctx2d.arc(en.x + ew / 2, en.y + eh / 2, r2, 0, Math.PI * 2); ctx2d.stroke()
              ctx2d.lineWidth = 1
            }
            if (en.deathPhase >= 2 && dt2 < 1.1) {
              const r3 = (dt2 - 0.2) * 300; const alpha3 = 1 - (dt2 - 0.2) / 0.9
              ctx2d.strokeStyle = `rgba(255,200,100,${alpha3})`; ctx2d.lineWidth = 2
              ctx2d.beginPath(); ctx2d.arc(en.x + ew / 2, en.y + eh / 2, r3, 0, Math.PI * 2); ctx2d.stroke()
              ctx2d.lineWidth = 1
              // Scatter particles
              if (dt2 > 0.3 && dt2 < 0.5) {
                s.screenShake = 0.4
                for (let s2 = 0; s2 < 8; s2++) {
                  const sa = Math.random() * Math.PI * 2
                  s.particles.push({ x: en.x + ew / 2, y: en.y + eh / 2,
                    vx: Math.cos(sa) * 200, vy: Math.sin(sa) * 200 - 100,
                    life: 0.8, maxLife: 0.8, size: 3 + Math.random() * 4, color: '#ff8844', shape: 'square' })
                }
              }
            }
            continue
          }

          const scale = en.growScale * (1 + Math.sin(en.transitionTimer > 0 ? en.transitionTimer * 10 : 0) * 0.05 * (en.transitionTimer > 0 ? 1 : 0))
          const bx2 = en.x + ew / 2; const by2 = en.y + eh / 2

          // ---- Orbiting fragments with trails ----
          for (const orb of en.orbData) {
            orb.a += orb.spd * dt
            const ox = bx2 + Math.cos(orb.a) * orb.rx
            const oy = by2 + Math.sin(orb.a) * orb.ry * 0.7
            // Trail
            orb.trail.push({ x: ox, y: oy })
            if (orb.trail.length > 4) orb.trail.shift()
            for (let t = 0; t < orb.trail.length; t++) {
              const tr = orb.trail[t]
              ctx2d.globalAlpha = (t / orb.trail.length) * 0.5
              ctx2d.strokeStyle = '#ff4444'; ctx2d.lineWidth = 1.5
              ctx2d.strokeRect(tr.x - orb.size / 2, tr.y - orb.size / 2, orb.size, orb.size)
            }
            ctx2d.globalAlpha = 1
            // Fragment body
            ctx2d.fillStyle = '#2a2a2a'
            ctx2d.fillRect(ox - orb.size / 2, oy - orb.size / 2, orb.size, orb.size)
            ctx2d.strokeStyle = '#ff4444'; ctx2d.lineWidth = 2
            ctx2d.strokeRect(ox - orb.size / 2, oy - orb.size / 2, orb.size, orb.size)
            ctx2d.lineWidth = 1
          }

          // ---- Corona spikes ----
          const spikePulse = 1 + Math.sin(en.spikePhase) * 0.12
          const spikeColors = ['#cc3300', '#ff6600', '#cc3300', '#ff6600', '#cc3300', '#ff6600', '#cc3300', '#ff6600']
          if (en.phase >= 2) spikeColors.fill('#ffffff', 0, 8)
          else if (en.phase >= 1) spikeColors.fill('#ff8822', 0, 8)
          const spikeVerts = bossSpikeVerts(bx2, by2, 8, 40 * scale, 58 * scale * spikePulse, en.spikePhase * 0.5)
          for (let vi = 0; vi < spikeVerts.length; vi += 2) {
            const ci = Math.floor(vi / 2)
            ctx2d.fillStyle = spikeColors[ci]
            ctx2d.beginPath()
            ctx2d.moveTo(bx2, by2)
            ctx2d.lineTo(spikeVerts[vi].x, spikeVerts[vi].y)
            ctx2d.lineTo(spikeVerts[vi + 1].x, spikeVerts[vi + 1].y)
            ctx2d.closePath(); ctx2d.fill()
          }

          // ---- Middle rotating arcs ----
          for (let a = 0; a < 6; a++) {
            const arcA = (a / 6) * Math.PI * 2 + en.spikePhase * 0.3
            ctx2d.strokeStyle = a % 2 === 0 ? '#8B0000' : '#3B0060'
            ctx2d.lineWidth = 2.5 * scale
            ctx2d.beginPath()
            ctx2d.arc(bx2, by2, 33 * scale, arcA, arcA + 0.5)
            ctx2d.stroke()
          }
          ctx2d.lineWidth = 1

          // ---- Inner void sphere ----
          const innerGrad = ctx2d.createRadialGradient(bx2, by2, 5, bx2, by2, 38 * scale)
          innerGrad.addColorStop(0, 'rgba(10,0,16,1)')
          innerGrad.addColorStop(0.7, 'rgba(20,0,30,0.9)')
          innerGrad.addColorStop(1, 'rgba(40,0,60,0.4)')
          ctx2d.fillStyle = innerGrad
          ctx2d.beginPath(); ctx2d.arc(bx2, by2, 38 * scale, 0, Math.PI * 2); ctx2d.fill()
          // Shimmer
          ctx2d.fillStyle = `rgba(80,20,120,${0.1 + Math.sin(en.eyePhase * 3) * 0.05})`
          ctx2d.beginPath(); ctx2d.arc(bx2, by2, 30 * scale, 0, Math.PI * 2); ctx2d.fill()

          // ---- Eyes ----
          const eyePulse1 = 1 + Math.sin(en.eyePhase * 4) * 0.3
          const eyePulse2 = 1 + Math.cos(en.eyePhase * 4.5) * 0.25
          // Left eye (large)
          ctx2d.fillStyle = `rgba(255,34,0,${0.6 + eyePulse1 * 0.4})`
          ctx2d.shadowColor = '#ff2200'; ctx2d.shadowBlur = 8 * eyePulse1
          ctx2d.beginPath(); ctx2d.arc(bx2 - 10, by2 - 8, 8 * eyePulse1, 0, Math.PI * 2); ctx2d.fill()
          // Right eye (small)
          ctx2d.fillStyle = `rgba(255,102,0,${0.5 + eyePulse2 * 0.4})`
          ctx2d.shadowColor = '#ff6600'; ctx2d.shadowBlur = 5 * eyePulse2
          ctx2d.beginPath(); ctx2d.arc(bx2 + 8, by2 - 2, 5 * eyePulse2, 0, Math.PI * 2); ctx2d.fill()
          // Phase 2+: third eye
          if (en.phase >= 1) {
            const eye3Scale = en.phase >= 1 ? Math.min(1, (en.transitionTimer > 0 ? 1 - en.transitionTimer / 0.5 : 1)) : 0
            const eye3H = 1.5 + eye3Scale * 3.5
            ctx2d.fillStyle = `rgba(255,200,100,${0.5 + Math.sin(en.eyePhase * 5) * 0.3})`
            ctx2d.shadowColor = '#ffaa44'; ctx2d.shadowBlur = 6 * eye3Scale
            ctx2d.beginPath(); ctx2d.ellipse(bx2 - 1, by2 + 4, 4 * eye3Scale, eye3H, 0, 0, Math.PI * 2); ctx2d.fill()
          }
          ctx2d.shadowBlur = 0

          // ---- Gravity pulse ring ----
          if (en.shockwaveActive > 0) {
            const prog = 1 - en.shockwaveActive / 0.45
            const rr = 30 + prog * 300
            ctx2d.strokeStyle = `rgba(200,30,30,${1 - prog})`; ctx2d.lineWidth = 4 - prog * 3
            ctx2d.beginPath(); ctx2d.arc(bx2, by2, rr, 0, Math.PI * 2); ctx2d.stroke()
            ctx2d.lineWidth = 1
          }

          // ---- Void beam warning line ----
          if (en.beamWarning > 0) {
            const walph = 0.3 + Math.sin(en.beamWarning * 20) * 0.2
            ctx2d.strokeStyle = `rgba(255,50,50,${walph})`; ctx2d.lineWidth = 2
            ctx2d.setLineDash([8, 4])
            ctx2d.beginPath(); ctx2d.moveTo(0, by2); ctx2d.lineTo(cw, by2); ctx2d.stroke()
            ctx2d.setLineDash([]); ctx2d.lineWidth = 1
            // Charge dot
            const chargeR = 4 + (0.8 - en.beamWarning) / 0.8 * 10
            ctx2d.fillStyle = '#ffffff'; ctx2d.shadowColor = '#ffffff'; ctx2d.shadowBlur = 12
            ctx2d.beginPath(); ctx2d.arc(bx2, by2, chargeR, 0, Math.PI * 2); ctx2d.fill()
            ctx2d.shadowBlur = 0
          }

          // ---- Void beam ----
          if (en.beamActive > 0) {
            const balph = en.beamActive > 0.4 ? 1 : en.beamActive / 0.4
            ctx2d.fillStyle = `rgba(255,30,30,${0.3 * balph})`
            ctx2d.fillRect(0, by2 - 12, cw, 24)
            ctx2d.fillStyle = `rgba(255,255,255,${0.6 * balph})`
            ctx2d.fillRect(0, by2 - 2, cw, 5)
            ctx2d.shadowColor = '#ff0000'; ctx2d.shadowBlur = 20
            ctx2d.fillStyle = `rgba(255,50,50,${balph})`
            ctx2d.fillRect(0, by2 - 4, cw, 8)
            ctx2d.shadowBlur = 0
          }

          // ---- Singularity pull visual ----
          if (en.singularityActive > 0) {
            for (let ri = 0; ri < 3; ri++) {
              const rp = ((en.singularityActive + ri * 0.3) % 1.5) / 1.5
              const rr2 = 200 - rp * 180
              ctx2d.strokeStyle = `rgba(40,0,60,${0.5 - rp * 0.5})`; ctx2d.lineWidth = 3 - rp * 2
              ctx2d.beginPath(); ctx2d.arc(bx2, by2, rr2, 0, Math.PI * 2); ctx2d.stroke()
            }
            ctx2d.lineWidth = 1
          }

          // ---- Boss health bar (top center) ----
          const bhbW = 300; const bhbX = (cw - bhbW) / 2; const bhbY = 12; const bhbH = 10
          ctx2d.fillStyle = '#221122'; ctx2d.fillRect(bhbX, bhbY, bhbW, bhbH)
          ctx2d.strokeStyle = '#443355'; ctx2d.lineWidth = 1; ctx2d.strokeRect(bhbX, bhbY, bhbW, bhbH)
          const bhGrad = ctx2d.createLinearGradient(bhbX, bhbY, bhbX + bhbW, bhbY)
          bhGrad.addColorStop(0, '#8B0000'); bhGrad.addColorStop(0.5, '#ff6600'); bhGrad.addColorStop(1, '#ffcc00')
          ctx2d.fillStyle = bhGrad
          ctx2d.fillRect(bhbX + 1, bhbY + 1, (bhbW - 2) * (en.health / en.maxHealth), bhbH - 2)
          // Label
          ctx2d.fillStyle = '#ffccaa'; ctx2d.font = 'bold 11px monospace'
          ctx2d.textAlign = 'center'
          ctx2d.fillText('V O I D   S O V E R E I G N', cw / 2, bhbY - 4)
          if (en.phase >= 2) {
            ctx2d.fillStyle = '#ff4444'; ctx2d.font = 'bold 10px monospace'
            ctx2d.fillText('ENRAGED', cw / 2, bhbY - 16)
          }
          ctx2d.textAlign = 'left'

        } else if (en.type === 'floater') {
          // Floater drawing (unchanged)
          const boby = ey + eh / 2 + Math.sin(en.timer * 2.5) * 4
          const bobx = ex + ew / 2
          ctx2d.strokeStyle = flashOn ? '#ffffff' : '#a855f7'; ctx2d.lineWidth = 2
          for (let t = 0; t < 3; t++) {
            const tx = bobx + (t - 1) * 7
            ctx2d.beginPath()
            ctx2d.moveTo(tx, boby + 4)
            ctx2d.quadraticCurveTo(tx + Math.sin(en.timer * 4 + t) * 6, boby + 14, tx + Math.cos(en.timer * 3 + t) * 4, boby + 22)
            ctx2d.stroke()
          }
          ctx2d.lineWidth = 1
          ctx2d.fillStyle = flashOn ? 'rgba(255,255,255,0.5)' : 'rgba(168,85,247,0.45)'
          ctx2d.beginPath(); ctx2d.ellipse(bobx, boby, ew / 2, eh / 3, 0, Math.PI, 0); ctx2d.fill()
          ctx2d.fillStyle = flashOn ? 'rgba(255,255,255,0.7)' : 'rgba(168,85,247,0.7)'
          ctx2d.beginPath(); ctx2d.arc(bobx, boby, ew / 3, 0, Math.PI * 2); ctx2d.fill()
          ctx2d.fillStyle = '#ffffff'
          ctx2d.beginPath(); ctx2d.arc(bobx, boby - 2, 3, 0, Math.PI * 2); ctx2d.fill()
          ctx2d.fillStyle = '#333'; ctx2d.fillRect(ex, ey - 8, ew, 3)
          ctx2d.fillStyle = '#a855f7'; ctx2d.fillRect(ex, ey - 8, ew * (en.health / en.maxHealth), 3)
        } else {
          // Crawler drawing (unchanged)
          const cx2 = ex + ew / 2; const cy2 = ey + eh / 2
          const legPhase = Math.floor(en.animTimer * 6) % 2
          ctx2d.strokeStyle = flashOn ? '#ffffff' : '#cc5533'; ctx2d.lineWidth = 2.5
          for (let l = 0; l < 4; l++) {
            const lx = cx2 + (l < 2 ? -8 : 8)
            const alt = (l % 2 === legPhase) ? -3 : 3
            ctx2d.beginPath(); ctx2d.moveTo(lx, cy2 + 2); ctx2d.lineTo(lx + (l < 2 ? -4 : 4), cy2 + 12 + alt); ctx2d.stroke()
          }
          ctx2d.lineWidth = 1
          ctx2d.fillStyle = flashOn ? '#ffffff' : '#e05a30'
          ctx2d.beginPath(); ctx2d.ellipse(cx2, cy2 - 1, ew / 2 - 1, eh / 3, 0, 0, Math.PI * 2); ctx2d.fill()
          ctx2d.fillStyle = '#ff0000'; ctx2d.shadowColor = '#ff0000'; ctx2d.shadowBlur = 4
          ctx2d.beginPath(); ctx2d.arc(cx2, cy2 - 4, 5, 0, Math.PI * 2); ctx2d.fill()
          ctx2d.shadowBlur = 0
          ctx2d.strokeStyle = flashOn ? '#ffffff' : '#cc8866'; ctx2d.lineWidth = 1.5
          ctx2d.beginPath(); ctx2d.moveTo(cx2 - 3, cy2 - ew / 2 + 1)
          ctx2d.quadraticCurveTo(cx2 - 6, cy2 - 16, cx2 - 8, cy2 - 22); ctx2d.stroke()
          ctx2d.beginPath(); ctx2d.arc(cx2 - 8, cy2 - 22, 2.5, 0, Math.PI * 2)
          ctx2d.fillStyle = flashOn ? '#ffffff' : '#ff9944'; ctx2d.fill()
          ctx2d.lineWidth = 1
          ctx2d.fillStyle = '#333'; ctx2d.fillRect(ex, ey - 8, ew, 3)
          ctx2d.fillStyle = '#ff6b4a'; ctx2d.fillRect(ex, ey - 8, ew * (en.health / en.maxHealth), 3)
        }
      }

      // ========== PLAYER (Space Warrior) ==========
      const px = p.x, py = p.y, pw = p.w, ph = p.h
      const f = p.facing > 0 ? 1 : -1
      const showPlayer = p.invTimer <= 0 || Math.floor(p.invTimer * 20) % 2 === 0
      if (showPlayer) {
        const breathe = Math.sin(s.time * 4.2) * 1.5
        const bob = p.grounded ? breathe : 0
        const cx = px + pw / 2, baseY = py + ph / 2 + bob
        const isMoving = Math.abs(p.vx) > 20
        const isAir = !p.grounded
        const slashActive = p.slashPhase >= 0
        let walkFrame = 0
        if (isMoving && !isAir) walkFrame = Math.floor(p.animTimer * 10) % 4

        let jumpTuck = 0
        if (isAir) {
          if (p.vy < -100) jumpTuck = -3
          else if (p.vy > 100) jumpTuck = 3
        }

        // Legs
        const legSwing = isMoving ? [0, 1, 2, 3].map(i => Math.sin((walkFrame + i * 0.5) * Math.PI / 2) * 8) : [0, 0, 0, 0]
        const lLeg = legSwing[0] + jumpTuck
        ctx2d.fillStyle = ac(0.7)
        ctx2d.fillRect(cx - 6, baseY + 8 + lLeg * 0.3, 3.5, 10 - Math.abs(lLeg) * 0.4)
        ctx2d.fillRect(cx - 7, baseY + 16 + lLeg * 0.5, 5, 3)
        const rLeg = legSwing[2] + jumpTuck
        ctx2d.fillRect(cx + 2.5, baseY + 8 + rLeg * 0.3, 3.5, 10 - Math.abs(rLeg) * 0.4)
        ctx2d.fillRect(cx + 2, baseY + 16 + rLeg * 0.5, 5, 3)

        // Torso
        ctx2d.fillStyle = ac(0.85)
        ctx2d.fillRect(cx - 7, baseY - 8, 14, 16)
        ctx2d.fillStyle = ac(0.4)
        ctx2d.fillRect(cx - 3, baseY - 2, 6, 3)
        ctx2d.fillRect(cx - 4, baseY + 2, 8, 2)

        // Shoulders
        const shLx = cx - 8, shRx = cx + 8, shY = baseY - 7
        ctx2d.fillStyle = ac(1)
        ctx2d.beginPath(); ctx2d.arc(shLx, shY, 4, 0, Math.PI * 2); ctx2d.fill()
        ctx2d.beginPath(); ctx2d.arc(shRx, shY, 4, 0, Math.PI * 2); ctx2d.fill()

        // Left arm
        const armSwing = isMoving ? Math.sin(walkFrame * Math.PI / 2) * 6 : 0
        ctx2d.strokeStyle = ac(0.75); ctx2d.lineWidth = 2.5
        ctx2d.beginPath(); ctx2d.moveTo(shLx, shY); ctx2d.lineTo(shLx - 3 - armSwing, shY + 10); ctx2d.stroke()
        ctx2d.lineWidth = 1

        // ---- Sword arm & blade ----
        const scx = cx, scy = baseY
        const baseDir = f > 0 ? 0 : Math.PI
        let sweepOff = 0.08
        if (slashActive) {
          if (p.slashPhase === 0) sweepOff = -0.15 + (p.slashTimer / 0.06) * (-SWORD_ARC / 2)
          else if (p.slashPhase === 1) { const swT = (p.slashTimer - 0.06) / 0.12; sweepOff = -SWORD_ARC / 2 + swT * SWORD_ARC }
          else sweepOff = (SWORD_ARC / 2) * (1 - (p.slashTimer - 0.18) / 0.06)
        }
        const bladeAngle = baseDir + sweepOff * f

        // Sweep arc during swing
        if (slashActive && p.slashPhase === 1) {
          const swT = (p.slashTimer - 0.06) / 0.12
          const curSweep = SWORD_ARC * Math.min(1, swT)
          const startA = baseDir - curSweep / 2; const endA = baseDir + curSweep / 2
          ctx2d.fillStyle = ac(0.08 + swT * 0.1)
          ctx2d.beginPath(); ctx2d.moveTo(scx, scy); ctx2d.arc(scx, scy, SWORD_REACH, startA, endA); ctx2d.closePath(); ctx2d.fill()
          ctx2d.strokeStyle = ac(0.3 + swT * 0.7); ctx2d.shadowColor = ac(1); ctx2d.shadowBlur = 14; ctx2d.lineWidth = 3
          ctx2d.beginPath(); ctx2d.arc(scx, scy, SWORD_REACH, startA, endA); ctx2d.stroke()
          ctx2d.shadowBlur = 0
          for (let tr = 1; tr <= 4; tr++) {
            const trailT = Math.max(0, swT - tr * 0.15)
            if (trailT <= 0) continue
            ctx2d.globalAlpha = 0.25 * (1 - tr / 5)
            ctx2d.strokeStyle = ac(1); ctx2d.shadowColor = ac(1); ctx2d.shadowBlur = 8; ctx2d.lineWidth = 2
            ctx2d.beginPath(); ctx2d.arc(scx, scy, SWORD_REACH, baseDir - SWORD_ARC * trailT / 2, baseDir + SWORD_ARC * trailT / 2); ctx2d.stroke()
          }
          ctx2d.globalAlpha = 1; ctx2d.shadowBlur = 0; ctx2d.lineWidth = 1
        }

        // Blade position
        const bladeTipX = scx + Math.cos(bladeAngle) * SWORD_REACH
        const bladeTipY = scy + Math.sin(bladeAngle) * SWORD_REACH
        const bladeMidX = scx + Math.cos(bladeAngle) * (SWORD_REACH * 0.3)
        const bladeMidY = scy + Math.sin(bladeAngle) * (SWORD_REACH * 0.3)

        // Arm
        ctx2d.strokeStyle = ac(0.8); ctx2d.lineWidth = 2.5
        ctx2d.beginPath(); ctx2d.moveTo(shRx, shY); ctx2d.lineTo(bladeMidX, bladeMidY); ctx2d.stroke()
        ctx2d.lineWidth = 1

        // Blade
        ctx2d.strokeStyle = ac(1); ctx2d.shadowColor = ac(1); ctx2d.shadowBlur = 8; ctx2d.lineWidth = 3.5
        ctx2d.beginPath(); ctx2d.moveTo(bladeMidX, bladeMidY); ctx2d.lineTo(bladeTipX, bladeTipY); ctx2d.stroke()
        ctx2d.strokeStyle = '#ffffff'; ctx2d.shadowColor = '#ffffff'; ctx2d.shadowBlur = 4; ctx2d.lineWidth = 1.2
        ctx2d.beginPath(); ctx2d.moveTo(bladeMidX, bladeMidY); ctx2d.lineTo(bladeTipX, bladeTipY); ctx2d.stroke()
        ctx2d.fillStyle = '#ffffff'; ctx2d.shadowColor = '#ffffff'; ctx2d.shadowBlur = 6
        ctx2d.beginPath(); ctx2d.arc(bladeTipX, bladeTipY, 2.5, 0, Math.PI * 2); ctx2d.fill()
        ctx2d.shadowBlur = 0; ctx2d.lineWidth = 1
        ctx2d.fillStyle = '#8899aa'; ctx2d.fillRect(bladeMidX - 2, bladeMidY - 2, 4, 4)

        // Helmet
        ctx2d.fillStyle = ac(0.9); ctx2d.shadowColor = ac(1); ctx2d.shadowBlur = 6
        ctx2d.beginPath(); ctx2d.arc(cx, baseY - 16, 7.5, 0, Math.PI * 2); ctx2d.fill()
        ctx2d.shadowBlur = 0
        ctx2d.fillStyle = '#ffffff'
        ctx2d.beginPath(); ctx2d.ellipse(cx + f * 3, baseY - 17, 3, 2, 0, 0, Math.PI * 2); ctx2d.fill()
        ctx2d.fillStyle = ac(0.4)
        ctx2d.beginPath(); ctx2d.ellipse(cx + f * 3, baseY - 17, 4, 2.5, 0, 0, Math.PI * 2); ctx2d.fill()
      }

      ctx2d.restore()
      // Flash overlay (phase transitions)
      if (s.flashAlpha > 0) {
        ctx2d.fillStyle = `rgba(180,20,20,${s.flashAlpha})`
        ctx2d.fillRect(0, 0, cw, ch)
      }

      // ========== HUD ==========
      const hbX = 20, hbY = 20, hbW = 200, hbH = 16
      ctx2d.fillStyle = 'rgba(0,0,0,0.5)'; ctx2d.fillRect(hbX, hbY, hbW, hbH)
      const hg = ctx2d.createLinearGradient(hbX, hbY, hbX + hbW, hbY)
      hg.addColorStop(0, '#ff4444'); hg.addColorStop(0.5, '#ff8844'); hg.addColorStop(1, ac(1))
      ctx2d.fillStyle = hg; ctx2d.fillRect(hbX, hbY, hbW * (p.health / p.maxHealth), hbH)
      ctx2d.strokeStyle = ac(0.5); ctx2d.lineWidth = 1; ctx2d.strokeRect(hbX, hbY, hbW, hbH)
      ctx2d.fillStyle = '#fff'; ctx2d.font = '10px monospace'
      ctx2d.fillText(`${Math.ceil(p.health)} / ${p.maxHealth}`, hbX + 6, hbY + 12)
      ctx2d.fillStyle = ac(1); ctx2d.font = 'bold 13px monospace'
      ctx2d.fillText(`Level ${s.levelIdx + 1}: ${lv.name}`, hbX, hbY + 38)
      ctx2d.fillStyle = '#fff'; ctx2d.font = '12px monospace'
      ctx2d.fillText(`Kills: ${s.kills}`, cw - 130, 30)
      const cdReady = p.swordTimer <= 0
      ctx2d.fillStyle = cdReady ? ac(1) : '#444'; ctx2d.font = '11px monospace'
      ctx2d.fillText(cdReady ? '[ SPACE ] SLASH' : `[ SPACE ] ${p.swordTimer.toFixed(1)}s`, cw - 170, ch - 20)

      if (s.levelClear) {
        ctx2d.fillStyle = ac(1); ctx2d.font = 'bold 28px monospace'
        ctx2d.shadowColor = ac(1); ctx2d.shadowBlur = 16
        ctx2d.fillText(s.levelIdx >= LEVELS.length - 1 ? 'ALL CLEAR!' : 'LEVEL CLEAR!', cw / 2 - 100, ch / 2)
        ctx2d.shadowBlur = 0
      }
      if (s.paused && !s.gameOver && !s.levelClear) {
        ctx2d.fillStyle = 'rgba(0,0,0,0.55)'; ctx2d.fillRect(0, 0, cw, ch)
        ctx2d.fillStyle = ac(1); ctx2d.font = 'bold 32px monospace'
        ctx2d.shadowColor = ac(1); ctx2d.shadowBlur = 14
        ctx2d.fillText('PAUSED', cw / 2 - 70, ch / 2 - 10)
        ctx2d.shadowBlur = 0
        ctx2d.fillStyle = '#aaa'; ctx2d.font = '14px monospace'
        ctx2d.fillText('Press ESC to resume', cw / 2 - 100, ch / 2 + 30)
      }
      if (s.gameOver) {
        const won = p.health > 0
        ctx2d.fillStyle = 'rgba(0,0,0,0.65)'; ctx2d.fillRect(0, 0, cw, ch)
        ctx2d.fillStyle = won ? ac(1) : '#ff4444'; ctx2d.font = 'bold 36px monospace'
        ctx2d.shadowColor = won ? ac(1) : '#ff4444'; ctx2d.shadowBlur = 20
        ctx2d.fillText(won ? 'VOID CONQUERED' : 'VOID LOST', cw / 2 - 180, ch / 2 - 30)
        ctx2d.shadowBlur = 0
        ctx2d.fillStyle = '#ccc'; ctx2d.font = '16px monospace'
        ctx2d.fillText(`Kills: ${s.kills}  |  Level: ${s.levelIdx + 1}`, cw / 2 - 140, ch / 2 + 20)
        ctx2d.fillText('Press R to restart  |  Click X to exit', cw / 2 - 170, ch / 2 + 50)
      }

      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('keydown', onKD, { capture: true })
      window.removeEventListener('keyup', onKU, { capture: true })
      bgmTracks.forEach(a => { a.pause(); a.src = '' })
    }
    } catch (err) {
      const canvas = canvasRef.current
      if (canvas) {
        const c = canvas.getContext('2d')
        canvas.width = 900; canvas.height = 200
        c.fillStyle = '#110000'; c.fillRect(0, 0, 900, 200)
        c.fillStyle = '#ff4444'; c.font = '14px monospace'
        c.fillText('GAME ERROR: ' + (err.message || String(err)), 20, 50)
        c.fillStyle = '#ff8888'; c.font = '11px monospace'
        c.fillText(err.stack || '', 20, 80)
      }
      throw err
    }
  }, [])

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#05070f', overflow: 'hidden', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 28, background: '#0a0f1a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 10px', WebkitAppRegion: 'drag', userSelect: 'none', flexShrink: 0 }}>
        <span style={{ color: '#8899bb', fontSize: 12, fontFamily: 'monospace', letterSpacing: 2 }}>VOID DASHER</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={togglePin} title={pinned ? 'Unpin from top' : 'Pin to top'} style={{ background: 'transparent', border: '1px solid transparent', borderRadius: 3, color: pinned ? '#44cc44' : '#ff4444', fontSize: 13, cursor: 'pointer', padding: '1px 6px', lineHeight: 1.4, WebkitAppRegion: 'no-drag' }}>{pinned ? '\u{1F4CC} ON' : '\u{1F4CC} OFF'}</button>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#667788', fontSize: 16, cursor: 'pointer', padding: '2px 6px', lineHeight: 1, WebkitAppRegion: 'no-drag' }} onMouseEnter={e => e.target.style.color = '#ff4444'} onMouseLeave={e => e.target.style.color = '#667788'}>✕</button>
        </div>
      </div>
      <canvas ref={canvasRef} style={{ display: 'block', width: GAME_W, height: GAME_H, flexShrink: 0 }} />
    </div>
  )
}
