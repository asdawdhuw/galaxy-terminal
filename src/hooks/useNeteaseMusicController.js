import { useState, useCallback, useRef, useEffect } from 'react'

/* ================================================================== */
/*  Apple iTunes Search — free, stable, previewUrl built-in             */
/*  Auto-radio: when a 30s preview ends, play another track by the      */
/*  same artist. All fetch goes through main process (no CORS).        */
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

  // Refs to avoid stale closures in the onended handler
  const currentRef = useRef(null)
  const resultsRef = useRef([])
  currentRef.current = currentTrack
  resultsRef.current = results

  /* ---- helper: play a track by URL ---- */
  async function playTrack(track) {
    if (!track?.previewUrl) return false
    const player = getPlayer()
    if (!player.paused) player.pause()
    player.src = `stream://audio?url=${encodeURIComponent(track.previewUrl)}`
    player.currentTime = 0
    try {
      await player.play()
      setCurrentTrack(track)
      setPlaying(true)
      return true
    } catch (e) {
      setError(e.message)
      return false
    }
  }

  /* ---- auto-radio: same-artist shuffle ---- */
  const autoRadio = useCallback(async () => {
    const prev = currentRef.current
    if (!prev?.artist) return

    console.log('[Radio] 30s ended — searching more by:', prev.artist)
    try {
      const r = await window.terminal?.itunesSearch?.({ term: prev.artist, limit: 30 })
      if (!r?.ok) throw new Error('No results')

      // Filter out the track that just finished
      const candidates = r.results.filter((t) => t.id !== prev.id && t.previewUrl)
      if (candidates.length === 0) {
        // Fallback: pick next from current search results
        const idx = resultsRef.current.findIndex((t) => t.id === prev.id)
        const fallback = resultsRef.current[idx + 1] || resultsRef.current[0]
        if (fallback && fallback.previewUrl && fallback.id !== prev.id) {
          console.log('[Radio] Fallback — next in list:', fallback.name)
          await playTrack(fallback)
        } else {
          console.log('[Radio] No more tracks available')
        }
        return
      }

      // Random pick from same-artist songs
      const next = candidates[Math.floor(Math.random() * candidates.length)]
      console.log(`[Radio] Next up: ${next.name} — ${next.artist}`)
      await playTrack(next)
    } catch (e) {
      console.warn('[Radio] Failed, trying fallback:', e.message)
      // Fallback: next song in current results
      const idx = resultsRef.current.findIndex((t) => t.id === prev.id)
      const fallback = resultsRef.current[idx + 1] || resultsRef.current[0]
      if (fallback?.previewUrl && fallback.id !== prev.id) {
        await playTrack(fallback)
      }
    }
  }, [])

  /* ---- register onended once ---- */
  useEffect(() => {
    const player = getPlayer()
    player.addEventListener('ended', autoRadio)
    return () => player.removeEventListener('ended', autoRadio)
  }, [autoRadio])

  /* ---- search ---- */
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

  /* ---- play ---- */
  const play = useCallback(async (track) => {
    setError(null)
    await playTrack(track)
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
