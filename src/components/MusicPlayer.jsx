import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import MusicSpectrum from './MusicSpectrum'
import { setMusicState } from '../utils/musicState'

function fmtTime(s) {
  if (!s || !isFinite(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export default function MusicPlayer({ onClose, isPopup, pinned, onTogglePin }) {
  const [files, setFiles] = useState([])
  const [extraFiles, setExtraFiles] = useState([])
  const [removedPaths, setRemovedPaths] = useState(new Set())
  const [currentIdx, setCurrentIdx] = useState(-1)

  const allFiles = useMemo(() => {
    const merged = [...files, ...extraFiles]
    return merged.filter(f => !removedPaths.has(f.path))
  }, [files, extraFiles, removedPaths])

  function removeTrack(f) {
    if (currentIdx >= 0 && allFiles[currentIdx] === f) {
      setCurrentIdx(-1)
      setPlaying(false)
      setProgress(0)
    }
    // Extra files (user-picked): remove from the list entirely
    setExtraFiles(prev => prev.filter(ef => ef.path !== f.path))
    // Music folder files: just hide from view
    if (!extraFiles.some(ef => ef.path === f.path)) {
      setRemovedPaths(prev => new Set([...prev, f.path]))
    }
  }
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [miniMode, setMiniMode] = useState(false)
  const [miniSearch, setMiniSearch] = useState(false)
  const [popupPinned, setPopupPinned] = useState(false) // always-on-top for popup window
  const audioRef = useRef(null)
  const panelRef = useRef(null)
  const miniBarRef = useRef(null)
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, offX: 0, offY: 0, init: false })
  const [miniOff, setMiniOff] = useState({ x: 0, y: 0 })

  // AudioContext + AnalyserNode for spectrum
  const audioCtxRef = useRef(null)
  const analyserRef = useRef(null)
  const sourceRef = useRef(null)
  const wiredElRef = useRef(null) // track which DOM element is currently wired

  const getAnalyser = useCallback(() => {
    return analyserRef.current
  }, [])

  // Connect audio element to AudioContext graph — reconnects when element changes
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    // Same DOM element already wired — skip
    if (audio === wiredElRef.current) return

    // Clean up old source if audio element changed (e.g. full→mini mode switch)
    if (sourceRef.current) {
      try { sourceRef.current.disconnect() } catch (_) {}
      sourceRef.current = null
    }

    try {
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
      }
      const ctx = audioCtxRef.current
      if (ctx.state === 'suspended') ctx.resume()

      const source = ctx.createMediaElementSource(audio)
      sourceRef.current = source
      wiredElRef.current = audio

      // Reuse existing analyser or create new one
      if (!analyserRef.current) {
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 256
        analyser.smoothingTimeConstant = 0.5
        analyserRef.current = analyser
      }
      source.connect(analyserRef.current)
      analyserRef.current.connect(ctx.destination)
    } catch (_) {
      // createMediaElementSource can only be called once per element
    }
  }, [currentIdx, miniMode])

  // Init mini bar position (centered, near bottom)
  useEffect(() => {
    if (!miniMode || dragRef.current.init) return
    dragRef.current.init = true
    dragRef.current.offX = 0
    dragRef.current.offY = 0
  }, [miniMode])

  useEffect(() => {
    async function load() {
      const [listRes, session] = await Promise.all([
        window.terminal.musicList(),
        window.terminal.loadMusicSession()
      ])
      setFiles(listRes.ok ? listRes.files : [])
      setExtraFiles(session?.extraFiles || [])
      setRemovedPaths(new Set())

      if (session?.playTarget) {
        // Resolve playTarget to correct index in merged allFiles
        const merged = [...(listRes.ok ? listRes.files : []), ...(session.extraFiles || [])]
        const idx = merged.findIndex(f => f.path === session.playTarget)
        if (idx >= 0) {
          setCurrentIdx(idx)
          setProgress(0)
          setPlaying(true)
          setTimeout(() => { audioRef.current?.play()?.catch(() => setPlaying(false)) }, 100)
        }
      } else if (session?.currentIdx >= 0) {
        setCurrentIdx(session.currentIdx)
        setProgress(session.progress || 0)
        setPlaying(true)
        setTimeout(() => {
          if (audioRef.current && session.progress > 0) {
            audioRef.current.currentTime = session.progress
          }
          audioRef.current?.play().catch(() => setPlaying(false))
        }, 100)
      }
      setLoading(false)
    }
    load()

    // Listen for session changes from another window (music:playFile)
    const unsub = window.terminal.onMusicSessionChanged?.(() => load())
    return () => { if (typeof unsub === 'function') unsub() }
  }, [])

  // Broadcast music state to AetherMap Audio Radar (local + cross-window)
  useEffect(() => {
    const track = currentIdx >= 0 ? allFiles[currentIdx] : null
    const state = {
      playing,
      trackName: track?.name || null,
      trackPath: track?.path || null,
    }
    setMusicState(state)
    // When popped out, also broadcast via IPC to reach the main window
    if (isPopup) window.terminal?.broadcastMusicState?.(state)
    return () => {
      const resetState = { playing: false, trackName: null, trackPath: null }
      setMusicState(resetState)
      if (isPopup) window.terminal?.broadcastMusicState?.(resetState)
    }
  }, [playing, currentIdx, allFiles, isPopup])

  const filtered = useMemo(() => {
    if (!searchQuery) return allFiles
    const q = searchQuery.toLowerCase()
    return allFiles.filter((f) => f.name.toLowerCase().includes(q))
  }, [allFiles, searchQuery])

  async function openFiles() {
    const res = await window.terminal.openAudioDialog()
    if (!res?.ok || res.files.length === 0) return
    setExtraFiles(prev => {
      const existingPaths = new Set([...files, ...prev].map(f => f.path))
      const newFiles = res.files.filter(f => !existingPaths.has(f.path))
      return [...prev, ...newFiles]
    })
  }

  // Show up to 5 filtered results in mini search dropdown
  const miniResults = miniSearch && searchQuery ? filtered.slice(0, 5) : []

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    function tick() { setProgress(audio.currentTime) }
    function meta() { if (audio.duration && isFinite(audio.duration)) setDuration(audio.duration) }
    function ended() { playNext() }
    function onPlay() { setPlaying(true) }
    function onPause() { setPlaying(false) }
    audio.addEventListener('timeupdate', tick)
    audio.addEventListener('loadedmetadata', meta)
    audio.addEventListener('durationchange', meta)
    audio.addEventListener('ended', ended)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    return () => {
      audio.removeEventListener('timeupdate', tick)
      audio.removeEventListener('loadedmetadata', meta)
      audio.removeEventListener('durationchange', meta)
      audio.removeEventListener('ended', ended)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
    }
  }, [currentIdx])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    const track = currentIdx >= 0 ? allFiles[currentIdx] : null
    if (!track) { navigator.mediaSession.metadata = null; return }
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.name.replace(/\.[^.]+$/, ''),
      album: 'Galaxy Terminal'
    })
    navigator.mediaSession.setActionHandler('play', () => togglePlay())
    navigator.mediaSession.setActionHandler('pause', () => { if (audioRef.current) { audioRef.current.pause(); setPlaying(false) } })
    navigator.mediaSession.setActionHandler('nexttrack', () => playNext())
    navigator.mediaSession.setActionHandler('previoustrack', () => playPrev())
  }, [currentIdx, allFiles])

  function play(idx) {
    setCurrentIdx(idx)
    setPlaying(true)
    setProgress(0)
    setDuration(0)
    setTimeout(() => {
      if (audioRef.current) audioRef.current.play().catch(() => setPlaying(false))
    }, 50)
  }

  function togglePlay() {
    if (!audioRef.current) return
    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
    } else {
      audioRef.current.play().catch(() => setPlaying(false))
      setPlaying(true)
    }
  }

  function playNext() {
    if (filtered.length === 0) return
    const nextFiltered = (currentIdx + 1) % filtered.length
    const nextFile = filtered[nextFiltered]
    const nextRealIdx = allFiles.indexOf(nextFile)
    play(nextRealIdx)
  }

  function playPrev() {
    if (filtered.length === 0) return
    const prevFiltered = (currentIdx - 1 + filtered.length) % filtered.length
    const prevFile = filtered[prevFiltered]
    const prevRealIdx = allFiles.indexOf(prevFile)
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

  async function handlePopOut() {
    // Save current state so popup window can restore it
    await window.terminal.saveMusicSession({
      extraFiles,
      currentIdx,
      progress: audioRef.current?.currentTime || 0
    })
    window.terminal.openMusicWindow()
    onClose?.()
  }

  // ---- Mini bar drag (disabled when pinned) ----
  function onMiniMouseDown(e) {
    if (pinned) return
    if (e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.tagName === 'INPUT') return
    e.preventDefault()
    const off = dragRef.current
    off.dragging = true
    off.startX = e.clientX
    off.startY = e.clientY
    document.addEventListener('mousemove', onMiniMouseMove)
    document.addEventListener('mouseup', onMiniMouseUp)
  }
  function onMiniMouseMove(e) {
    const off = dragRef.current
    if (!off.dragging) return
    const dx = e.clientX - off.startX
    const dy = e.clientY - off.startY
    off.offX += dx
    off.offY += dy
    off.startX = e.clientX
    off.startY = e.clientY
    setMiniOff({ x: off.offX, y: off.offY })
  }
  function onMiniMouseUp() {
    dragRef.current.dragging = false
    document.removeEventListener('mousemove', onMiniMouseMove)
    document.removeEventListener('mouseup', onMiniMouseUp)
  }

  // Click outside to close (full overlay only)
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

  const currentTrack = currentIdx >= 0 ? allFiles[currentIdx] : null
  const streamUrl = currentTrack ? `stream://audio?url=${encodeURIComponent(currentTrack.path)}` : ''
  const audioEl = currentTrack ? <audio ref={audioRef} src={streamUrl} preload="auto" /> : null

  // ---- Mini bar ----
  if (miniMode && !isPopup) {
    const pct = duration > 0 ? (progress / duration) * 100 : 0
    return createPortal(
      <div
        ref={miniBarRef}
        className={`music-mini-bar${pinned ? ' pinned-bar' : ''}`}
        style={{
          left: '50%',
          bottom: 12,
          transform: `translate(calc(-50% + ${miniOff.x}px), ${miniOff.y}px)`,
        }}
        onMouseDown={onMiniMouseDown}
      >
        <MusicSpectrum getAnalyser={getAnalyser} playing={playing} />

        {/* Search results dropdown (appears above mini bar) */}
        {miniSearch && miniResults.length > 0 && (
          <div className="music-mini-results">
            {miniResults.map((f, i) => {
              const realIdx = allFiles.indexOf(f)
              return (
                <div
                  key={realIdx}
                  className={`music-mini-result-item ${realIdx === currentIdx ? 'active' : ''}`}
                  onClick={() => { play(realIdx); setMiniSearch(false) }}
                >
                  <span className="music-mini-result-idx">{realIdx + 1}</span>
                  <span className="music-mini-result-name">{f.name}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* Search row */}
        {miniSearch && (
          <div className="music-mini-search">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              spellCheck={false}
              autoFocus
              className="music-mini-search-input"
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setMiniSearch(false); setSearchQuery('') }
                if (e.key === 'Enter' && miniResults.length > 0) { play(files.indexOf(miniResults[0])); setMiniSearch(false) }
              }}
            />
            <button className="music-mini-search-close" onClick={() => { setMiniSearch(false); setSearchQuery('') }}>{'×'}</button>
          </div>
        )}

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

          <button className="music-mini-btn" onClick={() => setMiniSearch((v) => !v)} title="Search">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
          </button>

          {onTogglePin && (
            <button
              className={`music-mini-pin ${pinned ? 'pinned' : ''}`}
              onClick={onTogglePin}
              title={pinned ? 'Unpin — allow drag & auto-hide' : 'Pin — lock position & prevent close'}
            >
              {pinned ? '◉' : '○'}
            </button>
          )}

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
          <button className="file-viewer-pin" onClick={openFiles} title="Open audio files" style={{ WebkitAppRegion: 'no-drag' }}>
            {'+'}
          </button>
          {isPopup ? (
            <button
              className={`file-viewer-pin ${popupPinned ? 'pinned' : ''}`}
              onClick={async () => {
                const r = await window.terminal?.toggleMusicPin()
                if (r?.pinned !== undefined) setPopupPinned(r.pinned)
                else setPopupPinned((v) => !v)
              }}
              title={popupPinned ? 'Unpin — let window hide behind others' : 'Pin — keep window on top'}
              style={{ WebkitAppRegion: 'no-drag' }}
            >
              {popupPinned ? '◉' : '○'}
            </button>
          ) : (
            <>
              <button className="file-viewer-pin" onClick={() => setMiniMode(true)} title="Mini mode" style={{ WebkitAppRegion: 'no-drag' }}>
                {'━'}
              </button>
              <button className="file-viewer-pin" onClick={handlePopOut} title="Pop out" style={{ WebkitAppRegion: 'no-drag' }}>
                {'⧉'}
              </button>
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
          const realIdx = allFiles.indexOf(f)
          return (
            <div key={realIdx} className={`music-track ${realIdx === currentIdx ? 'active' : ''}`}
              onClick={() => realIdx === currentIdx ? togglePlay() : play(realIdx)}>
              <span className="music-track-idx">{realIdx + 1}</span>
              <span className="music-track-name">{f.name}</span>
              {realIdx === currentIdx && playing && <span className="music-track-playing">{'\u{266B}'}</span>}
              <span className="music-track-remove" title="Remove from playlist"
                onClick={(e) => { e.stopPropagation(); removeTrack(f) }}>×</span>
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
