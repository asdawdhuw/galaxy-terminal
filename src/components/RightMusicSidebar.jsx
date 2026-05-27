import { useState, useRef, useCallback, useEffect } from 'react'

function toBiliImg(url) {
  if (!url) return ''
  const stripped = url.replace(/^https?:\/\//, '')
  return `bili-img://${stripped}`
}

function parseLRC(lrc) {
  if (!lrc) return []
  const lines = []
  const re = /^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)$/
  for (const line of lrc.split('\n')) {
    const m = line.match(re)
    if (m) {
      const min = parseInt(m[1], 10)
      const sec = parseInt(m[2], 10)
      const ms = parseInt(m[3], 10) * (m[3].length === 3 ? 1 : 10)
      lines.push({ time: min * 60 + sec + ms / 1000, text: m[4].trim() })
    }
  }
  return lines.sort((a, b) => a.time - b.time)
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
  focusMode,
  playing,
  getTime,
  pinned,
  onTogglePin
}) {
  const [query, setQuery] = useState('')
  const [panelWidth, setPanelWidth] = useState(260)
  const sidebarRef = useRef(null)
  const timerRef = useRef(null)

  // Lyrics state
  const [showLyrics, setShowLyrics] = useState(false)
  const [lyricsLoading, setLyricsLoading] = useState(false)
  const [lyricsError, setLyricsError] = useState(null)
  const [lrcLines, setLrcLines] = useState([])
  const [plainLyrics, setPlainLyrics] = useState(null)
  const [lyricIndex, setLyricIndex] = useState(-1)
  const lyricsTrackRef = useRef(null)  // track which lyrics were fetched for

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

  async function fetchLyrics() {
    if (!currentTrack) return
    const artist = currentTrack.artist || ''
    const title = currentTrack.title || ''
    if (!title) return

    setShowLyrics(true)
    setLyricsLoading(true)
    setLyricsError(null)
    setLrcLines([])
    setPlainLyrics(null)
    setLyricIndex(-1)
    lyricsTrackRef.current = currentTrack.bvid

    try {
      const r = await window.terminal?.searchLyrics?.({ artist, title })
      if (!r?.ok) {
        setLyricsError(r?.error || 'Lyrics not found')
        return
      }
      if (r.syncedLyrics) {
        const parsed = parseLRC(r.syncedLyrics)
        if (parsed.length > 0) {
          setLrcLines(parsed)
          return
        }
      }
      if (r.plainLyrics) {
        setPlainLyrics(r.plainLyrics)
      } else {
        setLyricsError('No lyrics available')
      }
    } catch (e) {
      setLyricsError(e.message)
    } finally {
      setLyricsLoading(false)
    }
  }

  // Track LRC line index against playback time
  useEffect(() => {
    if (!showLyrics || lrcLines.length === 0 || !playing) return
    const timer = setInterval(() => {
      const t = getTime?.() ?? 0
      let idx = -1
      for (let i = 0; i < lrcLines.length; i++) {
        if (lrcLines[i].time <= t) idx = i
        else break
      }
      setLyricIndex(idx)
    }, 200)
    return () => clearInterval(timer)
  }, [showLyrics, lrcLines, playing, getTime])

  // Reset lyrics when track changes
  useEffect(() => {
    if (currentTrack?.bvid !== lyricsTrackRef.current) {
      setShowLyrics(false)
      setLrcLines([])
      setPlainLyrics(null)
    }
  }, [currentTrack])

  // Click outside to close (when not pinned)
  useEffect(() => {
    if (!visible || pinned) return
    function handleClick(e) {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target)) {
        onClose?.()
      }
    }
    // Use mousedown so it fires before other handlers
    document.addEventListener('mousedown', handleClick, { capture: true })
    return () => document.removeEventListener('mousedown', handleClick, { capture: true })
  }, [visible, pinned, onClose])

  if (!visible) return null

  return (
    <aside
      ref={sidebarRef}
      className={`sidebar-right animate-slide-in-right ${focusMode ? 'panel-focus-out' : ''}`}
      style={{ width: panelWidth, minWidth: panelWidth, maxWidth: panelWidth }}
    >
      <div className="sidebar-resize-handle" onMouseDown={handleResizeStart} style={{ left: -3, right: 'auto' }} />
      <div className="sidebar-right-header">
        <span className="sidebar-right-title">Music</span>
        <div className="sidebar-right-actions">
          <button
            type="button"
            onClick={onTogglePin}
            className={`sidebar-right-pin${pinned ? ' pinned' : ''}`}
            title={pinned ? 'Unpin — click outside to hide' : 'Pin — keep open'}
          >
            {pinned ? '◉' : '○'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="sidebar-right-close"
            title="Close"
          >
            ×
          </button>
        </div>
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
            placeholder="Search songs..."
            spellCheck={false}
          />
        </div>
        <button
          className={`lyrics-toggle-btn${showLyrics ? ' active' : ''}`}
          onClick={() => showLyrics ? setShowLyrics(false) : fetchLyrics()}
          title={showLyrics ? 'Hide lyrics' : 'Show lyrics'}
          disabled={!currentTrack}
        >
          歌词
        </button>
      </div>

      {/* Lyrics panel */}
      {showLyrics && (
        <div className="lyrics-panel">
          {lyricsLoading && (
            <div className="lyrics-placeholder">Fetching lyrics...</div>
          )}
          {lyricsError && (
            <div className="lyrics-placeholder" style={{ color: 'var(--dot-red)' }}>{lyricsError}</div>
          )}
          {!lyricsLoading && !lyricsError && plainLyrics && (
            <div className="lyrics-plain">{plainLyrics}</div>
          )}
          {!lyricsLoading && lrcLines.length > 0 && lrcLines.map((line, i) => {
            const dist = lyricIndex >= 0 ? Math.abs(i - lyricIndex) : 999
            let cls = 'lyrics-lrc-line'
            if (dist === 0) cls += ' current'
            else if (dist === 1) cls += ' near'
            const scrollRef = dist === 0 ? { ref: (el) => { if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }) } } : {}
            return (
              <div key={i} className={cls} {...scrollRef}>
                {line.text}
              </div>
            )
          })}
        </div>
      )}

      {!showLyrics && (
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
              Search music · Double-click to play
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
      )}

      <div className="music-track-footer">
        Double-click or ▶ to play · Auto-play next
      </div>
    </aside>
  )
}
