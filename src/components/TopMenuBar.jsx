import { useState, useRef, useEffect } from 'react'

const TIER_NAMES = ['Deep Space', 'Particle Stream', 'Interstellar']

function fileName(url) {
  if (!url) return '—'
  try { return decodeURIComponent(url.split('/').pop()) } catch (_) { return url }
}

export default function TopMenuBar({
  musicOn, onToggleMusic,
  currentTier = 0,
  audioMap = {},
  masterVolume = 0.75,
  mode = 'dynamic',
  onChangeTrack,
  onVolumeChange,
  onModeChange,
  onStaticSelect
}) {
  const [open, setOpen] = useState(false)
  const panelRef = useRef(null)
  const fileRefs = useRef([null, null, null])

  useEffect(() => {
    if (!open) return
    function handler(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function handleFile(tier, e) {
    const file = e.target.files?.[0]
    if (file) onChangeTrack?.(tier, file)
    e.target.value = ''
  }

  const isStatic = mode === 'static'

  return (
    <div style={{ display: 'flex', alignItems: 'center', height: 32, paddingRight: 10, justifyContent: 'flex-end', WebkitAppRegion: 'drag', background: 'rgba(8,8,24,0.25)', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0, position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 6,
          border: `1px solid ${open ? 'rgba(124,111,247,0.35)' : 'rgba(255,255,255,0.08)'}`,
          background: open ? 'rgba(124,111,247,0.15)' : musicOn ? 'rgba(124,111,247,0.08)' : 'transparent',
          color: open ? '#c4b5fd' : musicOn ? '#c4b5fd' : 'rgba(107,107,138,0.45)',
          fontFamily: "'JetBrains Mono','Cascadia Code','Consolas',monospace",
          fontSize: 11, cursor: 'pointer', transition: 'all 0.2s ease', WebkitAppRegion: 'no-drag'
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
        </svg>
        <span style={{ letterSpacing: '0.04em' }}>AUDIO</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
             style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div ref={panelRef} style={{ position: 'absolute', top: 36, right: 8, zIndex: 50, width: 340, padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(6,6,18,0.94)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', boxShadow: '0 8px 40px rgba(0,0,0,0.5)', WebkitAppRegion: 'no-drag', fontFamily: "'JetBrains Mono','Cascadia Code','Consolas',monospace", overflowY: 'auto', maxHeight: 'calc(100vh - 50px)' }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#c4b5fd', letterSpacing: '0.12em' }}>AUDIO</span>
            <button
              onClick={onToggleMusic}
              style={{ padding: '3px 10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: musicOn ? 'rgba(105,219,124,0.12)' : 'rgba(255,107,107,0.1)', color: musicOn ? '#8ce99a' : '#ff8787', fontSize: 10, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {musicOn ? 'ON' : 'MUTE'}
            </button>
          </div>

          {/* Mode switch */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            <button
              onClick={() => onModeChange?.('dynamic')}
              style={{
                flex: 1, padding: '6px 0', borderRadius: 7, border: `1px solid ${!isStatic ? 'rgba(124,111,247,0.35)' : 'rgba(255,255,255,0.06)'}`,
                background: !isStatic ? 'rgba(124,111,247,0.14)' : 'transparent',
                color: !isStatic ? '#c4b5fd' : 'rgba(255,255,255,0.3)', fontSize: 10, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.04em', transition: 'all 0.2s ease'
              }}
            >
              Dynamic
            </button>
            <button
              onClick={() => onModeChange?.('static')}
              style={{
                flex: 1, padding: '6px 0', borderRadius: 7, border: `1px solid ${isStatic ? 'rgba(124,111,247,0.35)' : 'rgba(255,255,255,0.06)'}`,
                background: isStatic ? 'rgba(124,111,247,0.14)' : 'transparent',
                color: isStatic ? '#c4b5fd' : 'rgba(255,255,255,0.3)', fontSize: 10, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.04em', transition: 'all 0.2s ease'
              }}
            >
              Static
            </button>
          </div>

          {/* 3 tier rows */}
          {TIER_NAMES.map((name, i) => {
            const active = i === currentTier && musicOn
            const clickable = isStatic
            return (
              <div
                key={i}
                onClick={() => clickable && onStaticSelect?.(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, marginBottom: i < 2 ? 4 : 10,
                  background: active ? 'rgba(124,111,247,0.12)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${active ? 'rgba(124,111,247,0.25)' : 'rgba(255,255,255,0.04)'}`,
                  cursor: clickable ? 'pointer' : 'default',
                  transition: 'all 0.25s ease'
                }}
              >
                <span style={{ width: 22, height: 22, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', background: active ? 'rgba(124,111,247,0.25)' : 'rgba(255,255,255,0.04)', color: active ? '#c4b5fd' : 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: 600, flexShrink: 0 }}>
                  {i + 1}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: active ? '#e0e0f0' : 'rgba(255,255,255,0.55)', letterSpacing: '0.03em', marginBottom: 1 }}>{name}</div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.22)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName(audioMap[i])}</div>
                </div>
                {active && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#a78bfa', boxShadow: '0 0 6px #a78bfa', flexShrink: 0 }} />}
                <button
                  onClick={(e) => { e.stopPropagation(); fileRefs.current[i]?.click() }}
                  style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: 'rgba(255,255,255,0.35)', fontSize: 9, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(124,111,247,0.3)'; e.currentTarget.style.color = '#a78bfa' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.35)' }}
                >Change</button>
                <input ref={el => { fileRefs.current[i] = el }} type="file" accept="audio/*,.mp3,.wav,.ogg,.flac" style={{ display: 'none' }} onChange={(e) => handleFile(i, e)} />
              </div>
            )
          })}

          {/* Master volume */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 4px' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
            <input type="range" min="0" max="100" step="1" value={Math.round(masterVolume * 100)} onChange={(e) => onVolumeChange?.(Number(e.target.value) / 100)}
              style={{ flex: 1, height: 4, WebkitAppearance: 'none', appearance: 'none', background: `linear-gradient(to right, #7c6ff7 0%, #7c6ff7 ${masterVolume * 100}%, rgba(255,255,255,0.08) ${masterVolume * 100}%, rgba(255,255,255,0.08) 100%)`, borderRadius: 2, outline: 'none', cursor: 'pointer' }} />
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', minWidth: 30, textAlign: 'right' }}>{Math.round(masterVolume * 100)}%</span>
          </div>
        </div>
      )}
    </div>
  )
}
