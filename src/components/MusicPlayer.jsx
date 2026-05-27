import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'

function fmtTime(s) {
  if (!s || !isFinite(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export default function MusicPlayer({ onClose, isPopup, pinned, onTogglePin }) {
  const [files, setFiles] = useState([])
  const [currentIdx, setCurrentIdx] = useState(-1)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [miniMode, setMiniMode] = useState(false)
  const audioRef = useRef(null)
  const panelRef = useRef(null)
  const miniBarRef = useRef(null)
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0 })
  const [miniPos, setMiniPos] = useState({ x: 0, y: 0 })

  useEffect(() => {
    window.terminal.musicList().then((res) => {
      if (res.ok) setFiles(res.files)
      setLoading(false)
    })
  }, [])

  const filtered = useMemo(() => {
    if (!searchQuery) return files
    const q = searchQuery.toLowerCase()
    return files.filter((f) => f.name.toLowerCase().includes(q))
  }, [files, searchQuery])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    function tick() { setProgress(audio.currentTime) }
    function meta() { if (audio.duration && isFinite(audio.duration)) setDuration(audio.duration) }
    function ended() { playNext() }
    audio.addEventListener('timeupdate', tick)
    audio.addEventListener('loadedmetadata', meta)
    audio.addEventListener('durationchange', meta)
    audio.addEventListener('ended', ended)
    return () => {
      audio.removeEventListener('timeupdate', tick)
      audio.removeEventListener('loadedmetadata', meta)
      audio.removeEventListener('durationchange', meta)
      audio.removeEventListener('ended', ended)
    }
  }, [currentIdx])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    const track = currentIdx >= 0 ? files[currentIdx] : null
    if (!track) { navigator.mediaSession.metadata = null; return }
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.name.replace(/\.[^.]+$/, ''),
      album: 'Galaxy Terminal'
    })
    navigator.mediaSession.setActionHandler('play', () => togglePlay())
    navigator.mediaSession.setActionHandler('pause', () => { if (audioRef.current) { audioRef.current.pause(); setPlaying(false) } })
    navigator.mediaSession.setActionHandler('nexttrack', () => playNext())
    navigator.mediaSession.setActionHandler('previoustrack', () => playPrev())
  }, [currentIdx, files])

  function play(idx) {
    setCurrentIdx(idx)
    setPlaying(true)
    setProgress(0)
    setDuration(0)
    setTimeout(() => {
      if (audioRef.current) audioRef.current.play().catch(() => {})
    }, 50)
  }

  function togglePlay() {
    if (!audioRef.current) return
    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
    } else {
      audioRef.current.play().catch(() => {})
      setPlaying(true)
    }
  }

  function playNext() {
    if (filtered.length === 0) return
    const nextFiltered = (currentIdx + 1) % filtered.length
    const nextFile = filtered[nextFiltered]
    const nextRealIdx = files.indexOf(nextFile)
    play(nextRealIdx)
  }

  function playPrev() {
    if (filtered.length === 0) return
    const prevFiltered = (currentIdx - 1 + filtered.length) % filtered.length
    const prevFile = filtered[prevFiltered]
    const prevRealIdx = files.indexOf(prevFile)
    play(prevRealIdx)
  }

  function handleProgressClick(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    if (audioRef.current && duration) {
      audioRef.current.currentTime = pct * duration
      setProgress(pct * duration)
    }
  }

  function handlePopOut() {
    window.terminal.openMusicWindow()
    onClose?.()
  }

  // Mini bar drag — plain functions with refs to avoid stale closures
  function onMiniMouseDown(e) {
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return
    e.preventDefault()
    dragRef.current.dragging = true
    dragRef.current.startX = e.clientX - miniPos.x
    dragRef.current.startY = e.clientY - miniPos.y
    document.addEventListener('mousemove', onMiniMouseMove)
    document.addEventListener('mouseup', onMiniMouseUp)
  }
  function onMiniMouseMove(e) {
    if (!dragRef.current.dragging) return
    setMiniPos({ x: e.clientX - dragRef.current.startX, y: e.clientY - dragRef.current.startY })
  }
  function onMiniMouseUp() {
    dragRef.current.dragging = false
    document.removeEventListener('mousemove', onMiniMouseMove)
    document.removeEventListener('mouseup', onMiniMouseUp)
  }

  // Click outside to close (full overlay only, not mini/popup/pinned)
  useEffect(() => {
    if (miniMode || isPopup || pinned) return
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose?.()
      }
    }
    document.addEventListener('mousedown', handleClick, { capture: true })
    return () => document.removeEventListener('mousedown', handleClick, { capture: true })
  }, [miniMode, isPopup, pinned, onClose])

  const currentTrack = currentIdx >= 0 ? files[currentIdx] : null
  const streamUrl = currentTrack ? `stream://audio?url=${encodeURIComponent(currentTrack.path)}` : ''
  const audioEl = currentTrack ? <audio ref={audioRef} src={streamUrl} preload="auto" /> : null

  // ---- Mini bar ----
  if (miniMode && !isPopup) {
    const pct = duration > 0 ? (progress / duration) * 100 : 0
    return createPortal(
      <div
        ref={miniBarRef}
        className="music-mini-bar"
        style={{
          left: `calc(50% + ${miniPos.x}px)`,
          bottom: miniPos.y ? 'auto' : 12,
          top: miniPos.y ? `${miniPos.y}px` : 'auto',
          transform: 'translateX(-50%)',
        }}
        onMouseDown={onMiniMouseDown}
      >
        <div className="music-mini-main">
          <button className="music-mini-expand" onClick={() => setMiniMode(false)} title="Expand">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          </button>

          <div className="music-mini-info">
            <span className="music-mini-icon">{'\u{266B}'}</span>
            <span className="music-mini-track">
              {currentTrack ? currentTrack.name : 'No track selected'}
            </span>
          </div>

          <div className="music-mini-time-short">
            {currentTrack ? fmtTime(progress) : '--:--'}
          </div>

          <div className="music-mini-btns">
            <button className="music-mini-btn" onClick={playPrev} title="Previous">{'<<'}</button>
            <button className="music-mini-btn music-mini-btn-play" onClick={togglePlay} title={playing ? 'Pause' : 'Play'}>
              {playing ? '||' : '▶'}
            </button>
            <button className="music-mini-btn" onClick={playNext} title="Next">{'>>'}</button>
          </div>

          <button className="music-mini-close" onClick={onClose} title="Close">{'×'}</button>
        </div>

        <div className="music-mini-progress" onClick={handleProgressClick}>
          <div className="music-mini-progress-fill" style={{ width: `${pct}%` }} />
        </div>

        {audioEl}
      </div>,
      document.body
    )
  }

  // ---- Full panel ----
  const panel = (
    <div ref={panelRef} className={`music-player-panel ${isPopup ? 'music-popup-full' : ''}`}>
      <div className="music-player-header" style={isPopup ? { WebkitAppRegion: 'drag' } : {}}>
        <span className="music-player-title">{'\u{1F3B5}'} Galaxy Music</span>
        <div className="file-viewer-actions">
          {!isPopup && (
            <>
              <button className="file-viewer-pin" onClick={() => setMiniMode(true)} title="Mini mode" style={{ WebkitAppRegion: 'no-drag' }}>
                {'━'}
              </button>
              <button className="file-viewer-pin" onClick={handlePopOut} title="Pop out" style={{ WebkitAppRegion: 'no-drag' }}>
                {'⧉'}
              </button>
              {onTogglePin && (
                <button
                  className={`file-viewer-pin ${pinned ? 'pinned' : ''}`}
                  onClick={onTogglePin}
                  title={pinned ? 'Unpin' : 'Pin'}
                  style={{ WebkitAppRegion: 'no-drag' }}
                >
                  {pinned ? '◉' : '○'}
                </button>
              )}
            </>
          )}
          <button className="file-viewer-close" onClick={onClose} style={isPopup ? { WebkitAppRegion: 'no-drag' } : {}}>{'×'}</button>
        </div>
      </div>

      <div className="music-player-search">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search songs..." spellCheck={false} className="file-viewer-search-input" />
        {searchQuery && <span className="file-viewer-search-count">{filtered.length} found</span>}
      </div>

      <div className="music-player-now">
        <div className="music-player-cover">{currentTrack ? '\u{1F3B5}' : '\u{1F4C1}'}</div>
        <div className="music-player-info">
          <div className="music-player-track">{currentTrack ? currentTrack.name : 'No track selected'}</div>
          {currentTrack && <div className="music-player-time">{fmtTime(progress)} / {fmtTime(duration)}</div>}
        </div>
      </div>

      <div className="music-player-bar-wrap" onClick={handleProgressClick}>
        <div className="music-player-bar" style={{ width: duration ? `${(progress / duration) * 100}%` : '0%' }} />
      </div>

      <div className="music-player-controls">
        <button className="music-btn" onClick={playPrev} title="Previous">{'<<'}</button>
        <button className="music-btn music-btn-play" onClick={togglePlay} title={playing ? 'Pause' : 'Play'}>
          {playing ? '||' : '▶'}
        </button>
        <button className="music-btn" onClick={playNext} title="Next">{'>>'}</button>
      </div>

      <div className="music-player-list">
        {loading && <div className="music-player-empty">Scanning music folder...</div>}
        {!loading && filtered.length === 0 && !searchQuery && (
          <div className="music-player-empty">No music files found.<br />
            <span style={{ fontSize: 10, opacity: 0.5 }}>Drop .mp3 / .flac / .wav files into the music/ folder</span>
          </div>
        )}
        {!loading && filtered.length === 0 && searchQuery && (
          <div className="music-player-empty">No matches for "{searchQuery}"</div>
        )}
        {filtered.map((f, i) => {
          const realIdx = files.indexOf(f)
          return (
            <div key={realIdx} className={`music-track ${realIdx === currentIdx ? 'active' : ''}`}
              onClick={() => realIdx === currentIdx ? togglePlay() : play(realIdx)}>
              <span className="music-track-idx">{realIdx + 1}</span>
              <span className="music-track-name">{f.name}</span>
              {realIdx === currentIdx && playing && <span className="music-track-playing">{'\u{266B}'}</span>}
            </div>
          )
        })}
      </div>

      {audioEl}
    </div>
  )

  if (isPopup) return panel

  return createPortal(
    <div className="music-player-overlay">{panel}</div>,
    document.body
  )
}
