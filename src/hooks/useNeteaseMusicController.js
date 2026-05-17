import { useState, useCallback } from 'react'

/* ================================================================== */
/*  Apple iTunes Search — free, stable, previewUrl built-in             */
/*  All fetch goes through main process (no CORS issues)               */
/* ================================================================== */

let _player = null
function getPlayer() {
  if (!_player) {
    _player = new Audio()
    _player.crossOrigin = 'anonymous'
  }
  return _player
}

function fmtDuration(ms) {
  if (!ms) return '--:--'
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function useMusicController() {
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [currentTrack, setCurrentTrack] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState(null)

  /* ---- search (main process → iTunes API) ---- */
  const search = useCallback(async (query) => {
    if (!query.trim()) { setResults([]); return }
    setSearching(true)
    setError(null)
    try {
      const r = await window.terminal?.itunesSearch?.({ term: query, limit: 20 })
      if (!r?.ok) throw new Error(r?.error || 'Search failed')
      setResults((r.results || []).map((t) => ({
        ...t,
        durationFmt: fmtDuration(t.duration)
      })))
    } catch (e) {
      setResults([])
      setError(e.message)
    }
    setSearching(false)
  }, [])

  /* ---- play via custom stream:// protocol (CSP-proof native streaming) ---- */
  const play = useCallback(async (track) => {
    if (!track?.previewUrl) {
      setError('No preview available')
      return
    }
    setError(null)
    try {
      const player = getPlayer()
      if (!player.paused) player.pause()
      // stream:// protocol → main process net.fetch → native streaming
      player.src = `stream://audio?url=${encodeURIComponent(track.previewUrl)}`
      player.currentTime = 0
      await player.play()
      setCurrentTrack(track)
      setPlaying(true)
    } catch (e) {
      setError(e.message)
    }
  }, [])

  const pause = useCallback(() => { getPlayer().pause(); setPlaying(false) }, [])
  const resume = useCallback(() => { getPlayer().play().catch(() => {}); setPlaying(true) }, [])
  const stop = useCallback(() => {
    const p = getPlayer()
    p.pause(); p.currentTime = 0
    setPlaying(false); setCurrentTrack(null)
  }, [])

  return { search, results, searching, play, pause, resume, stop, playing, currentTrack, error }
}
