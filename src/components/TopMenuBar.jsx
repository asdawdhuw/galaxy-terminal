import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

const TIER_NAMES = ['Deep Space', 'Particle Stream', 'Interstellar']

function fileName(url) {
  if (!url) return '—'
  try { return decodeURIComponent(url.split('/').pop()) } catch (_) { return url }
}

export default function TopMenuBar({
  currentTime = '',
  musicOn,
  onToggleMusic,
  currentTier = 0,
  audioMap = {},
  masterVolume = 0.75,
  mode = 'dynamic',
  onChangeTrack,
  onVolumeChange,
  onModeChange,
  onStaticSelect,
  onToggleSearch,
  searchOpen,
  musicPlaying,
  musicTrack,
  onMusicPause,
  onMusicResume
}) {
  const [audioOpen, setAudioOpen] = useState(false)
  const panelRef = useRef(null)
  const btnRef = useRef(null)
  const fileRefs = useRef([null, null, null])

  useEffect(() => {
    if (!audioOpen) return
    function handler(e) {
      if (panelRef.current && !panelRef.current.contains(e.target) && !btnRef.current?.contains(e.target)) {
        setAudioOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [audioOpen])

  function handleFile(tier, e) {
    const file = e.target.files?.[0]
    if (file) onChangeTrack?.(tier, file)
    e.target.value = ''
  }

  const isStatic = mode === 'static'

  function handleWinClose() { window.win?.close() }
  function handleWinMinimize() { window.win?.minimize() }
  function handleWinMaximize() { window.win?.maximize() }

  return (
    <div className="title-bar" style={{ WebkitAppRegion: 'drag' }}>
      {/* Left: window dots + music controls */}
      <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' }}>
        <div className="title-bar-dots">
          <button
            className="title-bar-dot"
            style={{ background: 'var(--dot-red)', border: 'none', cursor: 'pointer' }}
            onClick={handleWinClose}
            title="Close"
            aria-label="Close"
          />
          <button
            className="title-bar-dot"
            style={{ background: 'var(--dot-yellow)', border: 'none', cursor: 'pointer' }}
            onClick={handleWinMinimize}
            title="Minimize"
            aria-label="Minimize"
          />
          <button
            className="title-bar-dot"
            style={{ background: 'var(--dot-green)', border: 'none', cursor: 'pointer' }}
            onClick={handleWinMaximize}
            title="Maximize"
            aria-label="Maximize"
          />
        </div>

        <button
          type="button"
          onClick={onToggleSearch}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 12px',
            borderRadius: 9999,
            fontSize: 11,
            fontFamily: 'inherit',
            border: searchOpen
              ? '1px solid rgba(61,127,255,0.4)'
              : '1px solid var(--border)',
            background: searchOpen
              ? 'rgba(61,127,255,0.12)'
              : 'rgba(8,13,28,0.5)',
            color: searchOpen ? 'var(--accent)' : 'var(--text-dim)',
            cursor: 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            transition: 'all 0.2s',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <span>Music</span>
          {searchOpen && (
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 6px var(--accent)' }} />
          )}
        </button>

        {musicTrack && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '2px 8px', borderRadius: 9999, background: 'rgba(8,13,28,0.5)', border: '1px solid var(--border)' }}>
            <button
              type="button"
              onClick={musicPlaying ? onMusicPause : onMusicResume}
              style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', borderRadius: '50%', color: 'var(--accent)', display: 'flex' }}
              title={musicPlaying ? 'Pause' : 'Play'}
            >
              {musicPlaying ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              )}
            </button>
          </div>
        )}

        {musicTrack && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, maxWidth: 200, overflow: 'hidden' }} className="hidden sm:flex">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" style={{ flexShrink: 0 }}>
              <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
            </svg>
            <span style={{ color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {musicTrack.title || musicTrack.name} — {musicTrack.artist}
            </span>
          </div>
        )}
      </div>

      {/* Center: app name + clock */}
      <div className="title-bar-name" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontWeight: 600 }}>Galaxy Terminal</span>
        <span style={{ opacity: 0.5, fontSize: 10 }}>|</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.5 }}>
          <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" strokeLinecap="round" />
        </svg>
        <span>{currentTime}</span>
      </div>

      {/* Right: audio panel toggle */}
      <div className="flex items-center gap-3 ml-auto" style={{ WebkitAppRegion: 'no-drag' }}>
        <button
          ref={btnRef}
          type="button"
          onClick={() => setAudioOpen((v) => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
            fontFamily: 'inherit',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            background: 'none',
            border: 'none',
            color: audioOpen ? 'var(--accent)' : 'var(--text-dim)',
            cursor: 'pointer',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
          </svg>
          <span>Audio</span>
          <span style={{ fontSize: 9, opacity: 0.5 }}>▾</span>
        </button>

        {audioOpen && createPortal(
          <div
            ref={panelRef}
            className="audio-panel"
            style={{
              position: 'fixed',
              top: 40,
              right: 8,
              zIndex: 9999,
              width: 340,
              padding: 16,
              borderRadius: 12,
              boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
              fontFamily: 'JetBrainsMono NF, FiraCode Nerd Font, Cascadia Code, DejaVu Sans Mono, Consolas, monospace',
              maxHeight: 'calc(100vh - 56px)',
              overflowY: 'auto',
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', letterSpacing: '0.15em' }}>AUDIO</span>
              <button
                type="button"
                onClick={onToggleMusic}
                style={{
                  padding: '2px 10px',
                  borderRadius: 9999,
                  fontSize: 10,
                  fontFamily: 'inherit',
                  border: musicOn ? '1px solid rgba(61,127,255,0.35)' : '1px solid rgba(255,95,87,0.3)',
                  background: musicOn ? 'rgba(61,127,255,0.12)' : 'rgba(255,95,87,0.1)',
                  color: musicOn ? 'var(--accent)' : 'var(--dot-red)',
                  cursor: 'pointer',
                }}
              >
                {musicOn ? 'ON' : 'MUTE'}
              </button>
            </div>

            <div className="flex gap-1.5 mb-3">
              <button
                type="button"
                onClick={() => onModeChange?.('dynamic')}
                style={{
                  flex: 1,
                  padding: '6px 0',
                  borderRadius: 6,
                  fontSize: 10,
                  fontFamily: 'inherit',
                  border: !isStatic ? '1px solid rgba(61,127,255,0.35)' : '1px solid var(--border)',
                  background: !isStatic ? 'rgba(61,127,255,0.15)' : 'transparent',
                  color: !isStatic ? 'var(--accent)' : 'var(--text-dim)',
                  cursor: 'pointer',
                }}
              >
                Dynamic
              </button>
              <button
                type="button"
                onClick={() => onModeChange?.('static')}
                style={{
                  flex: 1,
                  padding: '6px 0',
                  borderRadius: 6,
                  fontSize: 10,
                  fontFamily: 'inherit',
                  border: isStatic ? '1px solid rgba(61,127,255,0.35)' : '1px solid var(--border)',
                  background: isStatic ? 'rgba(61,127,255,0.15)' : 'transparent',
                  color: isStatic ? 'var(--accent)' : 'var(--text-dim)',
                  cursor: 'pointer',
                }}
              >
                Static
              </button>
            </div>

            {TIER_NAMES.map((tierName, i) => {
              const active = i === currentTier && musicOn
              return (
                <div
                  key={i}
                  onClick={() => isStatic && onStaticSelect?.(i)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 10px',
                    borderRadius: 8,
                    marginBottom: 4,
                    border: active ? '1px solid rgba(61,127,255,0.25)' : '1px solid var(--border)',
                    background: active ? 'rgba(61,127,255,0.1)' : 'rgba(8,13,28,0.3)',
                    cursor: isStatic ? 'pointer' : 'default',
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{
                    width: 20, height: 20, borderRadius: 4,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 600,
                    background: active ? 'rgba(61,127,255,0.25)' : 'rgba(8,13,28,0.5)',
                    color: active ? 'var(--accent)' : 'var(--text-dim)',
                  }}>
                    {i + 1}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: active ? 'var(--text-primary)' : 'var(--text-dim)' }}>{tierName}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-dim)', opacity: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName(audioMap[i])}</div>
                  </div>
                  {active && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 6px var(--accent)' }} />}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); fileRefs.current[i]?.click() }}
                    style={{
                      fontSize: 9,
                      padding: '2px 8px',
                      borderRadius: 4,
                      border: '1px solid var(--border)',
                      background: 'none',
                      color: 'var(--text-dim)',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Change
                  </button>
                  <input ref={(el) => { fileRefs.current[i] = el }} type="file" accept="audio/*,.mp3,.wav,.ogg,.flac" className="hidden" onChange={(e) => handleFile(i, e)} />
                </div>
              )
            })}

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round(masterVolume * 100)}
                onChange={(e) => onVolumeChange?.(Number(e.target.value) / 100)}
                style={{ flex: 1, height: 3, accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
              <span style={{ fontSize: 10, color: 'var(--text-dim)', width: 32, textAlign: 'right' }}>{Math.round(masterVolume * 100)}%</span>
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  )
}
