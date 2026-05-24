import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'

export default function MusicPlayer({ onClose, isPopup }) {
  const [files, setFiles] = useState([])
  const [currentIdx, setCurrentIdx] = useState(-1)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const audioRef = useRef(null)
  const overlayRef = useRef(null)

  useEffect(() => {
    window.terminal.musicList().then((res) => {
      if (res.ok) setFiles(res.files)
      setLoading(false)
    })
  }, [])

  // Filtered playlist
  const filtered = useMemo(() => {
    if (!searchQuery) return files
    const q = searchQuery.toLowerCase()
    return files.filter((f) => f.name.toLowerCase().includes(q))
  }, [files, searchQuery])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    function tick() { setProgress(audio.currentTime) }
    function meta() { setDuration(audio.duration || 0) }
    function ended() { playNext() }
    audio.addEventListener('timeupdate', tick)
    audio.addEventListener('loadedmetadata', meta)
    audio.addEventListener('ended', ended)
    return () => {
      audio.removeEventListener('timeupdate', tick)
      audio.removeEventListener('loadedmetadata', meta)
      audio.removeEventListener('ended', ended)
    }
  }, [currentIdx])

  function play(idx) {
    setCurrentIdx(idx)
    setPlaying(true)
    setProgress(0)
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
    const current = filtered[currentIdx]
    const realIdx = current ? files.indexOf(current) : -1
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

  function formatTime(s) {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  function handleOverlayClick(e) {
    if (e.target === overlayRef.current && !isPopup) onClose()
  }

  const currentTrack = currentIdx >= 0 ? files[currentIdx] : null
  const streamUrl = currentTrack ? `stream://audio?url=${encodeURIComponent(currentTrack.path)}` : ''

  const panel = (
    <div className={`music-player-panel ${isPopup ? 'music-popup-full' : ''}`}>
      <div className="music-player-header" style={isPopup ? { WebkitAppRegion: 'drag' } : {}}>
        <span className="music-player-title">{'\u{1F3B5}'} Galaxy Music</span>
        <button className="file-viewer-close" onClick={onClose} style={isPopup ? { WebkitAppRegion: 'no-drag' } : {}}>×</button>
      </div>

      {/* Search */}
      <div className="music-player-search">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search songs..."
          spellCheck={false}
          className="file-viewer-search-input"
        />
        {searchQuery && (
          <span className="file-viewer-search-count">{filtered.length} found</span>
        )}
      </div>

      {/* Now playing */}
      <div className="music-player-now">
        <div className="music-player-cover">
          {currentTrack ? '\u{1F3B5}' : '\u{1F4C1}'}
        </div>
        <div className="music-player-info">
          <div className="music-player-track">
            {currentTrack ? currentTrack.name : 'No track selected'}
          </div>
          {currentTrack && (
            <div className="music-player-time">
              {formatTime(progress)} / {formatTime(duration)}
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="music-player-bar-wrap" onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const pct = (e.clientX - rect.left) / rect.width
        if (audioRef.current && duration) {
          audioRef.current.currentTime = pct * duration
          setProgress(pct * duration)
        }
      }}>
        <div className="music-player-bar" style={{ width: duration ? `${(progress / duration) * 100}%` : '0%' }} />
      </div>

      {/* Controls */}
      <div className="music-player-controls">
        <button className="music-btn" onClick={playPrev} title="Previous">◀◀</button>
        <button className="music-btn" onClick={togglePlay} title={playing ? 'Pause' : 'Play'}>
          {playing ? '||' : '▶'}
        </button>
        <button className="music-btn" onClick={playNext} title="Next">▶▶</button>
      </div>

      {/* Playlist */}
      <div className="music-player-list">
        {loading && (
          <div className="music-player-empty">Scanning music folder...</div>
        )}
        {!loading && filtered.length === 0 && !searchQuery && (
          <div className="music-player-empty">
            No music files found.<br />
            <span style={{ fontSize: 10, opacity: 0.5 }}>Drop .mp3 / .flac / .wav files into the music/ folder</span>
          </div>
        )}
        {!loading && filtered.length === 0 && searchQuery && (
          <div className="music-player-empty">No matches for "{searchQuery}"</div>
        )}
        {filtered.map((f, i) => {
          const realIdx = files.indexOf(f)
          return (
            <div
              key={realIdx}
              className={`music-track ${realIdx === currentIdx ? 'active' : ''}`}
              onClick={() => realIdx === currentIdx ? togglePlay() : play(realIdx)}
            >
              <span className="music-track-idx">{realIdx + 1}</span>
              <span className="music-track-name">{f.name}</span>
              {realIdx === currentIdx && playing && (
                <span className="music-track-playing">{'\u{266B}'}</span>
              )}
            </div>
          )
        })}
      </div>

      {currentTrack && <audio ref={audioRef} src={streamUrl} preload="auto" />}
    </div>
  )

  if (isPopup) return panel

  return createPortal(
    <div ref={overlayRef} className="music-player-overlay" onClick={handleOverlayClick}>
      {panel}
    </div>,
    document.body
  )
}
