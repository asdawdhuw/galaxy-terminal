import { useState, useRef, useCallback } from 'react'

function toBiliImg(url) {
  if (!url) return ''
  const stripped = url.replace(/^https?:\/\//, '')
  return `bili-img://${stripped}`
}

export default function RightMusicSidebar({
  visible,
  onClose,
  results = [],
  searching,
  onSearch,
  onPlay,
  currentTrack,
  error,
  focusMode
}) {
  const [query, setQuery] = useState('')
  const [panelWidth, setPanelWidth] = useState(260)
  const sidebarRef = useRef(null)
  const timerRef = useRef(null)

  function handleInput(v) {
    setQuery(v)
    clearTimeout(timerRef.current)
    if (v.trim()) {
      timerRef.current = setTimeout(() => onSearch?.(v), 400)
    }
  }

  const handleResizeStart = useCallback((e) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = sidebarRef.current?.offsetWidth || panelWidth
    function onMove(ev) {
      const w = Math.max(180, Math.min(500, startW - (ev.clientX - startX)))
      setPanelWidth(w)
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [panelWidth])

  if (!visible) return null

  return (
    <aside
      ref={sidebarRef}
      className={`sidebar-right animate-slide-in-right ${focusMode ? 'panel-focus-out' : ''}`}
      style={{ width: panelWidth, minWidth: panelWidth, maxWidth: panelWidth }}
    >
      <div className="sidebar-resize-handle" onMouseDown={handleResizeStart} style={{ left: -3, right: 'auto' }} />
      <div className="sidebar-right-header">
        <span className="sidebar-right-title">Bilibili Music</span>
        <button
          type="button"
          onClick={onClose}
          className="sidebar-right-close"
          title="Close"
        >
          ×
        </button>
      </div>

      <div className="music-search-wrap">
        <div className="music-search-inner">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            placeholder="Search B站 songs..."
            spellCheck={false}
          />
        </div>
      </div>

      <div className="music-track-list">
        {error && (
          <div style={{ padding: '12px 16px', fontSize: 10, color: 'var(--dot-red)', opacity: 0.7, textAlign: 'center' }}>
            {error}
          </div>
        )}
        {searching && (
          <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: 10, color: 'var(--text-dim)', opacity: 0.4 }}>
            Searching...
          </div>
        )}
        {!searching && results.length === 0 && query && (
          <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: 10, color: 'var(--text-dim)', opacity: 0.4 }}>
            No results
          </div>
        )}
        {!searching && results.length === 0 && !query && (
          <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 10, color: 'var(--text-dim)', opacity: 0.3, fontStyle: 'italic' }}>
            Search B站 music · Double-click to play
          </div>
        )}
        {results.map((track, i) => {
          const isActive = currentTrack?.bvid === track.bvid
          return (
            <div
              key={track.bvid || i}
              onDoubleClick={() => onPlay?.(track)}
              className={`music-track-item${isActive ? ' playing' : ''}`}
            >
              <span className="music-track-index">{i + 1}</span>

              {track.cover && (
                <img src={toBiliImg(track.cover)} alt="" className="music-track-cover" />
              )}

              <div className="music-track-info">
                <div className="music-track-title">{track.title}</div>
                <div className="music-track-artist">{track.artist}</div>
              </div>

              <span className="music-track-duration">
                {track.duration || '--:--'}
              </span>

              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onPlay?.(track) }}
                className="music-track-play"
                title="Play"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              </button>
            </div>
          )
        })}
      </div>

      <div className="music-track-footer">
        Double-click or ▶ to play · Auto-play next
      </div>
    </aside>
  )
}
